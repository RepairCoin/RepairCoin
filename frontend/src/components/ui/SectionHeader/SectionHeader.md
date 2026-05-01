# SectionHeader

A header component with two style variants. Action elements render inline on `sm`+ screens and collapse behind a 3-dot kebab menu on mobile.

## Import

```tsx
import { SectionHeader } from "@/components/ui/SectionHeader";
```

## Variants

| Variant     | Use for                                  | Title style                        | Heading element |
| ----------- | ---------------------------------------- | ---------------------------------- | --------------- |
| `"page"`    | Top-of-page header (one per page)        | `text-xl sm:text-2xl` white bold   | `<h1>`          |
| `"section"` | Sub-section header inside a card/panel   | `text-sm sm:text-base` yellow bold | `<h3>`          |

Default is `"section"`.

## Props

| Prop        | Type                          | Required | Description                                                              |
| ----------- | ----------------------------- | -------- | ------------------------------------------------------------------------ |
| `variant`   | `"page" \| "section"`         | no       | Style preset. Defaults to `"section"`.                                   |
| `icon`      | `LucideIcon`                  | no       | Icon component rendered before the title (yellow).                       |
| `title`     | `string`                      | yes      | Heading text.                                                            |
| `subtitle`  | `ReactNode`                   | no       | Supporting text below the title. Accepts JSX for inline highlights.      |
| `action`    | `ReactNode`                   | no       | Right-aligned controls. Inline on `sm`+, collapses to kebab on mobile.   |
| `className` | `string`                      | no       | Extra classes appended to the root container.                            |

## Examples

### Page header with primary action

```tsx
import { Plus } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";

<SectionHeader
  variant="page"
  title="Appointment Calendar"
  subtitle="View and manage your bookings"
  action={
    <button className="px-4 py-2 bg-[#FFCC00] text-black rounded-lg flex items-center gap-2">
      <Plus className="w-4 h-4" />
      Book Appointment
    </button>
  }
/>
```

### Section header with icon and filter tabs

```tsx
import { Users } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { FilterTabs } from "@/components/shop/groups/shared";

<SectionHeader
  icon={Users}
  title="Group Members"
  action={
    <FilterTabs
      options={filterOptions}
      value={activeFilter}
      onChange={setActiveFilter}
    />
  }
/>
```

### Section header with subtitle, no action

```tsx
import { Coins } from "lucide-react";

<SectionHeader
  icon={Coins}
  title="RCN Allocations"
  subtitle="Manage your group token backing"
/>
```

### Subtitle with inline highlight

```tsx
<SectionHeader
  variant="page"
  title="Service Bookings"
  subtitle={
    <>Showing bookings for <span className="text-[#FFCC00]">{serviceName}</span></>
  }
/>
```

## Mobile behavior

When `action` is provided:

- **`sm`+ (≥ 640px):** action renders inline on the right.
- **Mobile (< 640px):** action is hidden and replaced by a `<MoreVertical>` kebab button. Tapping it opens a dropdown panel that contains the action element. Clicks outside the panel close it.

The same `action` ReactNode is rendered in both places — keep it self-contained (no portals, no layout that depends on parent width) so it works in either context.

## When to use which variant

- One `variant="page"` per page, at the top.
- Use `variant="section"` (default) for headers inside cards, panels, or tab content. Multiple per page is fine.
- If a sub-section needs its own visual weight (e.g. a major card with no surrounding page header), `variant="page"` is acceptable, but prefer wrapping content in a card and using `"section"` for consistency.
