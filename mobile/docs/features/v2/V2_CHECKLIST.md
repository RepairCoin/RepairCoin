# V2 Figma Redesign — Implementation Checklist

> **Status — visual-fidelity pass done, typecheck-clean.** All 4 screens now
> match the V2 Figma: white `ServiceCard`, shared gold-gradient header, V2 Home
> (Quick-Actions tiles, photo-style category grid, **Nearby Shops** + **Upcoming
> Bookings** wired to real data). Remaining tsc errors are pre-existing baseline
> (booking/reschedule/service-group), none from this work.
>
> Known data follow-ups (UI shipped, real fields pending): category photos,
> Nearby-Shops distance/rating, real booked-count, `reviewsSubmitted`, AI endpoint.


Reuse-first build of 4 V2 screens (home, My Account, Per Industry Page, Notifications).
Strategy: modify existing components, extract affected pieces into shared components.
For V2 elements without backend data yet, build reusable UI now with props + placeholder
data; wire real fields later.

Reference PNGs live beside this file in `mobile/docs/features/v2/`.

---

## Phase 1 — Shared primitives (build first, unblock all screens)

- [x] `shared/components/ui/Badge.tsx` — generic pill `{ label, icon?, tone: trending|discount|group|rank|neutral }`; replaces inline pills in `ServiceCard` + `CampaignCard`
- [x] `shared/components/ui/SectionHeader.tsx` — "Title …… See All" row; `title` + optional `onSeeAll`
- [x] `shared/components/ui/MenuRow.tsx` — icon + label + chevron row; `icon`, `label`, `onPress`, `rightSlot?`
- [x] `shared/components/ui/StatsRow.tsx` — 4-col divider stat block; data-driven `items: {value, label}[]`
- [x] `shared/components/ui/HorizontalCarousel.tsx` — horizontal FlatList + SectionHeader wrapper
- [x] `shared/components/ui/GradientHeader.tsx` — gold→black gradient top bar (title/back/right + custom children); used by all 4 screens

## Phase 2 — Enrich shared `ServiceCard` (`shared/components/shared/ServiceCard.tsx`)

**Restyled to the V2 white card** (white bg, black text, product image, 5-star
row, shop-name sub-label, red rank/group pills, location). Applies everywhere the
shared card is used (services tab, favorites, trending, home, per-industry).
All new props optional + default off so existing callers are untouched.
- [x] Grid variant → V2 white card; `shopName?` prop; list variant unchanged
- [x] `originalPrice?: number` → strikethrough price + derived `% OFF`
- [x] `discountLabel?: string` → discount pill (fallback to derived % OFF)
- [x] `showGroupReward?: boolean` → "Bonus Group Reward" gift pill
- [x] `rankBadge?: string` → "#1 Trending Service" pill
- [x] `bookingCount?: number` → "(N booked)" next to rating
- [x] `location?: string` → address line + pin icon in footer
- [x] Refactor inline pill markup to use shared `Badge` (trending badge → `Badge`)
- [ ] Verify Trending/Services/Favorites/Recently-Viewed still render unchanged (runtime smoke — typecheck clean, props default off)

## Phase 3 — My Account (`feature/customer/profile/screens/CustomerAccountScreen.tsx`)

- [x] Gold-gradient `GradientHeader` ("My Account" + gold gear) replacing the flat header
- [x] Replace hand-rolled tier pill (local `TIER_CONFIG`) with shared `<TierBadge>`
- [x] Replace inline stat block with `StatsRow`, relabel to V2: Rewards Balance / Successful Bookings / Referred Friends / Reviews Submitted
- [x] "Reviews Submitted" → placeholder `0` (wire later; no backend field)
- [x] Add "Member Since" under name/badge (uses existing `customer.joinDate`)
- [x] Replace Account-Details rows with `MenuRow` list: Tier Progress, My QR Code, Refer a Friend, Refer a Shop (placeholder→referral), Support (placeholder→messages)

## Phase 4 — Per Industry Page (NEW screen)

- [x] `feature/services/services-main/screens/customer/CategoryServicesScreen.tsx`
- [x] Route `app/(dashboard)/customer/service/category/[category]/index.tsx`
- [x] Gold-gradient `GradientHeader` with search + hamburger; category title in black body below
- [x] `SearchInput` + filter/hamburger button (reuse `ServicesTabContent` pattern)
- [x] Cards pass `shopName` + `shopAddress` (location) so white cards match Figma
- [x] Category title via `shared/utilities/getCategoryLabel.ts`
- [x] 2-col `FlatList` of enriched `ServiceCard` (heart; discount/rank/group/location props ready, awaiting data)
- [x] Data: reuse services query via `useServicesTab(initialCategory)` (new optional param)
- [ ] (Optional) extract shared 2-col grid renderer shared with `ServicesTabContent` / `TrendingServicesScreen` / `FavoritesTabContent`

## Phase 5 — Home (`feature/home/screens/customer/CustomerHomeScreen.tsx` + `components/customer/index.tsx`)

- [x] Gold-gradient header (`GradientHeader`) — logo + "Welcome back! {name}" + avatar + message/notification bells
- [x] `AiSearchBar.tsx` (NEW) — "Ask FixFlow anything.." + mic; placeholder route (TODO wire AI)
- [x] Quick Actions → V2 set: `QuickActions.tsx` (NEW) flat tiles: Gift Token / QR Code / Redeem / My Bookings (dropped old balance ActionCard)
- [x] Trending → enriched white `ServiceCard` (shop name + booked count); dropped Recently-Viewed / Services / Campaigns from V2 home
- [x] `AiRecommendedSection.tsx` (NEW) — carousel; placeholder data (services feed) until recommend endpoint
- [x] `CategoryGrid.tsx` (NEW) — square tiles from `shared/constants/service-categories.ts`; tile → per-category route (real photos = follow-up)
- [x] `NearbyShopsSection.tsx` (NEW) — image-top cards from `useGetShops` (distance/rating = follow-up)
- [x] `UpcomingBookingsList.tsx` (NEW) — wired to `useMyAppointmentsQuery` (90-day window)

## Phase 6 — Notifications (`feature/notification/screens/NotificationScreen.tsx`)

- [x] Gold-gradient `GradientHeader` (back chevron + centered "Notifications") replacing `AppHeader`
- [x] Date grouping: Today / Yesterday / dated sections (new `utils/notificationGrouping.ts`)
- [x] Switch `FlatList` → `SectionList` + `NotificationSectionHeader.tsx` (NEW)
- [x] Date-bucket helper; keep `formatDistanceToNow` for row time
- [x] Tabs → V2 All / AI Assistant / Updates: `TabType` updated + category filter in `useNotifications.ts`
- [x] Count badge on "All" (shows total count per V2 "All 12")
- [x] Restyle `NotificationCard` to circular colored icon + right-aligned time (reuse `notificationHelpers.tsx`)

## Cross-cutting / verification

- [ ] Bottom nav `CustomFooter.tsx` — verify icon parity with V2 (no rebuild; runtime)
- [x] `TierBadge` adoption removes duplicate customer-side tier config
- [x] `cd mobile && npx tsc --noEmit` — no new errors (8 remaining are pre-existing baseline)
- [ ] `npx expo start --clear` — smoke test all 4 screens vs PNGs
- [ ] Regression: existing services grids + home carousels still render (runtime)

## Follow-ups (wire real data later)

- [ ] Backend: service `originalPrice`/discount, `groupReward` flag, `bookingCount`
- [ ] Backend: customer `reviewsSubmitted` stat
- [ ] Backend: AI-recommended services endpoint
- [ ] Define destinations for "Refer a Shop" + "Support"
