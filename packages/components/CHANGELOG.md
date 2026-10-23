# @wpxdev/components

## 0.5.2

### Patch Changes

- e22bdf6: Publish a maintenance release of all packages with individual GitHub releases, version tags, npm package links, and installation commands.

## 0.5.1

### Patch Changes

- e2406f7: chore(deps): bump zod from 4.6.5 to 4.6.7
- 2aa014c: chore(deps): bump lucide-react from 1.55.0 to 1.57.0
- a3ee6b1: chore(deps-dev): bump shadcn from 4.21.4 to 4.21.5

## 0.5.0

### Minor Changes

- 3364928: Add shadcn Base UI Toast primitives, a toast manager, and a Toaster with an explicit portal container for shadow-root applications.
- 3364928: Extract transport-independent autosave queue, draft storage, notification selectors, and React hook factory. Expose Lucide icons through a focused entry point for use with the existing shadcn Button.

## 0.4.0

### Minor Changes

- 407b072: Extract transport-independent autosave queue, draft storage, notification selectors, and React hook factory. Expose Lucide icons through a focused entry point for use with the existing shadcn Button.

### Patch Changes

- cdfb0a8: Update dependencies to current compatible releases and include the React Is peer dependency required by Recharts.

## 0.3.1

### Patch Changes

- 5ceb7ac: Publish the package collection under the `@wpxdev` npm organization and update all internal imports and documentation to use the new scope.

## 0.3.0

### Minor Changes

- 7a01713: Add the complete shadcn UI component collection, focused exports for every component, and a separate composed-components area for update-safe customization. Components use standard Tailwind utility classes while package-owned design tokens remain namespaced with `wpxdev`.

## 0.2.0

### Minor Changes

- 5e51368: Migrate the component library to Tailwind CSS v4 and shadcn/ui, prefix all public CSS classes and variables with `wpxdev`, and add focused component, hook, and utility entry points.

## 0.1.1

### Patch Changes

- c0ca934: Add the shared-kit umbrella package and automatically load component-scoped SCSS colocated in PascalCase component folders.

## 0.1.0

### Minor Changes

- 355b289: Add the components package with accessible Button and Stack React primitives.
