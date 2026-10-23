# @wpxdev/hooks

## 0.4.1

### Patch Changes

- e22bdf6: Publish a maintenance release of all packages with individual GitHub releases, version tags, npm package links, and installation commands.

## 0.4.0

### Minor Changes

- 3364928: Add optional batch reads and writes to the autosave queue, preserving per-resource drafts, immutable retries, conflicts, and the two-request concurrency limit.
  
  Index draft cleanup by scope and resource, preserving version-1 drafts during migration. Avoid repeated full-queue scans for save confirmations.
- 3364928: Extract transport-independent autosave queue, draft storage, notification selectors, and React hook factory. Expose Lucide icons through a focused entry point for use with the existing shadcn Button.

## 0.3.0

### Minor Changes

- 407b072: Extract transport-independent autosave queue, draft storage, notification selectors, and React hook factory. Expose Lucide icons through a focused entry point for use with the existing shadcn Button.

## 0.2.1

### Patch Changes

- 5ceb7ac: Publish the package collection under the `@wpxdev` npm organization and update all internal imports and documentation to use the new scope.

## 0.2.0

### Minor Changes

- 5e51368: Migrate the component library to Tailwind CSS v4 and shadcn/ui, prefix all public CSS classes and variables with `wpxdev`, and add focused component, hook, and utility entry points.

## 0.1.1

### Patch Changes

- 689df5c: Prepare the shared packages for their first automated npm release under the `@creador-dev` scope.
