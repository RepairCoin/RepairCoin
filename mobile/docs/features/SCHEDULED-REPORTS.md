# Scheduled Reports

## Overview

Scheduled Reports allow shop owners to configure automated email summaries of their shop's performance. Reports can be previewed before sending and delivered on a recurring schedule.

## Status

| Platform | Status |
|----------|--------|
| Frontend (Next.js) | Fully implemented |
| Backend API | Fully implemented |
| Mobile (React Native) | Not implemented |

## Features

### Report Configuration
- Enable / disable automated reports
- Set recipient email address
- Choose delivery frequency: `daily`, `weekly`, `monthly`
- Choose delivery time
- Select report sections to include (revenue, bookings, RCN activity, etc.)

### Preview
- Generate a preview of the report before it is sent
- Opens a modal with a live-rendered report preview

### Test Send
- Send a test email immediately to verify formatting and delivery

## Report Content

A typical report includes:
- Revenue summary for the period
- New bookings and completions
- RCN tokens issued and redeemed
- Top performing services
- Customer tier breakdown

## API Services

Frontend service: `frontend/src/services/api/reports.ts`

Key functions:
- `getReportSettings(shopId)` — fetch current settings
- `updateReportSettings(shopId, settings)` — save settings
- `previewReport(shopId)` — generate preview data
- `sendTestReport(shopId)` — trigger a test email

## Frontend Location

- Tab: `frontend/src/components/shop/tabs/ReportsTab.tsx`
- Preview modal: `frontend/src/components/shop/ReportPreviewModal.tsx`

## Related Docs

- [marketing-campaigns.md](marketing-campaigns.md) — manual email campaigns (different from automated reports)
