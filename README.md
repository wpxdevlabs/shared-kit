# WPXDev Shared Kit

[![CI](https://github.com/wpxdevlabs/shared-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/wpxdevlabs/shared-kit/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40wpxdev%2Fshared-kit.svg?label=%40wpxdev%2Fshared-kit)](https://www.npmjs.com/package/@wpxdev/shared-kit)
[![TypeScript](https://img.shields.io/badge/TypeScript-ready-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

A reusable React and TypeScript toolkit for building consistent application and WordPress plugin interfaces. It combines locally owned shadcn/ui components, hooks, utilities, and opt-in styles in focused packages that can be installed separately or through one umbrella package.

## Highlights

- Locally owned shadcn/ui source that can be reviewed and updated deliberately.
- Direct, tree-shakable entry points for components, hooks, and utilities.
- Package-owned CSS variables use the `--wpxdev-*` namespace.
- Global styles and the `.wpxdev-root` reset remain opt-in.
- Custom compositions live separately from registry-managed UI components.
- Automated Changesets releases with npm Trusted Publishing and provenance.

## Packages

| Package | Purpose | Documentation |
| --- | --- | --- |
| [`@wpxdev/shared-kit`](https://www.npmjs.com/package/@wpxdev/shared-kit) | Umbrella entry point for the complete toolkit | [Package README](./packages/shared-kit/README.md) |
| [`@wpxdev/components`](https://www.npmjs.com/package/@wpxdev/components) | Accessible React components built from locally owned shadcn/ui source | [Package README](./packages/components/README.md) |
| [`@wpxdev/hooks`](https://www.npmjs.com/package/@wpxdev/hooks) | Reusable React hooks | [Package README](./packages/hooks/README.md) |
| [`@wpxdev/styles`](https://www.npmjs.com/package/@wpxdev/styles) | CSS variables, scoped reset, utilities, and SCSS source | [Package README](./packages/styles/README.md) |
| [`@wpxdev/utils`](https://www.npmjs.com/package/@wpxdev/utils) | Dependency-free TypeScript utilities | [Package README](./packages/utils/README.md) |

## Quick start

Install the complete toolkit with its React peer dependencies:

```bash
pnpm add @wpxdev/shared-kit react react-dom
```

Import only the APIs and styles your application needs:

```tsx
import { Button } from "@wpxdev/shared-kit/components/button";
import { useMediaQuery } from "@wpxdev/shared-kit/hooks/use-media-query";
import { clamp } from "@wpxdev/shared-kit/utils/clamp";
import "@wpxdev/shared-kit/styles.css";

export function Toolbar() {
  const compact = useMediaQuery("(max-width: 48rem)");
  const visibleItems = clamp(compact ? 2 : 5, 1, 5);

  return <Button>Show {visibleItems} items</Button>;
}
```

Applications that need only part of the toolkit can install a focused package instead:

```bash
pnpm add @wpxdev/components react react-dom
```

```tsx
import { Button } from "@wpxdev/components/button";
import "@wpxdev/components/styles.css";
```

## Imports

Every package supports a root entry point, while commonly used APIs also have focused entry points:

```tsx
import { Button, Dialog } from "@wpxdev/components";
import { Button as FocusedButton } from "@wpxdev/components/button";
import { useDebouncedValue } from "@wpxdev/hooks/use-debounced-value";
import { cn } from "@wpxdev/utils/cn";
```

Focused imports make dependencies explicit and help consumers include only what they use.

## Styling and isolation

Component styles are opt-in and should be imported once at the application entry point:

```css
@import "@wpxdev/components/styles.css";
```

The standalone styles package supports compiled CSS, individual layers, and authored SCSS:

```css
@import "@wpxdev/styles/tokens.css";
@import "@wpxdev/styles/reset.css";
```

```scss
@use "@wpxdev/styles/index.scss";
```

Package-owned custom properties use names such as `--wpxdev-color-primary`. Wrap plugin interfaces in `.wpxdev-root` when applying the scoped reset so host WordPress admin styles are not changed globally.

## Components and customization

Registry-managed shadcn/ui components live in [`packages/components/src/components/ui`](./packages/components/src/components/ui). Keep product-specific variants, wrappers, and multi-component patterns in [`packages/components/src/components/composed`](./packages/components/src/components/composed) so future shadcn updates do not overwrite custom work.

The intended workflow is:

1. Update or add the base shadcn component under `components/ui`.
2. Preserve its standard public API and focused package export.
3. Add project-specific behavior under `components/composed`.
4. Import composed components explicitly where an application needs them.

## Repository structure

```text
shared-kit/
├── packages/
│   ├── components/   React and shadcn/ui components
│   ├── hooks/        Reusable React hooks
│   ├── shared-kit/   Umbrella package and focused re-exports
│   ├── styles/       CSS and SCSS foundations
│   └── utils/        Dependency-free utilities
├── ai-skills/        Reusable coding-agent instructions
└── .changeset/       Release intent and changelog entries
```

## Development

This repository uses pnpm workspaces. Install dependencies and run the complete validation suite from the repository root:

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm test
```

During local development, workspace consumers can depend on packages without publishing them:

```json
{
  "dependencies": {
    "@wpxdev/components": "workspace:*",
    "@wpxdev/utils": "workspace:*"
  }
}
```

## Adding a package

1. Copy the structure of the closest existing package under `packages/`.
2. Use an `@wpxdev/*` package name and define explicit `exports`.
3. Add repository metadata pointing to `wpxdevlabs/shared-kit` and the package directory.
4. Include source code, tests where applicable, and a package-level README.
5. Run the full validation suite and add a Changeset for publishable work.

## Releases

Every pull request that changes a published package must describe its release impact:

```bash
pnpm changeset
```

Use `pnpm changeset --empty` only for package-file changes that intentionally require no version bump. After changes reach `main`:

Pushing a working branch automatically opens a draft pull request targeting `main` if none exists. The automation excludes `main`, `changeset-release/**`, and `dependabot/**` and leaves existing PRs unchanged. GitHub Actions must be allowed to create pull requests in the repository settings.

Open work-in-progress pull requests as drafts. CI, CodeQL, and secret scanning skip draft PRs and run when they are marked ready for review; later pushes to ready PRs rerun checks. Automated Changesets version PRs open as drafts.

Regular pull requests run typechecks and tests, with a small hooks build required by the tests. The `changeset-release/main` version pull request also runs the full package build. CI does not repeat these checks after merging; the release workflow builds the publishable packages.

1. Changesets creates or updates the `chore: version packages` pull request.
2. Merging that pull request publishes each changed package to npm.
3. npm Trusted Publishing signs provenance through GitHub Actions OIDC.
4. GitHub receives a separate release for each published package, named `@wpxdev/<package>@<version>`, with its changelog, npm version link, and install command.

Package versions remain independent, and package-specific Git tags provide exact source traceability.

## Security

Please report vulnerabilities privately according to the [security policy](./.github/SECURITY.md). Do not disclose suspected vulnerabilities in public issues or discussions.

## AI skills

Reusable agent instructions live in [`ai-skills/`](./ai-skills/README.md). The animation collection supports Claude Code, Codex, Cursor, Gemini, Antigravity, and Windsurf.
