# V2 Figma Redesign — Implementation Checklist

Reuse-first build of 4 V2 screens (home, My Account, Per Industry Page, Notifications).
Strategy: modify existing components, extract affected pieces into shared components.
For V2 elements without backend data yet, build reusable UI now with props + placeholder
data; wire real fields later.

Reference PNGs live beside this file in `mobile/docs/features/v2/`.

---

## Phase 1 — Shared primitives (build first, unblock all screens)

- [ ] `shared/components/ui/Badge.tsx` — generic pill `{ label, icon?, tone: trending|discount|group|rank|neutral }`; replaces inline pills in `ServiceCard` + `CampaignCard`
- [ ] `shared/components/ui/SectionHeader.tsx` — "Title …… See All" row; `title` + optional `onSeeAll`
- [ ] `shared/components/ui/MenuRow.tsx` — icon + label + chevron row; `icon`, `label`, `onPress`, `rightSlot?`
- [ ] `shared/components/ui/StatsRow.tsx` — 4-col divider stat block; data-driven `items: {value, label}[]`
- [ ] `shared/components/ui/HorizontalCarousel.tsx` — horizontal FlatList + SectionHeader wrapper

## Phase 2 — Enrich shared `ServiceCard` (`shared/components/shared/ServiceCard.tsx`)

All new props optional + default off so existing callers are untouched.
- [ ] `originalPrice?: number` → strikethrough price + derived `% OFF`
- [ ] `discountLabel?: string` → discount pill (fallback to derived % OFF)
- [ ] `showGroupReward?: boolean` → "Bonus Group Reward" gift pill
- [ ] `rankBadge?: string` → "#1 Trending Service" pill
- [ ] `bookingCount?: number` → "(N booked)" next to rating
- [ ] `location?: string` → address line + pin icon in footer
- [ ] Refactor inline pill markup to use shared `Badge`
- [ ] Verify Trending/Services/Favorites/Recently-Viewed still render unchanged

## Phase 3 — My Account (`feature/customer/profile/screens/CustomerAccountScreen.tsx`)

- [ ] Replace hand-rolled tier pill (local `TIER_CONFIG`, L27-59/137-164) with shared `<TierBadge>`
- [ ] Replace inline stat block (L170-198) with `StatsRow`, relabel to V2: Rewards Balance / Successful Bookings / Referred Friends / Reviews Submitted
- [ ] "Reviews Submitted" → placeholder `customer?.reviewsSubmitted ?? 0` (wire later)
- [ ] Add "Member Since" under name/badge (uses existing `customer.joinDate`)
- [ ] Replace Account-Details rows with `MenuRow` list: Tier Progress, My QR Code, Refer a Friend, Refer a Shop (new route), Support (new route)

## Phase 4 — Per Industry Page (NEW screen)

- [ ] `feature/services/services-main/screens/customer/CategoryServicesScreen.tsx`
- [ ] Route `app/(dashboard)/customer/service/category/[category]/index.tsx`
- [ ] `SearchInput` + filter/hamburger button (reuse `ServicesTabContent` pattern)
- [ ] Category title via `shared/utilities/getCategoryLabel.ts`
- [ ] 2-col `FlatList` of enriched `ServiceCard` (heart, discount, rank, group, location)
- [ ] Data: reuse services query filtered by single category
- [ ] (Optional) extract shared 2-col grid renderer shared with `ServicesTabContent` / `TrendingServicesScreen` / `FavoritesTabContent`

## Phase 5 — Home (`feature/home/screens/customer/CustomerHomeScreen.tsx` + `components/customer/index.tsx`)

- [ ] `AiSearchBar.tsx` (NEW) — "Ask FixFlow anything.." + mic; route to AI/chat or placeholder
- [ ] Quick Actions → V2 set: Gift Token / QR Code / Redeem / My Bookings (uncomment Gift Token ~L219-223)
- [ ] Trending → `HorizontalCarousel` + enriched `ServiceCard`
- [ ] `AiRecommendedSection.tsx` (NEW) — carousel; placeholder data until recommend endpoint
- [ ] `CategoryGrid.tsx` (NEW) — 4-col image tiles from `shared/constants/service-categories.ts`; tile → per-category route
- [ ] `NearbyShopsSection.tsx` (NEW) — `HorizontalCarousel` of `ShopCard` (reuse find-shop card/query)
- [ ] `UpcomingBookingsList.tsx` (NEW) — reuse existing bookings query

## Phase 6 — Notifications (`feature/notification/screens/NotificationScreen.tsx`)

- [ ] Date grouping: build Today / Yesterday / dated sections in `hooks/ui/useNotifications.ts`
- [ ] Switch `FlatList` → `SectionList` + `NotificationSectionHeader.tsx` (NEW)
- [ ] Add date-bucket helper (shared utils); keep `formatDistanceToNow` for row time
- [ ] Tabs → V2 All / AI Assistant / Updates: extend `TabType` in `types.ts` + filter in `useNotifications.ts`
- [ ] Keep unread badge count on "All"
- [ ] Restyle `NotificationCard` to circular colored icon + right-aligned time (reuse `notificationHelpers.tsx`)

## Cross-cutting / verification

- [ ] Bottom nav `CustomFooter.tsx` — verify icon parity with V2 (no rebuild)
- [ ] `TierBadge` adoption removes duplicate customer-side tier config
- [ ] `cd mobile && npx tsc --noEmit` clean
- [ ] `npx expo start --clear` — smoke test all 4 screens vs PNGs
- [ ] Regression: existing services grids + home carousels still render

## Follow-ups (wire real data later)

- [ ] Backend: service `originalPrice`/discount, `groupReward` flag, `bookingCount`
- [ ] Backend: customer `reviewsSubmitted` stat
- [ ] Backend: AI-recommended services endpoint
- [ ] Define destinations for "Refer a Shop" + "Support"
