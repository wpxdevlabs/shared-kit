const test = require('node:test');
const assert = require('node:assert/strict');
test('draft storage accepts an application database name and supplies a shared default', async () => {
	const { IndexedDraftStorage } = await import('../dist/autosave.js');
	const original = global.indexedDB;
	const calls = [];
	global.indexedDB = {
		open: (...args) => {
			calls.push(args);
			return {};
		},
	};
	try {
		new IndexedDraftStorage('site:user', 'tab');
		new IndexedDraftStorage('site:user', 'tab', 'existing-plugin-drafts');
		assert.deepEqual(calls, [
			['wpxdev-autosave', 2],
			['existing-plugin-drafts', 2],
		]);
	} finally {
		if (original === undefined) delete global.indexedDB;
		else global.indexedDB = original;
	}
});

test('version-one drafts survive upgrade and cleanup visits only the matching resource', async () => {
	const { IDBFactory, IDBKeyRange, IDBCursor } = await import('fake-indexeddb');
	const { IndexedDraftStorage } = await import('../dist/autosave.js');
	const originalDB = global.indexedDB,
		originalRange = global.IDBKeyRange;
	global.indexedDB = new IDBFactory();
	global.IDBKeyRange = IDBKeyRange;
	const factory = global.indexedDB;
	let visits = 0;
	const originalContinue = IDBCursor.prototype.continue;
	IDBCursor.prototype.continue = function (...args) {
		visits++;
		return originalContinue.apply(this, args);
	};
	try {
		const legacy = await new Promise((resolve, reject) => {
			const opening = factory.open('upgrade-test', 1);
			opening.onupgradeneeded = () => {
				const store = opening.result.createObjectStore('drafts', { keyPath: 'id' });
				store.createIndex('scope', 'scope');
			};
			opening.onerror = () => reject(opening.error);
			opening.onsuccess = () => resolve(opening.result);
		});
		await new Promise((resolve, reject) => {
			const tx = legacy.transaction('drafts', 'readwrite');
			const store = tx.objectStore('drafts');
			for (let i = 0; i < 1000; i++)
				store.put({
					id: `site:old:crawler:${i}`,
					scope: 'site',
					key: `crawler:${i}`,
					data: { value: 1 },
					baseline: { key: `crawler:${i}`, data: { value: 0 }, version: 'v0' },
					draftId: `old-${i}`,
					pending: true,
				});
			store.put({
				id: 'site:other:crawler:0',
				scope: 'site',
				key: 'crawler:0',
				data: { value: 3 },
				baseline: { key: 'crawler:0', data: { value: 0 }, version: 'v0' },
				draftId: 'other-tab',
				pending: true,
			});
			store.put({
				id: 'another:old:crawler:0',
				scope: 'another',
				key: 'crawler:0',
				data: { value: 4 },
				baseline: { key: 'crawler:0', data: { value: 0 }, version: 'v0' },
				draftId: 'other-site',
				pending: true,
			});
			tx.oncomplete = resolve;
			tx.onerror = () => reject(tx.error);
		});
		legacy.close();
		const storage = new IndexedDraftStorage('site', 'new', 'upgrade-test');
		assert.equal((await storage.load()).length, 1001);
		await storage.put({
			key: 'crawler:0',
			data: { value: 2 },
			baseline: { key: 'crawler:0', data: { value: 0 }, version: 'v0' },
			draftId: 'new-0',
			previousDraftId: 'old-0',
			pending: true,
		});
		await storage.ack('crawler:0', 'new-0');
		const remaining = await storage.load();
		assert.equal(remaining.length, 1000);
		assert.ok(remaining.some((row) => row.draftId === 'other-tab'));
		assert.ok(!remaining.some((row) => row.draftId === 'old-0' || row.draftId === 'new-0'));
		assert.ok(visits <= 5, `cleanup visited ${visits} rows instead of scanning every draft`);
		const otherSite = new IndexedDraftStorage('another', 'new', 'upgrade-test');
		assert.equal((await otherSite.load())[0].draftId, 'other-site');
	} finally {
		global.indexedDB = originalDB;
		global.IDBKeyRange = originalRange;
		IDBCursor.prototype.continue = originalContinue;
	}
});
test(
	'one thousand edits finish saving with IndexedDB and ten write batches',
	{ timeout: 15000 },
	async () => {
		const { IDBFactory, IDBKeyRange } = await import('fake-indexeddb');
		const { IndexedDraftStorage, SaveQueue } = await import('../dist/autosave.js');
		const originalDB = global.indexedDB,
			originalRange = global.IDBKeyRange;
		global.indexedDB = new IDBFactory();
		global.IDBKeyRange = IDBKeyRange;
		let batches = 0;
		const q = new SaveQueue({
			storage: new IndexedDraftStorage('bulk', 'tab', 'bulk-test'),
			read: async (key) => ({ key, data: { value: 0 }, version: 'v0' }),
			readMany: async (keys) =>
				keys.map((key) => ({ key, data: { value: 0 }, version: 'v0' })),
			write: async () => {
				throw new Error('Unexpected single write');
			},
			writeBatch: async (operations) => {
				batches++;
				return operations.map(({ key, operation }) => ({
					key,
					snapshot: { key, data: operation.data, version: 'v1' },
				}));
			},
		});
		try {
			await q.initialize();
			const keys = Array.from({ length: 1000 }, (_, i) => `crawler:${i}`);
			await q.ensureMany(keys);
			keys.forEach((key) => q.edit(key, { value: 1 }, true));
			await new Promise((resolve, reject) => {
				const timer = setTimeout(() => {
					unsubscribe();
					reject(new Error('Bulk save did not finish'));
				}, 10000);
				const unsubscribe = q.subscribe(() => {
					if (!q.getSnapshot().entries.some((entry) => entry.pending)) {
						clearTimeout(timer);
						unsubscribe();
						resolve();
					}
				});
				void q.pump();
			});
			assert.equal(batches, 10);
			assert.ok(q.getSnapshot().entries.every((entry) => entry.status === 'saved'));
		} finally {
			q.dispose();
			global.indexedDB = originalDB;
			global.IDBKeyRange = originalRange;
		}
	},
);
