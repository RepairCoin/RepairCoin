# Prevent Migration Data Gaps Strategy

**Date**: 2026-03-03
**Status**: Completed
**Priority**: Medium (preventive measure)
**Related**: [time-slot-not-working-fix-strategy.md](./time-slot-not-working-fix-strategy.md)

---

## Problem Statement

Shops can end up with missing `shop_time_slot_config` rows due to two failure modes:

1. **Migration-to-code gap**: Migration 008 seeded configs for existing shops, but shops created between the migration run and the deployment of `createDefaultTimeSlotConfig` (commit `26a38a4b`, Jan 5 2026) had no mechanism to get configs.
2. **Silent creation failures**: `createDefaultTimeSlotConfig()` in `ShopRepository.createShop()` catches and swallows all errors, so shops created after the fix can still end up without configs if the INSERT fails (e.g., missing UNIQUE constraint, DB connection issue).

This pattern can repeat for any new table that requires a row per shop.

---

## Solution: Belt and Suspenders (Startup Validation + Lazy Init)

### Layer 1: Startup Validation

Run on every server boot. Catches all gaps from migrations, silent failures, manual DB inserts, or any other cause.

**File**: New file `backend/src/services/StartupDataIntegrityService.ts`

```typescript
async function ensureAllShopsHaveTimeSlotConfig(): Promise<void> {
  // Auto-create missing shop_time_slot_config rows
  const configResult = await pool.query(`
    INSERT INTO shop_time_slot_config (shop_id)
    SELECT s.shop_id FROM shops s
    WHERE NOT EXISTS (
      SELECT 1 FROM shop_time_slot_config tc WHERE tc.shop_id = s.shop_id
    )
    RETURNING shop_id;
  `);

  if (configResult.rowCount > 0) {
    logger.warn('Auto-created missing time slot configs on startup', {
      count: configResult.rowCount,
      shopIds: configResult.rows.map(r => r.shop_id)
    });
  }

  // Auto-create missing shop_availability rows (Mon-Fri 9am-6pm, weekends closed)
  const availResult = await pool.query(`
    INSERT INTO shop_availability (shop_id, day_of_week, is_open, open_time, close_time)
    SELECT s.shop_id, d.day,
      CASE WHEN d.day BETWEEN 1 AND 5 THEN true ELSE false END,
      CASE WHEN d.day BETWEEN 1 AND 5 THEN '09:00:00'::time ELSE NULL END,
      CASE WHEN d.day BETWEEN 1 AND 5 THEN '18:00:00'::time ELSE NULL END
    FROM shops s
    CROSS JOIN generate_series(0, 6) AS d(day)
    WHERE NOT EXISTS (
      SELECT 1 FROM shop_availability sa
      WHERE sa.shop_id = s.shop_id AND sa.day_of_week = d.day
    )
    ON CONFLICT (shop_id, day_of_week) DO NOTHING
    RETURNING shop_id, day_of_week;
  `);

  if (availResult.rowCount > 0) {
    const uniqueShops = [...new Set(availResult.rows.map(r => r.shop_id))];
    logger.warn('Auto-created missing availability rows on startup', {
      rowsCreated: availResult.rowCount,
      shopsAffected: uniqueShops.length,
      shopIds: uniqueShops
    });
  }
}
```

**Integration point**: Call from `app.ts` during server initialization, after DB connection is established but before accepting requests.

### Layer 2: Lazy Initialization on Read

Safety net between deploys. If a shop is created and the startup validation hasn't run yet, the first booking attempt auto-creates the config.

**File**: `backend/src/domains/ServiceDomain/services/AppointmentService.ts`

```typescript
// Replace the throw with auto-creation (lines 35-38)
let config = await this.appointmentRepo.getTimeSlotConfig(shopId);
if (!config) {
  logger.warn('No time slot config found, auto-creating defaults', { shopId });
  config = await this.appointmentRepo.updateTimeSlotConfig({ shopId });
}
```

Also handle missing availability:

```typescript
let availability = await this.appointmentRepo.getShopAvailability(shopId);
if (availability.length === 0) {
  logger.warn('No availability found, auto-creating defaults', { shopId });
  for (let day = 0; day <= 6; day++) {
    const isOpen = day >= 1 && day <= 5;
    await this.appointmentRepo.updateShopAvailability({
      shopId,
      dayOfWeek: day,
      isOpen,
      openTime: isOpen ? '09:00:00' : null,
      closeTime: isOpen ? '18:00:00' : null,
    });
  }
  availability = await this.appointmentRepo.getShopAvailability(shopId);
}
```

### Layer 3: Escalate Creation Errors (Not Silent)

**File**: `backend/src/repositories/ShopRepository.ts` (lines 250-253)

```typescript
} catch (error) {
  // Escalate from warn to error — this WILL cause booking failures
  logger.error('CRITICAL: Failed to create default time slot config for new shop', {
    shopId,
    error: error instanceof Error ? error.message : error,
    stack: error instanceof Error ? error.stack : undefined
  });
  // Don't throw — shop creation still succeeds, lazy init will recover
}
```

---

## Implementation Plan

### Step 1: Create StartupDataIntegrityService (20 min)
- New service file with `ensureAllShopsHaveTimeSlotConfig()`
- Extensible for future per-shop data integrity checks
- Call from `app.ts` during initialization

### Step 2: Add Lazy Init to AppointmentService (15 min)
- Auto-create config if missing in `getAvailableTimeSlots()`
- Auto-create availability if missing
- Auto-create config if missing in `getPublicTimeSlotConfig()` controller

### Step 3: Escalate Error Logging (5 min)
- Change `logger.warn` to `logger.error` in `createDefaultTimeSlotConfig` catch block

### Step 4: Test (15 min)
- Delete a test shop's config, verify startup validation recreates it
- Delete a test shop's config, verify lazy init recreates on booking attempt
- Create a new shop, verify config exists
- Simulate DB error during shop creation, verify error is logged loudly

---

## Files to Modify

| File | Change |
|------|--------|
| `backend/src/services/StartupDataIntegrityService.ts` | **New file** — startup validation |
| `backend/src/app.ts` | Call startup validation during init |
| `backend/src/domains/ServiceDomain/services/AppointmentService.ts` | Lazy init for config + availability |
| `backend/src/domains/ServiceDomain/controllers/AppointmentController.ts` | Return defaults in `getPublicTimeSlotConfig` |
| `backend/src/repositories/ShopRepository.ts` | Escalate error log level |

---

## Why Not a Database Trigger?

A PostgreSQL trigger (`AFTER INSERT ON shops`) would be the strongest guarantee, but:
- Hides business logic outside the application code
- Harder to test and debug
- The belt-and-suspenders approach (startup + lazy init) covers the same cases
- If we ever need a trigger, it can be added later as a migration

The startup + lazy init combo is sufficient — every server boot and every read path self-heals.
