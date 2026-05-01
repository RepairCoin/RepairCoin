# PageTabs

A page-level tab navigation bar with Lucide icons, labels, and optional badges. Active tab is white-on-black, inactive is dark with a subtle border. Tabs wrap to multiple rows on `sm`+ and scroll horizontally on mobile.

## Import

```tsx
import { PageTabs } from "@/components/ui/PageTabs";
import type { PageTab } from "@/components/ui/PageTabs";
```

## Props

| Prop          | Type                | Required | Description                                                |
| ------------- | ------------------- | -------- | ---------------------------------------------------------- |
| `tabs`        | `PageTab<T>[]`      | yes      | Tabs to render.                                            |
| `activeTab`   | `T`                 | yes      | Currently selected tab key.                                |
| `onTabChange` | `(key: T) => void`  | yes      | Called when a tab is clicked.                              |
| `className`   | `string`            | no       | Extra classes appended to the root container.              |

### `PageTab<T>`

| Field      | Type          | Required | Description                                       |
| ---------- | ------------- | -------- | ------------------------------------------------- |
| `key`      | `T`           | yes      | Stable identifier — used as the React key and the value passed to `onTabChange`. |
| `label`    | `string`      | yes      | Visible text label.                               |
| `icon`     | `LucideIcon`  | yes      | Icon component rendered before the label.        |
| `hasBadge` | `boolean`     | no       | Show a red dot after the label (for unread / pending indicators). |

The generic `T` lets the consumer narrow the key to a string-literal union for type-safe `activeTab` / `onTabChange`.

## Example

```tsx
import { useState } from "react";
import { BookOpen, Users, Coins, FileText, Activity } from "lucide-react";
import { PageTabs } from "@/components/ui/PageTabs";
import type { PageTab } from "@/components/ui/PageTabs";

type Tab = "overview" | "members" | "operations" | "transactions" | "analytics";

const tabs: PageTab<Tab>[] = [
  { key: "overview", label: "Overview", icon: BookOpen },
  { key: "members", label: "Members", icon: Users, hasBadge: true },
  { key: "operations", label: "Token Operations", icon: Coins },
  { key: "transactions", label: "Transactions", icon: FileText },
  { key: "analytics", label: "Analytics", icon: Activity },
];

export function Example() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  return (
    <PageTabs
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    />
  );
}
```

## Mobile behavior

- **`sm`+ (≥ 640px):** tabs wrap to multiple rows when they exceed the available width.
- **Mobile (< 640px):** tabs render in a single row that scrolls horizontally. Use `scrollbar-hide` (already applied) to keep the bar clean.

## When to use

- Page-level navigation between top-level views inside a single page (e.g. group detail tabs, dashboard sections).
- For pill-style filter chips inside a card or `SectionHeader` action slot, use [`FilterTabs`](../../shop/groups/shared/FilterTabs.tsx) instead.
- For modal/inline tabs with Radix primitives, use the shadcn [`tabs`](../tabs.tsx) component.
