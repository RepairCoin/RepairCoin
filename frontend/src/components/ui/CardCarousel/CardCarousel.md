# CardCarousel

A responsive card layout that scrolls horizontally on mobile (snap-x carousel with pagination dots) and snaps into a CSS grid from the `sm` breakpoint up. Wraps each child in a sizing div so consumers just pass plain card elements as direct children.

## Import

```tsx
import { CardCarousel } from "@/components/ui/CardCarousel";
```

## Behavior

- **Mobile (`< sm`)**: horizontal flex with `snap-x snap-mandatory`. Each card occupies `itemWidthClassName` (default `w-[80%]`) so the next card peeks. Scrollbar is hidden via a scoped CSS module — no global rule.
- **`sm` and up**: switches to `display: grid` with the columns supplied via `gridClassName` (default `sm:grid-cols-2 lg:grid-cols-4`).
- **Active tracking**: an `IntersectionObserver` watches the items and keeps the most-visible one as the active index. Inactive cards fade to `opacity-70` on mobile.
- **Pagination dots**: rendered below the carousel on mobile. The active dot stretches to a pill; clicking a dot smoothly scrolls to that card. Hidden automatically when there is only one child.
- **Mouse wheel**: while the cursor is over a scrollable carousel, vertical or horizontal wheel input is translated into horizontal scroll. The handler no-ops on `sm+` (grid mode) where the container is no longer overflowing.

## Props

| Prop                      | Type        | Required | Description                                                                                       |
| ------------------------- | ----------- | -------- | ------------------------------------------------------------------------------------------------- |
| `children`                | `ReactNode` | yes      | Card elements rendered as direct slides. Each is wrapped in a sizing div internally.              |
| `gridClassName`           | `string`    | no       | Tailwind grid-column classes applied from the `sm` breakpoint up. Defaults to `"sm:grid-cols-2 lg:grid-cols-4"`. |
| `itemWidthClassName`      | `string`    | no       | Tailwind width class for each card while in mobile carousel mode. Defaults to `"w-[80%]"`.        |
| `mobileEdgeBleedClassName`| `string`    | no       | Negative-margin / padding pair that lets the scroll track bleed past the parent's mobile padding. Defaults to `"-mx-4 px-4 sm:mx-0 sm:px-0"` (matches a `p-4` parent). |
| `showDots`                | `boolean`   | no       | Toggle the mobile pagination dots. Defaults to `true`.                                            |
| `activeDotClassName`      | `string`    | no       | Tailwind color class applied to the active dot. Defaults to `"bg-[#FFCC00]"`.                     |
| `inactiveDotClassName`    | `string`    | no       | Tailwind color class applied to inactive dots. Defaults to `"bg-gray-600 hover:bg-gray-500"`.     |
| `className`               | `string`    | no       | Extra classes appended to the outer wrapper.                                                      |

## Usage

```tsx
<CardCarousel>
  {cards.map((card) => (
    <div key={card.label} className="bg-[#1e1f22] rounded-lg p-3 sm:p-4 h-full">
      …
    </div>
  ))}
</CardCarousel>
```

Apply `h-full` (or equivalent) to the cards so they stretch evenly inside the wrapper div on `sm+` grid layouts.

## Notes

- Parent's mobile padding should match `mobileEdgeBleedClassName`. The default is tuned for a `p-4` parent on mobile; for a `p-6` parent, pass `mobileEdgeBleedClassName="-mx-6 px-6 sm:mx-0 sm:px-0"`.
- Scrollbar hiding lives in `CardCarousel.module.css` so the rule cannot leak to other components that use a `scrollbar-hide` utility class.
