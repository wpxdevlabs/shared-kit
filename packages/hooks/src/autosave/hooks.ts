import { useEffect, useState, useSyncExternalStore } from 'react';
import type { SaveQueue } from './queue';
import type { SaveData } from './queue';
export function createAutosaveHooks(saveQueue: SaveQueue, saveQueueReady: Promise<void>) {
	function useSaveQueue() {
		return useSyncExternalStore(saveQueue.subscribe, saveQueue.getSnapshot);
	}
	function useAutosave<T extends object>(key: string) {
		const state = useSaveQueue();
		const [loadError, setLoadError] = useState<string>();
		useEffect(() => {
			let active = true;
			setLoadError(undefined);
			void saveQueueReady
				.then(() => saveQueue.ensure(key))
				.catch((error) => {
					if (active) setLoadError(error instanceof Error ? error.message : String(error));
				});
			return () => {
				active = false;
			};
		}, [key]);
		const entry = state.entries.find((item) => item.key === key);
		return {
			data: entry?.data as T | undefined,
			loading: !entry && !loadError,
			error: loadError,
			entry,
			update: (data: T, immediate = false) =>
				saveQueue.edit(key, data as SaveData, immediate),
		};
	}
	return { useSaveQueue, useAutosave };
}
