# Subscription Guard Shows "Shop Suspended" for Pending Applications

## Priority: High
## Status: Completed
## Assignee: Deo
## Completed Date: February 2, 2026

## Problem

When a new shop signs up and is awaiting admin approval, the top banner correctly shows "Application Pending Approval" but the `SubscriptionGuard` overlay incorrectly displays "Shop Suspended" with the red suspended message.

## Root Cause

The `useSubscriptionStatus` hook (`frontend/src/hooks/useSubscriptionStatus.ts`) treated `active === false` as "suspended" without distinguishing between:
- **Pending shops**: `active=false, verified=false, no suspendedAt` (new shops awaiting approval)
- **Suspended shops**: `active=false, verified=true, suspendedAt set` (admin-suspended shops)

The hook's `ShopData` interface didn't include `verified`, so it couldn't differentiate the two states.

## Fix Applied

### File: `frontend/src/hooks/useSubscriptionStatus.ts`
1. Added `verified` field to the `ShopData` interface
2. Added `isPending` to the `SubscriptionStatus` interface and return value
3. Changed pending detection: `isPending = operational_status === 'pending' OR (verified === false && no suspendedAt)`
4. Changed suspended detection: excludes pending shops — only suspended if `hasSuspension` or `active === false` with `verified !== false`
5. Moved `isPending` message priority above `isPaused`/`isExpired`/`isNotQualified` in the status message chain

### File: `frontend/src/components/shop/SubscriptionGuard.tsx`
1. Added `verified` field to the local `ShopData` interface
2. Added `isPending` check as first condition in `BlockedOverlay.getTitle()` — returns "Application Pending Approval"
3. Added `isPending` check in `SubscriptionWarningBanner.getTitle()`
4. Added yellow color theme for pending state (`bg-yellow-500/20`, `text-yellow-400`)

## Verification Matrix

| Scenario | isPending | isSuspended | canOperate | Title | Color | Status |
|----------|-----------|-------------|------------|-------|-------|--------|
| New pending shop | true | false | false | Application Pending Approval | Yellow | Verified |
| Suspended by admin | false | true | false | Shop Suspended | Red | Verified |
| Paused by admin | false | false | false | Subscription Paused | Orange | Verified |
| Self-cancelled (in period) | false | false | true | No overlay (warning only) | - | Verified |
| Cancelled (period ended) | false | false | false | Subscription Expired | Red | Verified |
| Active operational shop | false | false | true | No overlay | - | Verified |
