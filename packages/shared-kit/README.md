# @wpxdev/shared-kit

The convenient entry point for the complete WPXDev frontend toolkit.

```tsx
import { Button, clamp, useMediaQuery } from "@wpxdev/shared-kit";

export function Example() {
  const compact = useMediaQuery("(max-width: 48rem)");

  return (
    <div data-compact={compact || undefined}>
      <Button>Continue</Button>
      <span>{clamp(12, 0, 10)}</span>
    </div>
  );
}
```

Import the compiled component styles once at the application entry point:

```css
@import "@wpxdev/shared-kit/styles.css";
```

Install focused packages such as `@wpxdev/utils` directly when an application does not need the full toolkit.

Tree-shakable direct entry points are also available:

```tsx
import { Button } from "@wpxdev/shared-kit/components/button";
import { Dialog } from "@wpxdev/shared-kit/components/dialog";
import { useMediaQuery } from "@wpxdev/shared-kit/hooks/use-media-query";
import { clamp } from "@wpxdev/shared-kit/utils/clamp";
```

Reusable autosave APIs are available from `@wpxdev/shared-kit/hooks/autosave`,
and Lucide icons from `@wpxdev/shared-kit/icons`. See the hooks and components package
READMEs for integration contracts.
