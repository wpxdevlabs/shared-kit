import type { QueueSnapshot } from './queue';
/** Confirmed baseline changes only: initial loads and reverted edits aren't saves. */
export function confirmedSave(previous: QueueSnapshot, current: QueueSnapshot): boolean {
	return current.entries.some(entry => {
		const before = previous.entries.find(item => item.key === entry.key);
		return !entry.localOnly && entry.status === 'saved' && !entry.pending && !!before?.pending && !!before.baseline && !!entry.baseline && before.baseline.version !== entry.baseline.version;
	});
}
export function saveProblem(state: QueueSnapshot): string | undefined {
	if (state.storageError) return 'storage';
	return ['conflict', 'auth', 'validation', 'failed', 'offline'].find(status => state.entries.some(entry => !entry.localOnly && entry.pending && entry.status === status));
}
