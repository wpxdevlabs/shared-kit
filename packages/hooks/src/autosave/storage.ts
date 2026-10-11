import type { DraftStorage, SaveEntry } from './queue';
interface StoredDraft extends SaveEntry {
	id: string;
	scope: string;
}
const request = <T>(req: IDBRequest<T>) =>
	new Promise<T>((resolve, reject) => {
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
export class IndexedDraftStorage implements DraftStorage {
	private db: Promise<IDBDatabase>;
	constructor(
		private scope: string,
		private owner: string,
		databaseName = 'wpxdev-autosave',
	) {
		this.db = new Promise((resolve, reject) => {
			const opening = indexedDB.open(databaseName, 2);
			opening.onupgradeneeded = () => {
				const store = opening.result.objectStoreNames.contains('drafts')
					? opening.transaction!.objectStore('drafts')
					: opening.result.createObjectStore('drafts', { keyPath: 'id' });
				if (!store.indexNames.contains('scope')) store.createIndex('scope', 'scope');
				if (!store.indexNames.contains('resource'))
					store.createIndex('resource', ['scope', 'key']);
			};
			opening.onsuccess = () => {
				opening.result.onversionchange = () => opening.result.close();
				resolve(opening.result);
			};
			opening.onerror = () => reject(opening.error);
			opening.onblocked = () => reject(new Error('Draft storage is blocked by another tab.'));
		});
		// Attach immediately so blocked/private-storage failures are reported later.
		void this.db.catch(() => {});
	}
	private async transaction(action: (store: IDBObjectStore) => void) {
		const db = await this.db;
		return new Promise<void>((resolve, reject) => {
			const tx = db.transaction('drafts', 'readwrite');
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
			tx.onabort = () => reject(tx.error);
			action(tx.objectStore('drafts'));
		});
	}
	async load(): Promise<SaveEntry[]> {
		const db = await this.db;
		const rows = (await request(
			db
				.transaction('drafts', 'readonly')
				.objectStore('drafts')
				.index('scope')
				.getAll(this.scope),
		)) as StoredDraft[];
		return rows.filter(
			(row) =>
				row &&
				typeof row.key === 'string' &&
				row.data &&
				typeof row.data === 'object' &&
				typeof row.draftId === 'string' &&
				(row.localOnly ||
					(row.baseline?.key === row.key && typeof row.baseline.version === 'string')),
		);
	}
	put(entry: SaveEntry) {
		const stored: StoredDraft = {
			...entry,
			id: `${this.scope}:${this.owner}:${entry.key}`,
			scope: this.scope,
		};
		return this.transaction((store) => {
			store.put(stored);
			// Retire only the exact predecessor this edit superseded. Distinct
			// drafts from another tab remain available for conflict review.
			if (entry.previousDraftId) {
				const cursor = store
					.index('resource')
					.openCursor(IDBKeyRange.only([this.scope, entry.key]));
				cursor.onsuccess = () => {
					const row = cursor.result;
					if (!row) return;
					const old = row.value as StoredDraft;
					if (old.key === entry.key && old.draftId === entry.previousDraftId)
						row.delete();
					row.continue();
				};
			}
		});
	}
	private remove(key: string, draftId?: string) {
		return this.transaction((store) => {
			const cursor = store.index('resource').openCursor(IDBKeyRange.only([this.scope, key]));
			cursor.onsuccess = () => {
				const row = cursor.result;
				if (!row) return;
				const entry = row.value as StoredDraft;
				if (entry.key === key && (!draftId || entry.draftId === draftId)) row.delete();
				row.continue();
			};
		});
	}
	ack(key: string, draftId: string) {
		return this.remove(key, draftId);
	}
	clear(key: string) {
		return this.remove(key);
	}
}
