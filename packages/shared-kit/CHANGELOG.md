# @wpxdev/shared-kit

## 0.4.0

### Minor Changes

- 407b072: Extract transport-independent autosave queue, draft storage, notification selectors, and React hook factory. Expose Lucide icons through a focused entry point for use with the existing shadcn Button.

### Patch Changes

- Updated dependencies [407b072]
- Updated dependencies [cdfb0a8]
  - @wpxdev/hooks@0.3.0
  - @wpxdev/components@0.4.0

## 0.3.1

### Patch Changes

- 5ceb7ac: Publish the package collection under the `@wpxdev` npm organization and update all internal imports and documentation to use the new scope.
- Updated dependencies [5ceb7ac]
  - @wpxdev/components@0.3.1
  - @wpxdev/hooks@0.2.1
  - @wpxdev/styles@0.2.1
  - @wpxdev/utils@0.2.1

## 0.3.0

### Minor Changes

- 7a01713: Add the complete shadcn UI component collection, focused exports for every component, and a separate composed-components area for update-safe customization. Components use standard Tailwind utility classes while package-owned design tokens remain namespaced with `wpxdev`.

### Patch Changes

- Updated dependencies [7a01713]
  - @creador-dev/components@0.3.0

## 0.2.0

### Minor Changes

- 5e51368: Migrate the component library to Tailwind CSS v4 and shadcn/ui, prefix all public CSS classes and variables with `wpxdev`, and add focused component, hook, and utility entry points.

### Patch Changes

- Updated dependencies [5e51368]
  - @creador-dev/components@0.2.0
  - @creador-dev/styles@0.2.0
  - @creador-dev/hooks@0.2.0
  - @creador-dev/utils@0.2.0

## 0.1.0

### Minor Changes

- c0ca934: Add the shared-kit umbrella package and automatically load component-scoped SCSS colocated in PascalCase component folders.

### Patch Changes

- Updated dependencies [c0ca934]
- Updated dependencies [eae71cf]
  - @creador-dev/components@0.1.1
  - @creador-dev/styles@0.1.2
