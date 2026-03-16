# Feature: Campaign-Specific Waitlist Pages with Visit Tracking

**Status**: Completed
**Priority**: High
**Date**: 2026-03-16
**Requested by**: Marketing team

## Description

Create campaign-specific waitlist pages using a single dynamic route template, with visit tracking and conversion analytics so the marketing team can measure campaign performance.

- `/waitlist` — Default/direct waitlist page
- `/waitlist/organic` — Organic marketing campaigns
- `/waitlist/fb` — Paid Facebook/Instagram ad campaigns

## Architecture: Single Template, Config-Driven

All waitlist pages (including `/waitlist`) render the same `WaitlistTemplate` component with different config. The source is automatically determined by which page the user lands on — no query parameters needed.

```tsx
// frontend/src/app/waitlist/[source]/config.ts
export const campaignConfig: Record<string, CampaignConfig> = {
  direct: { source: 'direct', headline: '...', ... },
  organic: { source: 'organic', headline: '...', ... },
  fb: { source: 'fb', headline: '...', ... },
};
```

```tsx
// frontend/src/app/waitlist/[source]/page.tsx
export default async function CampaignWaitlistPage({ params }) {
  const config = campaignConfig[params.source];
  if (!config) notFound();
  return <WaitlistTemplate config={config} />;
}
```

```tsx
// frontend/src/app/waitlist/page.tsx (uses same template)
export default function WaitlistPage() {
  return <WaitlistTemplate config={campaignConfig.direct} />;
}
```

## Requirements

### Frontend

**New files:**
- `frontend/src/app/waitlist/[source]/page.tsx` — dynamic route with `generateStaticParams` and `generateMetadata`
- `frontend/src/app/waitlist/[source]/config.ts` — campaign config per source (direct, organic, fb)
- `frontend/src/components/waitlist/WaitlistTemplate.tsx` — shared template component

**WaitlistTemplate:**
- Accepts config prop for headline, subtext, CTA text, meta tags
- Tracks page visit on mount (`POST /api/waitlist/track-visit`) with source auto-filled
- Passes `source` with form submission
- Contains all content sections (hero, stats, features, how it works, built for businesses, trust & security, industries, FAQ, final CTA, footer)
- Mobile-optimized

**`/waitlist` page:**
- Refactored to use `WaitlistTemplate` with `direct` config (single source of truth)

**Invalid sources:**
- `/waitlist/invalid-slug` → Next.js `notFound()` (404)

### Backend

**Database changes:**
- Migration `088`: Add `source` column to `waitlist` table (`VARCHAR(50)`, default `'direct'`), create `waitlist_page_views` table with `source`, `user_agent`, `referrer`, `created_at`
- Migration `089`: Drop unused UTM columns from both tables

**API changes:**
- Update `POST /api/waitlist/submit` — accept `source` field
- Add `POST /api/waitlist/track-visit` — public endpoint to record page views (accepts `source`)
- Update `GET /api/waitlist/stats` — include per-source breakdown and conversion rates (visits vs signups)

**WaitlistRepository updates:**
- `create()` — include `source` field in INSERT
- `getAll()` — support `source` filter parameter
- `getStats()` — add `bySource` counts and `campaignPerformance` array (visits, signups, conversion rate per source)
- `trackVisit()` — new method to insert page view records

### Admin Dashboard

**AdminWaitlistTab updates:**
- Source filter dropdown (All / Direct / Organic / Facebook)
- Source badge column on each waitlist entry
- Campaign Performance section showing visits, signups, and conversion rate per source with visual progress bars

## Files Created/Modified

### New Files
- `frontend/src/app/waitlist/[source]/page.tsx`
- `frontend/src/app/waitlist/[source]/config.ts`
- `frontend/src/components/waitlist/WaitlistTemplate.tsx`
- `backend/migrations/088_add_waitlist_campaign_tracking.sql`
- `backend/migrations/089_drop_waitlist_utm_columns.sql`
- `docs/guides/waitlist-campaign-guide.md`

### Modified Files
- `backend/src/controllers/WaitlistController.ts` — accept source, add trackVisit endpoint
- `backend/src/repositories/WaitlistRepository.ts` — source in queries, trackVisit method, updated getStats
- `backend/src/routes/waitlist.ts` — add track-visit route
- `frontend/src/app/waitlist/page.tsx` — refactored to use shared WaitlistTemplate
- `frontend/src/components/admin/tabs/AdminWaitlistTab.tsx` — source filter, badges, campaign performance

## Adding New Campaigns

To add a new campaign page (e.g. `/waitlist/tiktok`):

1. Add entry to `config.ts`:
```ts
tiktok: {
  source: 'tiktok',
  headline: 'Saw us on TikTok?',
  subtext: '...',
  ctaText: 'Join Now',
  demoCtaText: 'Get a Demo',
  metaTitle: '...',
  metaDescription: '...',
},
```
2. That's it — the dynamic route handles the rest.

## Conversion Tracking Flow

```
User clicks FB ad → /waitlist/fb
  → Page loads → POST /api/waitlist/track-visit { source: 'fb' }
  → User fills form → POST /api/waitlist/submit { ..., source: 'fb' }

Admin Dashboard:
  Facebook: 500 visits → 50 signups → 10% conversion
  Organic:  200 visits → 40 signups → 20% conversion
```
