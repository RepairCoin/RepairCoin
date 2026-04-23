/**
 * No-Show SQL Integration Tests
 *
 * Exercises the actual SQL of the three no-show mutation paths against
 * a real Postgres instance:
 *   - NoShowPolicyService.recordSuccessfulAppointment / checkTierReset
 *   - SuspensionLiftService.processSuspensionLifts
 *   - DisputeController.reverseNoShowPenalty
 *
 * This suite catches the class of bug that the unit tests cannot:
 * column typos, broken CASE mappings, malformed RETURNING, empty-policy
 * edge cases, and so on.
 *
 * Enablement: set TEST_DATABASE_URL in backend/.env.test (picked up by
 * tests/setup.ts) or in the shell. When unset, the whole suite skips.
 * NEVER point it at a production DB — the suite writes rows and deletes
 * them via a `0xtest_` address prefix.
 */

// IMPORTANT: set DATABASE_URL before any service import that transitively
// pulls in getSharedPool(). The pool is lazy and reads process.env once.
const testDbUrl = process.env.TEST_DATABASE_URL;
if (testDbUrl) {
  process.env.DATABASE_URL = testDbUrl;
}

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { Pool } from 'pg';
import { NoShowPolicyService } from '../../src/services/NoShowPolicyService';
import { SuspensionLiftService } from '../../src/services/SuspensionLiftService';
import { reverseNoShowPenalty } from '../../src/domains/ServiceDomain/controllers/DisputeController';
import { getSharedPool, closeSharedPool } from '../../src/utils/database-pool';

const d = testDbUrl ? describe : describe.skip;
const TEST_SHOP_ID = 'integration-test-shop';
const ADDRESS_PREFIX = '0xtest_'; // lowercase for consistent LIKE matching

function uniqueAddress(): string {
  const suffix = Math.random().toString(16).slice(2, 10);
  return `${ADDRESS_PREFIX}${suffix}`.toLowerCase();
}

