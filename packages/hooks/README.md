# @wpxdev/hooks

Import from the package root or a focused entry point:

```tsx
import { useMediaQuery } from "@wpxdev/hooks/use-media-query";
import { useDebouncedValue } from "@wpxdev/hooks/use-debounced-value";
```

Shared React hooks. Import named exports from `@wpxdev/hooks`.

## Autosave

Import `SaveQueue`, `IndexedDraftStorage`, `createAutosaveHooks`, `confirmedSave`, and
`saveProblem` from `@wpxdev/hooks/autosave` or `@wpxdev/shared-kit/hooks/autosave`.

```tsx
const queue = new SaveQueue({
  storage: new IndexedDraftStorage("site:user", crypto.randomUUID(), "my-app-drafts"),
  read: async (key) => api.read(key),
  write: async (key, operation) => api.write(key, operation),
  validate: (key, data) => undefined, // Optional application validation.
});
const ready = queue.initialize();
export const { useAutosave, useSaveQueue } = createAutosaveHooks(queue, ready);
```

Create the queue and hook factory once outside React rendering. Reads return
`{ key, data, version }`; writes receive `{ operationId, baseVersion, data, draftId }`
and return the confirmed snapshot. The server must enforce version conflicts and
idempotency for ambiguous retries. Transport failures may include `status`,
`retryAfter` (seconds), and `current` (latest server state for conflicts).
Application adapters own authentication, API calls, and browser connectivity/unload
listeners. Call `queue.dispose()` when disposing of an instance.

Storage defaults to `wpxdev-autosave`; supply your existing database name when
migrating to preserve drafts. Scope storage by application, site, and user.
The queue coalesces edits, persists drafts, limits concurrent writes, and exposes
explicit conflict resolution. `localOnly` drafts never call the write transport.
