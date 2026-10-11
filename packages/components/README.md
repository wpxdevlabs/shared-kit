# @wpxdev/components

Accessible React UI primitives built from locally owned shadcn/ui source.

```tsx
import { Button } from "@wpxdev/components";
import "@wpxdev/components/styles.css";

export function Actions() {
  return (
    <div>
      <Button>Save</Button>
      <Button variant="outline">Cancel</Button>
    </div>
  );
}
```

The Button also has a focused entry point:

```tsx
import { Button } from "@wpxdev/components/button";
```

All installed shadcn primitives have focused entry points using the component filename:

```tsx
import { Dialog, DialogContent } from "@wpxdev/components/dialog";
import { Sidebar, SidebarProvider } from "@wpxdev/components/sidebar";
```

Registry-owned primitives live in `src/components/ui`. Keep custom wrappers, variants, and product-specific compositions in `src/components/composed` so shadcn updates cannot overwrite them.

Import the compiled stylesheet once at the application or WordPress-plugin entry point. Components use standard Tailwind classes, while the design tokens owned by this package retain the `wpxdev` namespace (for example, `--wpxdev-color-primary`).

Add future shadcn components from this package directory so the CLI reads `components.json`:

```sh
pnpm exec shadcn add dialog
```

Use `.wpxdev-dark` on a containing element to activate the dark theme.

## Icons

Import Lucide icons and types from `@wpxdev/components/icons` or
`@wpxdev/shared-kit/icons`. Import only the named glyphs you use.

Use the existing shadcn Button for icon actions:

```tsx
import { Button } from "@wpxdev/components/button";
import { Check } from "@wpxdev/components/icons";

<Button type="button" size="icon" aria-label="Apply preferences">
  <Check aria-hidden="true" />
</Button>
```

Compose the existing Spinner inside Button for loading states and set `disabled`
and `aria-busy` on the button. For links use an anchor styled with `buttonVariants`.
