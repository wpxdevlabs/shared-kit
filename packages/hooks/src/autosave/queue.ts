export type SaveData = Record<string, unknown>;
export interface SaveSnapshot {
	key: string;
	data: SaveData;
	version: string;
}
export interface Operation {
	operationId: string;
	baseVersion: string;
	data: SaveData;
	draftId: string;
}
export type SaveStatus =
	| 'saved'
	| 'pending'
	| 'saving'
	| 'offline'
	| 'failed'
	| 'validation'
	| 'auth'
	| 'conflict'
	| 'draft';
export interface SaveEntry {
	key: string;
	data: SaveData;
	baseline: SaveSnapshot | null;
	draftId: string;
	previousDraftId?: string | undefined;
	operation?: Operation | undefined;
	pending: boolean;
	localOnly: boolean;
	status: SaveStatus;
	localPersisted?: boolean | undefined;
	attempts: number;
	due: number;
	editedAt: number;
	firstEditedAt?: number | undefined;
	error?: string | undefined;
	current?: SaveSnapshot | undefined;
}
export interface SaveFailure extends Error {
	status?: number | undefined;
	retryAfter?: number | undefined;
	current?: SaveSnapshot | undefined;
}
export interface DraftStorage {
	load(): Promise<SaveEntry[]>;
	put(entry: SaveEntry): Promise<void>;
	ack(key: string, draftId: string): Promise<void>;
	clear(key: string): Promise<void>;
}
export interface QueueDependencies {
	storage: DraftStorage;
	read(key: string): Promise<SaveSnapshot>;
	write(key: string, operation: Operation): Promise<SaveSnapshot>;
	now?: () => number;
	id?: () => string;
	random?: () => number;
	validate?: (key: string, data: SaveData) => string | undefined;
}
export interface QueueSnapshot {
	entries: SaveEntry[];
	ready: boolean;
	storageError: string;
	connection: 'unknown' | 'available' | 'unavailable';
}
const equal = (a: unknown, b: unknown): boolean => {
	if (a === b) return true;
	if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
	const keys = Object.keys(a).sort();
	return (
		keys.join('|') === Object.keys(b).sort().join('|') &&
		keys.every((key) => equal((a as SaveData)[key], (b as SaveData)[key]))
	);
};
/** One immutable request per resource; at most two requests across the app. */
export class SaveQueue {
	private records = new Map<string, SaveEntry>();
	private listeners = new Set<() => void>();
	private active = new Set<string>();
	private reads = new Map<string, Promise<void>>();
	private timer: ReturnType<typeof setTimeout> | undefined;
	private writes: Promise<void> = Promise.resolve();
	private ready = false;
	private storageError = '';
	private connection: QueueSnapshot['connection'] = 'unknown';
	private snapshot: QueueSnapshot = {
		entries: [],
		ready: false,
		storageError: '',
		connection: 'unknown',
	};
	private stopped = false;
	private now: () => number;
	private id: () => string;
	private random: () => number;
	constructor(private deps: QueueDependencies) {
		this.now = deps.now ?? Date.now;
		this.id = deps.id ?? (() => crypto.randomUUID());
		this.random = deps.random ?? Math.random;
	}
	subscribe = (listener: () => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};
	getSnapshot = () => this.snapshot;
	get(key: string) {
		return this.records.get(key);
	}
	private emit() {
		this.snapshot = {
			entries: [...this.records.values()].map((entry) => ({ ...entry })),
			ready: this.ready,
			storageError: this.storageError,
			connection: this.connection,
		};
		this.listeners.forEach((listener) => listener());
	}
	async initialize() {
		try {
			for (const stored of await this.deps.storage.load()) {
				const existing = this.records.get(stored.key);
				if (
					existing &&
					existing.draftId !== stored.draftId &&
					!equal(existing.data, stored.data)
				) {
					const latest =
						stored.editedAt > existing.editedAt ? stored : existing;
					this.records.set(stored.key, {
						...latest,
						status: latest.localOnly ? 'draft' : 'conflict',
						error:
							'Multiple local drafts exist. Review the displayed draft before resuming.',
					});
					continue;
				}
				if (existing?.status === 'conflict') continue;
				this.records.set(stored.key, {
					...stored,
					localPersisted: true,
					status: stored.localOnly
						? 'draft'
						: ['auth', 'conflict', 'validation', 'failed'].includes(
									stored.status
							  )
							? stored.status
							: 'pending',
					due: this.now() + 800,
				});
			}
		} catch {
			this.storageError =
				'Browser storage is unavailable. Changes are kept only while this tab remains open.';
		}
		this.ready = true;
		this.emit();
		this.schedule();
	}
	async ensure(key: string) {
		if (!this.ready) throw new Error('Save queue is still restoring drafts.');
		if (this.records.has(key)) return;
		const existing = this.reads.get(key);
		if (existing) return existing;
		const read = this.deps
			.read(key)
			.then((baseline) => {
				if (!this.records.has(key))
					this.records.set(key, {
						key,
						data: baseline.data,
						baseline,
						draftId: this.id(),
						pending: false,
						localOnly: false,
						status: 'saved',
						attempts: 0,
						due: 0,
						editedAt: 0,
					});
				this.connection = 'available';
				this.emit();
			})
			.finally(() => this.reads.delete(key));
		this.reads.set(key, read);
		return read;
	}
	edit(key: string, data: SaveData, immediate = false) {
		const entry = this.records.get(key);
		if (!entry) throw new Error('Preferences have not loaded yet.');
		if (equal(entry.data, data)) return;
		const error = this.deps.validate?.(key, data);
		const pending =
			!!entry.operation || !entry.baseline || !equal(entry.baseline.data, data);
		const status =
			entry.status === 'conflict' || entry.status === 'auth'
				? entry.status
				: entry.localOnly
					? 'draft'
					: error
						? 'validation'
						: pending
							? 'pending'
							: 'saved';
		const now = this.now();
		const firstEditedAt = entry.pending ? (entry.firstEditedAt ?? now) : now;
		const next: SaveEntry = {
			...entry,
			data: structuredClone(data),
			draftId: this.id(),
			previousDraftId: entry.draftId,
			localPersisted: false,
			pending,
			status,
			editedAt: now,
			firstEditedAt,
			error: status === 'conflict' || status === 'auth' ? entry.error : error,
			attempts: entry.operation ? entry.attempts : 0,
			due: immediate ? now : Math.min(now + 800, firstEditedAt + 3000),
		};
		this.records.set(key, next);
		this.persist(next);
		this.emit();
		this.schedule();
	}
	setLocalDraft(key: string, data: SaveData) {
		const old = this.records.get(key);
		if (old && equal(old.data, data)) return;
		const entry: SaveEntry = {
			key,
			data: structuredClone(data),
			baseline: null,
			draftId: this.id(),
			previousDraftId: old?.draftId,
			localOnly: true,
			localPersisted: false,
			pending: true,
			status: 'draft',
			attempts: 0,
			due: 0,
			editedAt: this.now(),
		};
		this.records.set(key, entry);
		this.persist(entry);
		this.emit();
	}
	async clearDraft(key: string, draftId?: string) {
		if (draftId && this.records.get(key)?.draftId !== draftId) return;
		await this.store(() =>
			draftId
				? this.deps.storage.ack(key, draftId)
				: this.deps.storage.clear(key)
		);
		if (draftId && this.records.get(key)?.draftId !== draftId) return;
		this.records.delete(key);
		this.emit();
	}
	private store(action: () => Promise<void>) {
		this.writes = this.writes.then(action).catch(() => {
			this.storageError =
				'Could not store your draft locally. Keep this tab open until the server confirms saving.';
			this.emit();
		});
		return this.writes;
	}
	private persist(entry: SaveEntry) {
		const copy = structuredClone(entry);
		return this.store(async () => {
			await this.deps.storage.put(copy);
			const current = this.records.get(copy.key);
			if (current?.draftId === copy.draftId) {
				this.records.set(copy.key, { ...current, localPersisted: true });
				this.emit();
			}
			if (!copy.pending && !copy.localOnly)
				await this.deps.storage.ack(copy.key, copy.draftId);
		});
	}
	private schedule() {
		if (this.timer) clearTimeout(this.timer);
		if (!this.ready || this.stopped || this.active.size >= 2) return;
		const candidates = [...this.records.values()].filter(
			(entry) =>
				entry.pending &&
				!entry.localOnly &&
				!this.active.has(entry.key) &&
				['pending', 'offline'].includes(entry.status)
		);
		if (!candidates.length) return;
		this.timer = setTimeout(
			() => {
				this.timer = undefined;
				void this.pump();
			},
			Math.max(
				0,
				Math.min(...candidates.map((entry) => entry.due)) - this.now()
			)
		);
	}
	async pump() {
		if (!this.ready || this.stopped) return;
		const candidates = [...this.records.values()].filter(
			(entry) =>
				entry.pending &&
				!entry.localOnly &&
				!this.active.has(entry.key) &&
				['pending', 'offline'].includes(entry.status) &&
				entry.due <= this.now()
		);
		for (const entry of candidates) {
			if (this.active.size >= 2) break;
			this.active.add(entry.key);
			void this.send(entry.key);
		}
		this.schedule();
	}
	private async send(key: string) {
		let entry = this.records.get(key)!;
		if (!entry.baseline) {
			this.active.delete(key);
			return;
		}
		const operation = entry.operation ?? {
			operationId: this.id(),
			baseVersion: entry.baseline.version,
			data: structuredClone(entry.data),
			draftId: entry.draftId,
		};
		entry = { ...entry, operation, status: 'saving' };
		this.records.set(key, entry);
		this.emit();
		await this.persist(entry); // Record ambiguous writes before any network request.
		try {
			const saved = await this.deps.write(key, operation);
			this.connection = 'available';
			const latest = this.records.get(key)!;
			const pending = !equal(latest.data, saved.data);
			const error = this.deps.validate?.(key, latest.data);
			const next: SaveEntry = {
				...latest,
				baseline: saved,
				data: pending ? latest.data : saved.data,
				operation: undefined,
				firstEditedAt: pending ? this.now() : undefined,
				attempts: 0,
				pending,
				status: error ? 'validation' : pending ? 'pending' : 'saved',
				error,
				current: undefined,
				due: this.now() + 800,
			};
			this.records.set(key, next);
			await this.store(() => this.deps.storage.ack(key, operation.draftId));
			await this.persist(next);
		} catch (error) {
			const failure = error as SaveFailure;
			const latest = this.records.get(key)!;
			const status = failure.status ?? 0;
			if (
				status === 409 &&
				failure.current &&
				equal(latest.data, failure.current.data)
			) {
				const confirmed: SaveEntry = {
					...latest,
					baseline: failure.current,
					operation: undefined,
					pending: false,
					status: 'saved',
					error: undefined,
					current: undefined,
				};
				this.records.set(key, confirmed);
				await this.persist(confirmed);
				return;
			}
			const attempts = latest.attempts + 1;
			const retryable =
				status === 0 ||
				status === 408 ||
				status === 429 ||
				[500, 502, 503, 504].includes(status);
			if (status === 0) this.connection = 'unavailable';
			const changed = latest.draftId !== operation.draftId;
			// A definitive rejected request can be discarded; an ambiguous failure
			// retains its exact ID and payload until the server confirms its outcome.
			const rejected = [400, 404, 409, 413, 422].includes(status);
			const next: SaveEntry = {
				...latest,
				operation: rejected ? undefined : operation,
				attempts,
				status:
					status === 409
						? 'conflict'
						: [401, 403].includes(status)
							? 'auth'
							: retryable
								? attempts >= 5
									? 'failed'
									: status === 0
										? 'offline'
										: 'pending'
								: changed && status === 422
									? 'pending'
									: 'validation',
				error: failure.message || 'Save failed.',
				current: failure.current,
				due:
					this.now() +
					Math.max(
						failure.retryAfter ?? 0,
						Math.min(30000, 1000 * 2 ** (attempts - 1)) *
							(0.75 + this.random() / 2)
					),
			};
			this.records.set(key, next);
			await this.persist(next);
		} finally {
			this.active.delete(key);
			this.emit();
			this.schedule();
		}
	}
	retry() {
		for (const entry of this.records.values()) {
			if (
				entry.pending &&
				!entry.localOnly &&
				!['conflict', 'validation'].includes(entry.status) &&
				!this.active.has(entry.key)
			) {
				this.records.set(entry.key, {
					...entry,
					status: 'pending',
					attempts: 0,
					due: this.now(),
				});
			}
		}
		this.emit();
		this.schedule();
	}
	connectivityHint() {
		// Browser online/offline signals are hints. A real API response determines
		// connectivity, and only one queued request per resource can resume.
		for (const entry of this.records.values()) {
			if (['offline', 'pending'].includes(entry.status))
				this.records.set(entry.key, { ...entry, due: this.now() });
		}
		this.schedule();
	}
	async resolve(key: string, keepDraft: boolean) {
		const entry = this.records.get(key);
		if (!entry || this.active.has(key)) return;
		const current = await this.deps.read(key);
		if (this.records.get(key)?.draftId !== entry.draftId)
			throw new Error(
				'The draft changed while reviewing. Review it again before choosing.'
			);
		await this.store(() => this.deps.storage.clear(key));
		if (this.records.get(key)?.draftId !== entry.draftId) {
			await this.persist(this.records.get(key)!);
			throw new Error(
				'The draft changed while reviewing. Your new edits are retained.'
			);
		}
		const error = keepDraft ? this.deps.validate?.(key, entry.data) : undefined;
		const next: SaveEntry = {
			...entry,
			baseline: current,
			data: keepDraft ? entry.data : current.data,
			draftId: this.id(),
			operation: undefined,
			pending: keepDraft && !equal(entry.data, current.data),
			status: error ? 'validation' : keepDraft ? 'pending' : 'saved',
			error,
			current: undefined,
			attempts: 0,
			due: this.now(),
		};
		this.records.set(key, next);
		await this.persist(next);
		this.emit();
		this.schedule();
	}
	dispose() {
		this.stopped = true;
		if (this.timer) clearTimeout(this.timer);
	}
}
