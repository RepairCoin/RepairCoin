# PO Suggestions (AI-Powered)

## Overview

The PO Suggestions feature automatically analyzes inventory usage patterns and recommends when and how much to reorder. It uses the last 30 days of usage data to calculate urgency and suggested quantities.

## Status

| Platform | Status |
|----------|--------|
| Frontend (Next.js) | Fully implemented |
| Backend API | Fully implemented |
| Mobile (React Native) | Not implemented |

## How It Works

1. Shop clicks "Generate" — the system scans all inventory items
2. For each item, it calculates:
   - Average daily usage (from adjustment history)
   - Current stock vs. low stock threshold
   - Days until stockout
   - Suggested reorder quantity (based on safety stock + days of supply)
3. Suggestions are created with an urgency level and priority score
4. Shop reviews suggestions and approves or rejects them
5. Approved suggestions can auto-create a Purchase Order

## Urgency Levels

| Level | Meaning |
|-------|---------|
| `critical` | Stockout imminent (days until stockout <= 3) |
| `high` | Running low soon (days <= 7) |
| `medium` | Below reorder point |
| `low` | Preventive reorder recommendation |

## Suggestion Statuses

| Status | Description |
|--------|-------------|
| `pending` | Awaiting shop decision |
| `approved` | Shop approved the suggestion |
| `rejected` | Shop rejected with reason |
| `expired` | Suggestion expired without action |
| `ordered` | A PO was created from this suggestion |

## Actions

- **Approve** — mark as approved, optionally auto-create a Purchase Order
- **Approve + Create PO** — approve and immediately generate a PO
- **Reject** — dismiss with a required reason

## Vendor Comparison

When multiple vendors can supply an item, the suggestion shows a comparison table:
- Unit cost and total cost per vendor
- Lead time (days) and estimated delivery date
- Historical performance score (0-100, based on on-time delivery, order completion, cancellation rate)
- Badges: "Best Value", "Fastest Delivery", "Preferred Vendor"
- Recommended vendor highlighted with a star badge

## Accuracy Tracking

The system tracks how accurate its suggestions were:
- After a suggestion is acted on, it can be assessed as accurate or inaccurate
- Auto-assessment runs on a schedule for expired suggestions
- Accuracy metrics available: approval rate, accuracy score, trend (improving/stable/declining)

## API Endpoints

Base path: `/api/inventory/suggestions`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/:shopId/generate` | Generate new suggestions |
| GET | `/:shopId` | Get suggestions (filter by urgency/status) |
| POST | `/:id/approve` | Approve suggestion |
| POST | `/:id/reject` | Reject suggestion |
| POST | `/expire` | Expire old suggestions (admin/scheduler) |
| POST | `/:id/assess-accuracy` | Assess suggestion accuracy |
| GET | `/:shopId/accuracy-metrics` | Get accuracy metrics for period |
| POST | `/auto-assess-accuracy` | Auto-assess expired suggestions (admin) |

## Frontend Location

- Component: `frontend/src/components/shop/inventory/POSuggestionsCard.tsx`
- Types: `frontend/src/types/inventory.ts` (lines 469–540)

## Backend Location

- Controller: `backend/src/domains/InventoryDomain/controllers/poSuggestionController.ts`
- Service: `backend/src/services/POSuggestionService.ts`
