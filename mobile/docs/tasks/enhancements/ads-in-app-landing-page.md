# Feature: In-App Ad Landing Page (native twin of /l/:campaignId)

**Status:** In Progress
**Priority:** Medium
**Est. Effort:** 3-4 hrs
**Created:** 2026-07-31
**Updated:** 2026-07-31

---

## Problem / Goal

Sponsored cards shipped in the services grid (see `sponsored-ad-cards-trending.md`), but tapping
one went straight to a service detail or shop profile screen. Off-platform ad clicks (Meta,
Google) land somewhere completely different — the web landing page at
`https://staging.repaircoin.ai/l/:campaignId?utm_campaign=:campaignId` — which carries the offer,
the trust signals and, crucially, the **lead form**.

So an in-app tap was worth strictly less than a Meta click: no offer copy, no urgency, no lead
captured, nothing attributable back to the campaign beyond the click log.

Goal: give the in-app tap the same destination as an off-platform click — a native landing screen
built from the same data, posting to the same lead endpoint.

## Analysis

- **The data already exists and is public.** `GET /ads/landing/:campaignId`
  (`LandingController.getCampaignLanding`) needs no auth and returns everything the web page
  renders: shop name, brand kit colors/logo, hero image, offer headline/subhead, urgency text,
  benefit bullets, rating + review count, one testimonial, promoted services, opt-in call-now
  phone. Every enrichment is null-safe server-side, so all fields are optional at render.
- **Leads have one intake path.** The web form posts to public `POST /ads/leads/webform` →
  `LeadAttributionService.attribute()`, which resolves the campaign from `campaignId` or
  `utm_campaign` and dedupes by phone within 24h. Reusing it means an app lead and a Meta lead for
  the same person collapse into one record instead of double-counting.
- **UTMs have no source on native.** The web form captures them from the URL. The app has no URL,
  so it stamps its own (`utm_source: repaircoin_app`, `utm_medium: in_app_ad`) — this is what
  makes in-app leads separable from paid-click leads in reporting.
- **The Meta Pixel is web-only.** `pixelId` comes back from the API but there is no native
  equivalent of the `fbq` PageView/Lead pair, so it is deliberately unused. Kept on the type so the
  shape matches the API.
- **`AdPlacement.target` is now unused for navigation.** Every tap goes to the landing page. The
  target's service is still reachable — it appears in the landing page's promoted-services list,
  which (unlike the static web tiles) deep-links into the app's service detail screen.

## Implementation

### Mobile

| File | Change |
|------|--------|
| `feature/services/services/service.interface.ts` | `AdLandingData`, `AdLandingService`, `AdLandingResponse`, `AdLeadInput` |
| `feature/services/services/ads.services.ts` | `getLanding()`, `submitLead()` |
| `shared/config/queryClient.ts` | `queryKeys.adLanding(campaignId)` |
| `feature/services/services-main/feature-tab/hooks/useFeatureTabQuery.ts` | `useAdLandingQuery`, `useSubmitAdLeadMutation` |
| `feature/services/services-main/feature-tab/components/AdLeadForm.tsx` | NEW — native lead form (phone-first, prefilled) |
| `feature/services/services-main/screens/customer/AdLandingScreen.tsx` | NEW — the landing screen |
| `app/(dashboard)/customer/ads/[campaignId]/index.tsx` | NEW — route |
| `feature/services/services-main/feature-tab/hooks/useAdPlacements.ts` | tap → `/customer/ads/:campaignId` |
| `shared/components/shared/SponsoredAdCard.tsx` | CTA label is offer-framed, not target-framed |

Screen composition mirrors `frontend/src/components/ads/LandingView.tsx` section for section:
shop header → trust chips → hero → urgency → headline/subhead → benefit bullets → lead form →
call-now → testimonial → promoted services → sticky CTA.

Native-only differences, all deliberate:

- Lead form prefills name/phone/email from the signed-in customer.
- Promoted services are tappable → `/customer/service/:id`.
- Sticky CTA scrolls to the form (no anchor links) and disappears once the lead is captured.
- No Meta Pixel.

## Follow-up: landing request hung, then errored (same day)

First device test: the screen spun for ~30s and the app logged
`[API Error] {"data": undefined, "status": undefined, "url": "/ads/landing/956d51bc-…"}` —
`status: undefined` means no response arrived at all.

Measured against the running dev server (DB is remote DigitalOcean staging):

| Call | Result |
|------|--------|
| `/api/ads/landing/<unknown id>` | 404 in **38ms** |
| `/api/ads/landing/<real id>`, cold pool | **no response**, socket closed at ~28s |
| same, next attempt | 200 in 15.2s |
| same, once pool warm | 200 in **145ms** |
| every individual SQL query, run standalone | **~40ms each**, 724ms total |

So the SQL was never slow. `getCampaignLanding` issued 8 queries with a 6-way `Promise.all`, which
forces the pool to open ~6 brand-new TLS connections to the remote DB *simultaneously* whenever the
pool is cold (observed `totalConnections: 2`). Connections losing that race die on the pool's 10s
connect timeout — `logs/error.log` is full of pg-pool `timeout exceeded when trying to connect` —
and the request then blows past the server's 30s request timeout, so the client gets nothing.

**Backend fix** (`LandingController.getCampaignLanding`): 8 queries → 2 sequential ones that reuse a
single pooled client. `CORE_SQL` pulls campaign + brief + shop in one row via `LEFT JOIN LATERAL …
LIMIT 1` (LATERAL, not a plain join, so a second brief or creative can't fan the row out);
`ENRICHMENT_SQL` pulls creative image + brand kit + review aggregate + testimonial + promoted
services as scalar subqueries, and degrades to defaults if it fails. Response shape is byte-for-byte
unchanged (886 B for this campaign, verified before and after). Now consistently **~75ms**.

**Mobile fix** (`AdLandingScreen`): the tapped sponsored card is already in the React Query cache, so
the screen paints its hero, shop name and headline immediately and only the request-dependent parts
wait; the failure state gained a "Try again" button instead of being a dead end.

**Not fixed — separate issue:** the dev backend process was at **2516 MB / 2577 MB heap** after ~2h
uptime (`GET /api/system/info`), which is what turned slow connection setup into full stalls. Worth
a restart plus a look at what leaks.

## Verification Checklist

- [x] `npx tsc --noEmit` introduces no new errors (mobile + backend)
- [x] `npx expo lint` introduces no new errors
- [x] `/ads/landing/:campaignId` returns an identical payload after the query consolidation
- [x] Endpoint responds in ~75ms across repeated calls
- [ ] Tap a sponsored card → landing screen opens with the campaign's copy and hero
- [ ] Screen matches the web page at `/l/:campaignId` for the same campaign
- [ ] Submitting the form creates a lead (admin Ads → Leads), attributed to the campaign
- [ ] Submitting twice from the same phone within 24h dedupes rather than double-counting
- [ ] Campaign with no brand kit / no reviews / no promoted services still renders
- [ ] Ended or deleted campaign shows "This offer isn't available right now."
- [ ] Call-now button dials, and is absent when the shop hasn't opted in

## Notes

- Depends on nothing new backend-side: both endpoints are already public and deployed.
- Not covered here: the marketplace tab's pull-to-refresh still does not refetch ads
  (`useServicesTab.handleRefresh` calls only `refetch()`, unlike `useTrendingServices`), so the
  sponsored card set is frozen for the 10-minute `staleTime`. Separate fix.