d('No-Show SQL Integration', () => {
  let pool: Pool;
  let schemaReady = false;

  beforeAll(async () => {
    pool = getSharedPool();

    // Verify required tables exist before running destructive writes.
    const { rows } = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('customers', 'no_show_history', 'shop_no_show_policy', 'notifications')
    `);
    const tables = rows.map(r => r.table_name);
    const required = ['customers', 'no_show_history', 'shop_no_show_policy', 'notifications'];
    const missing = required.filter(t => !tables.includes(t));

    if (missing.length > 0) {
      console.warn(`Integration suite: missing tables ${missing.join(', ')} — tests will bail out`);
      return;
    }

    // Seed a shop_no_show_policy row so the cascade SQL's threshold subquery
    // returns a row. Idempotent via ON CONFLICT. No FK to shops was enforced
    // at suite authoring time (see migration 065); if a FK landed later and
    // blocks this insert, remove the ON CONFLICT or add a shops row first.
    await pool.query(
      `INSERT INTO shop_no_show_policy (shop_id, deposit_reset_after_successful)
       VALUES ($1, 3)
       ON CONFLICT (shop_id) DO NOTHING`,
      [TEST_SHOP_ID]
    );

    schemaReady = true;
  });

  afterAll(async () => {
    if (schemaReady) {
      await pool.query(`DELETE FROM shop_no_show_policy WHERE shop_id = $1`, [TEST_SHOP_ID]);
    }
    await closeSharedPool();
  });

  afterEach(async () => {
    if (!schemaReady) return;
    await pool.query(`DELETE FROM notifications WHERE LOWER(receiver_address) LIKE $1`, [`${ADDRESS_PREFIX}%`]);
    await pool.query(`DELETE FROM no_show_history WHERE LOWER(customer_address) LIKE $1`, [`${ADDRESS_PREFIX}%`]);
    await pool.query(`DELETE FROM customers WHERE LOWER(address) LIKE $1`, [`${ADDRESS_PREFIX}%`]);
  });

  /** Seed a customer row with the specific tier/count state a test needs. */
  async function seedCustomer(address: string, fields: {
    no_show_count: number;
    no_show_tier: string;
    successful_appointments_since_tier3?: number;
    deposit_required?: boolean;
    booking_suspended_until?: Date | null;
    last_no_show_at?: Date | null;
  }): Promise<void> {
    await pool.query(
      `INSERT INTO customers (
         address, no_show_count, no_show_tier,
         successful_appointments_since_tier3, deposit_required,
         booking_suspended_until, last_no_show_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        address,
        fields.no_show_count,
        fields.no_show_tier,
        fields.successful_appointments_since_tier3 ?? 0,
        fields.deposit_required ?? false,
        fields.booking_suspended_until ?? null,
        fields.last_no_show_at ?? null
      ]
    );
  }

  async function loadCustomer(address: string): Promise<any> {
    const { rows } = await pool.query(`SELECT * FROM customers WHERE address = $1`, [address]);
    return rows[0];
  }

  // ============================================================
  // Cascade reset — NoShowPolicyService
  // ============================================================
  describe('NoShowPolicyService.recordSuccessfulAppointment', () => {
    it('warning + counter=2 + successful appointment → normal with full reset', async () => {
      if (!schemaReady) return;
      const addr = uniqueAddress();
      await seedCustomer(addr, {
        no_show_count: 5,
        no_show_tier: 'warning',
        successful_appointments_since_tier3: 2,
        last_no_show_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
      });

      const service = new NoShowPolicyService();
      await service.recordSuccessfulAppointment(addr);

      const row = await loadCustomer(addr);
      expect(row.no_show_tier).toBe('normal');
      expect(row.no_show_count).toBe(0);
      expect(row.last_no_show_at).toBeNull();
      expect(row.successful_appointments_since_tier3).toBe(0);
      expect(row.deposit_required).toBe(false);
    });

    it('caution + counter=2 + successful appointment → warning (count preserved)', async () => {
      if (!schemaReady) return;
      const addr = uniqueAddress();
      const originalLastNoShow = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      await seedCustomer(addr, {
        no_show_count: 5,
        no_show_tier: 'caution',
        successful_appointments_since_tier3: 2,
        last_no_show_at: originalLastNoShow
      });

      const service = new NoShowPolicyService();
      await service.recordSuccessfulAppointment(addr);

      const row = await loadCustomer(addr);
      expect(row.no_show_tier).toBe('warning');
      expect(row.no_show_count).toBe(5); // unchanged at intermediate steps
      expect(row.successful_appointments_since_tier3).toBe(0);
      expect(row.last_no_show_at).toEqual(originalLastNoShow);
    });

    it('counter not yet at threshold → only increments, no tier drop', async () => {
      if (!schemaReady) return;
      const addr = uniqueAddress();
      await seedCustomer(addr, {
        no_show_count: 5,
        no_show_tier: 'caution',
        successful_appointments_since_tier3: 0
      });

      const service = new NoShowPolicyService();
      await service.recordSuccessfulAppointment(addr);

      const row = await loadCustomer(addr);
      expect(row.no_show_tier).toBe('caution');
      expect(row.successful_appointments_since_tier3).toBe(1);
    });

    it('tier=normal is untouched', async () => {
      if (!schemaReady) return;
      const addr = uniqueAddress();
      await seedCustomer(addr, {
        no_show_count: 0,
        no_show_tier: 'normal',
        successful_appointments_since_tier3: 0
      });

      const service = new NoShowPolicyService();
      await service.recordSuccessfulAppointment(addr);

      const row = await loadCustomer(addr);
      expect(row.no_show_tier).toBe('normal');
      expect(row.successful_appointments_since_tier3).toBe(0);
    });
  });

  // ============================================================
  // Suspension lift — SuspensionLiftService
  // ============================================================
  describe('SuspensionLiftService.processSuspensionLifts', () => {
    it('suspended + booking_suspended_until in the past → cascades to deposit_required', async () => {
      if (!schemaReady) return;
      const addr = uniqueAddress();
      await seedCustomer(addr, {
        no_show_count: 5,
        no_show_tier: 'suspended',
        booking_suspended_until: new Date(Date.now() - 60 * 60 * 1000),
        deposit_required: true
      });

      const service = new SuspensionLiftService();
      const report = await service.processSuspensionLifts();

      expect(report.customersLifted).toBeGreaterThanOrEqual(1);

      const row = await loadCustomer(addr);
      expect(row.no_show_tier).toBe('deposit_required');
      expect(row.booking_suspended_until).toBeNull();
      expect(row.successful_appointments_since_tier3).toBe(0);
      expect(row.deposit_required).toBe(true);
    });

    it('suspended + booking_suspended_until still in the future → untouched', async () => {
      if (!schemaReady) return;
      const addr = uniqueAddress();
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);
      await seedCustomer(addr, {
        no_show_count: 5,
        no_show_tier: 'suspended',
        booking_suspended_until: futureDate,
        deposit_required: true
      });

      const service = new SuspensionLiftService();
      await service.processSuspensionLifts();

      const row = await loadCustomer(addr);
      expect(row.no_show_tier).toBe('suspended');
      expect(row.booking_suspended_until).toEqual(futureDate);
    });
  });

  // ============================================================
  // Dispute reversal — DisputeController.reverseNoShowPenalty
  // ============================================================
  describe('reverseNoShowPenalty', () => {
    it('marks the history row reversed and recomputes customer count/tier', async () => {
      if (!schemaReady) return;
      const addr = uniqueAddress();
      await seedCustomer(addr, {
        no_show_count: 2,
        no_show_tier: 'caution'
      });

      // Seed two history rows; we'll reverse only the first.
      const { rows: insertedRows } = await pool.query(
        `INSERT INTO no_show_history (
           customer_address, order_id, service_id, shop_id,
           scheduled_time, marked_by
         )
         VALUES
           ($1, gen_random_uuid(), gen_random_uuid(), $2, NOW() - INTERVAL '3 days', 'SYSTEM'),
           ($1, gen_random_uuid(), gen_random_uuid(), $2, NOW() - INTERVAL '1 day',  'SYSTEM')
         RETURNING id`,
        [addr, TEST_SHOP_ID]
      );
      const firstHistoryId = insertedRows[0].id;

      await reverseNoShowPenalty(pool, addr, TEST_SHOP_ID, firstHistoryId);

      const reversedRow = await pool.query(
        `SELECT notes FROM no_show_history WHERE id = $1`, [firstHistoryId]
      );
      expect(reversedRow.rows[0].notes).toMatch(/\[DISPUTE_REVERSED\]/);

      const customer = await loadCustomer(addr);
      expect(customer.no_show_count).toBe(1);
      expect(customer.no_show_tier).toBe('warning');
    });
  });
});
