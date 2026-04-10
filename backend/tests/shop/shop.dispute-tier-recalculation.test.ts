/**
 * Dispute Approval - Tier Recalculation Tests
 *
 * Tests that approving a no-show dispute correctly:
 * - Sets no_show_count to the effective count (not blind decrement)
 * - Recalculates no_show_tier based on effective count vs policy thresholds
 * - Sets booking_suspended_until when tier is 'suspended'
 * - Clears booking_suspended_until when tier drops below 'suspended'
 * - Syncs deposit_required flag with the recalculated tier
 * - Falls back to default thresholds when no shop policy exists
 *
 * Bug: Previously, dispute approval did `no_show_count - 1` (blind decrement)
 * and never recalculated the tier or set booking_suspended_until.
 * This caused customers to show "Suspended with 0 missed appointments".
 *
 * File under test: DisputeController.ts - reverseNoShowPenalty()
 * Endpoint: PUT /api/services/shops/:shopId/disputes/:id/approve
 */
import { describe, it, expect, beforeAll, beforeEach, jest, afterAll } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// ── Constants ──────────────────────────────────────────────────
const SHOP_ID = 'shop-tier-recalc-001';
const CUSTOMER_ADDRESS = '0xaaaa000000000000000000000000000000000001';
const DISPUTE_ID = 'dispute-tier-recalc-uuid-001';
const SHOP_WALLET = '0xbbbb000000000000000000000000000000000002';

// ── Mutable test state (set per-test via beforeEach) ───────────
// These are declared before jest.mock so the factory closures can capture them.
let mockEffectiveCount = 5;
let mockShopPolicy: Record<string, any> | null = null;
const mockQueries: Array<{ text: string; params: any[] }> = [];

// Default mock row for no_show_history lookup
const makeNoShowRow = (overrides: Record<string, any> = {}) => ({
  id: DISPUTE_ID,
  customer_address: CUSTOMER_ADDRESS,
  order_id: 'ord_test123',
  service_id: 'svc_test123',
  shop_id: SHOP_ID,
  scheduled_time: new Date('2026-04-01T10:00:00Z'),
  marked_no_show_at: new Date('2026-04-01T10:30:00Z'),
  marked_by: SHOP_WALLET,
  notes: null,
  grace_period_minutes: 15,
  customer_tier_at_time: 'suspended',
  disputed: true,
  dispute_status: 'pending',
  dispute_reason: 'I was present at the scheduled time but no one was available',
  dispute_submitted_at: new Date('2026-04-01T12:00:00Z'),
  dispute_resolved_at: null,
  dispute_resolved_by: null,
  dispute_resolution_notes: null,
  created_at: new Date('2026-04-01T10:30:00Z'),
  ...overrides,
});

/**
 * Query router: returns appropriate mock data based on the SQL being executed.
 */
function routeQuery(text: string, params: any[]): { rows: any[] } {
  const sql = text.replace(/\s+/g, ' ').trim();
  mockQueries.push({ text: sql, params });

  // Lookup no_show_history by id + shop_id (approveDispute entry point)
  if (sql.includes('SELECT * FROM no_show_history WHERE id =') && sql.includes('shop_id')) {
    return { rows: [makeNoShowRow()] };
  }

  // Update dispute_status to approved (RETURNING *)
  if (sql.includes('UPDATE no_show_history') && sql.includes("dispute_status = 'approved'")) {
    return { rows: [makeNoShowRow({ dispute_status: 'approved', dispute_resolved_at: new Date() })] };
  }

  // Mark notes with [DISPUTE_REVERSED]
  if (sql.includes('UPDATE no_show_history SET notes =') && sql.includes('DISPUTE_REVERSED')) {
    return { rows: [] };
  }

  // Count effective no-shows (the critical query)
  if (sql.includes('SELECT COUNT(*)') && sql.includes('no_show_history') && sql.includes('DISPUTE_REVERSED')) {
    return { rows: [{ effective_count: mockEffectiveCount }] };
  }

  // Shop no-show policy lookup
  if (sql.includes('shop_no_show_policy') && sql.includes('WHERE shop_id')) {
    return { rows: mockShopPolicy ? [mockShopPolicy] : [] };
  }

  // Customer update (the main assertion target)
  if (sql.includes('UPDATE customers') && sql.includes('no_show_count')) {
    return { rows: [] };
  }

  // Customer+shop join for email notification
  if (sql.includes('SELECT c.email') || sql.includes('FROM customers c')) {
    return { rows: [{ email: 'test@example.com', name: 'Test Customer', shop_name: 'Test Shop' }] };
  }

  // System settings table init
  if (sql.includes('system_settings') || sql.includes('CREATE TABLE')) {
    return { rows: [] };
  }

  // Default
  return { rows: [] };
}

// ── Mocks (hoisted by Jest, but closures capture the variables above) ──

jest.mock('../../src/repositories/ShopRepository', () => {
  return {
    ShopRepository: jest.fn().mockImplementation(() => ({
      getShop: jest.fn().mockImplementation(async () => ({
        shopId: 'shop-tier-recalc-001',
        walletAddress: '0xbbbb000000000000000000000000000000000002',
        name: 'Test Shop',
        status: 'active',
        isVerified: true,
      })),
      getShopByWallet: jest.fn().mockImplementation(async () => null),
    }))
  };
});

jest.mock('../../src/repositories/CustomerRepository', () => {
  return {
    CustomerRepository: jest.fn().mockImplementation(() => ({
      getCustomer: jest.fn().mockImplementation(async () => null),
    }))
  };
});

jest.mock('../../src/repositories/AdminRepository');
jest.mock('../../src/repositories/TransactionRepository');
jest.mock('../../src/repositories/TreasuryRepository');
jest.mock('../../src/repositories/RedemptionSessionRepository');
jest.mock('thirdweb');

jest.mock('../../src/utils/database-pool', () => ({
  __esModule: true,
  getSharedPool: () => ({
    query: jest.fn().mockImplementation(async (...args: any[]) => {
      const text = typeof args[0] === 'string' ? args[0] : args[0]?.text || '';
      const params = args[1] || [];
      return routeQuery(text, params);
    }),
    connect: jest.fn().mockImplementation(async () => ({
      query: jest.fn().mockImplementation(async () => ({ rows: [] })),
      release: jest.fn()
    })),
    end: jest.fn(),
    on: jest.fn(),
    totalCount: 5,
    idleCount: 5,
    waitingCount: 0
  }),
  getPoolStats: () => ({
    totalCount: 5,
    idleCount: 5,
    waitingCount: 0
  })
}));

jest.mock('../../src/services/EmailService', () => ({
  EmailService: jest.fn().mockImplementation(() => ({
    sendDisputeResolved: jest.fn().mockReturnValue(Promise.resolve()),
    sendDisputeSubmitted: jest.fn().mockReturnValue(Promise.resolve()),
    sendNoShowTier1Warning: jest.fn().mockReturnValue(Promise.resolve()),
    sendNoShowTier2Caution: jest.fn().mockReturnValue(Promise.resolve()),
    sendNoShowTier3DepositRequired: jest.fn().mockReturnValue(Promise.resolve()),
    sendNoShowTier4Suspended: jest.fn().mockReturnValue(Promise.resolve()),
  }))
}));

// ── Helpers ────────────────────────────────────────────────────

/**
 * Extracts the UPDATE customers query from the recorded mock queries.
 * This is the final query in reverseNoShowPenalty that sets count, tier, and suspension.
 */
function getCustomerUpdateQuery() {
  return mockQueries.find(q =>
    q.text.includes('UPDATE customers') && q.text.includes('no_show_count')
  );
}

// ── Tests ──────────────────────────────────────────────────────

describe('Dispute Approval - Tier Recalculation', () => {
  let app: any;
  const JWT_SECRET = 'test-secret-tier-recalc-32chars!';
  let shopToken: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.NODE_ENV = 'test';

    const RepairCoinApp = (await import('../../src/app')).default;
    const repairCoinApp = new RepairCoinApp();
    await repairCoinApp.initialize();
    app = repairCoinApp.app;

    shopToken = jwt.sign(
      { address: SHOP_WALLET, role: 'shop', shopId: SHOP_ID, type: 'access' },
      JWT_SECRET, { expiresIn: '24h' }
    );
  });

  afterAll(async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  beforeEach(() => {
    mockQueries.length = 0;
    mockEffectiveCount = 5;
    mockShopPolicy = null;
  });

  /** Helper to approve the dispute and return the response */
  async function approveDispute(notes: string) {
    return request(app)
      .put(`/api/services/shops/${SHOP_ID}/disputes/${DISPUTE_ID}/approve`)
      .set('Cookie', [`auth_token=${shopToken}`])
      .send({ resolutionNotes: notes });
  }

  // ============================================================
  // SECTION 1: Effective count replaces blind decrement
  // ============================================================
  describe('Effective count (not blind decrement)', () => {
    it('should set no_show_count to effective count, not decrement by 1', async () => {
      mockEffectiveCount = 5;
      mockShopPolicy = {
        caution_threshold: 2,
        deposit_threshold: 3,
        suspension_threshold: 5,
        suspension_duration_days: 30,
      };

      await approveDispute('Customer provided valid evidence');

      const updateQuery = getCustomerUpdateQuery();
      expect(updateQuery).toBeDefined();
      expect(updateQuery!.params[0]).toBe(5);
    });

    it('should set effective count to 0 when all disputes are reversed', async () => {
      mockEffectiveCount = 0;
      mockShopPolicy = {
        caution_threshold: 2,
        deposit_threshold: 3,
        suspension_threshold: 5,
        suspension_duration_days: 30,
      };

      await approveDispute('All no-shows were disputed and approved');

      const updateQuery = getCustomerUpdateQuery();
      expect(updateQuery).toBeDefined();
      expect(updateQuery!.params[0]).toBe(0);
    });

    it('should handle partial reversals correctly (7 total, 2 reversed = 5 effective)', async () => {
      mockEffectiveCount = 5;
      mockShopPolicy = {
        caution_threshold: 2,
        deposit_threshold: 3,
        suspension_threshold: 5,
        suspension_duration_days: 30,
      };

      await approveDispute('Reviewed evidence, approving this dispute');

      const updateQuery = getCustomerUpdateQuery();
      expect(updateQuery).toBeDefined();
      expect(updateQuery!.params[0]).toBe(5);
    });
  });

  // ============================================================
  // SECTION 2: Tier recalculation with shop policy
  // ============================================================
  describe('Tier recalculation with shop policy', () => {
    it('should set tier to "suspended" when effective count >= suspension threshold', async () => {
      mockEffectiveCount = 5;
      mockShopPolicy = {
        caution_threshold: 2,
        deposit_threshold: 3,
        suspension_threshold: 5,
        suspension_duration_days: 30,
      };

      await approveDispute('Approved but still at suspension threshold');

      const updateQuery = getCustomerUpdateQuery();
      expect(updateQuery).toBeDefined();
      expect(updateQuery!.params[1]).toBe('suspended');
    });

    it('should set tier to "deposit_required" when effective count drops below suspension', async () => {
      mockEffectiveCount = 4;
      mockShopPolicy = {
        caution_threshold: 2,
        deposit_threshold: 3,
        suspension_threshold: 5,
        suspension_duration_days: 30,
      };

      await approveDispute('Reversal brings count below suspension');

      const updateQuery = getCustomerUpdateQuery();
      expect(updateQuery).toBeDefined();
      expect(updateQuery!.params[1]).toBe('deposit_required');
    });

    it('should set tier to "caution" when effective count is at caution threshold', async () => {
      mockEffectiveCount = 2;
      mockShopPolicy = {
        caution_threshold: 2,
        deposit_threshold: 3,
        suspension_threshold: 5,
        suspension_duration_days: 30,
      };

      await approveDispute('Multiple reversals, now at caution level');

      const updateQuery = getCustomerUpdateQuery();
      expect(updateQuery).toBeDefined();
      expect(updateQuery!.params[1]).toBe('caution');
    });

    it('should set tier to "normal" when effective count is below all thresholds', async () => {
      mockEffectiveCount = 0;
      mockShopPolicy = {
        caution_threshold: 2,
        deposit_threshold: 3,
        suspension_threshold: 5,
        suspension_duration_days: 30,
      };

      await approveDispute('All no-shows reversed, back to normal');

      const updateQuery = getCustomerUpdateQuery();
      expect(updateQuery).toBeDefined();
      expect(updateQuery!.params[1]).toBe('normal');
    });
  });

  // ============================================================
  // SECTION 3: booking_suspended_until calculation
  // ============================================================
  describe('booking_suspended_until handling', () => {
    it('should set a future suspension date when tier remains "suspended"', async () => {
      mockEffectiveCount = 6;
      mockShopPolicy = {
        caution_threshold: 2,
        deposit_threshold: 3,
        suspension_threshold: 5,
        suspension_duration_days: 30,
      };

      const beforeRequest = Date.now();

      await approveDispute('Still above suspension threshold after reversal');

      const updateQuery = getCustomerUpdateQuery();
      expect(updateQuery).toBeDefined();

      const suspensionDate = updateQuery!.params[2];
      expect(suspensionDate).toBeInstanceOf(Date);

      // Should be ~30 days from now
      const expectedMin = beforeRequest + (29 * 24 * 60 * 60 * 1000);
      const expectedMax = beforeRequest + (31 * 24 * 60 * 60 * 1000);
      expect(suspensionDate.getTime()).toBeGreaterThan(expectedMin);
      expect(suspensionDate.getTime()).toBeLessThan(expectedMax);
    });

    it('should use shop policy suspension_duration_days for date calculation', async () => {
      mockEffectiveCount = 5;
      mockShopPolicy = {
        caution_threshold: 2,
        deposit_threshold: 3,
        suspension_threshold: 5,
        suspension_duration_days: 60,
      };

      const beforeRequest = Date.now();

      await approveDispute('Shop has 60-day suspension policy');

      const updateQuery = getCustomerUpdateQuery();
      expect(updateQuery).toBeDefined();

      const suspensionDate = updateQuery!.params[2];
      expect(suspensionDate).toBeInstanceOf(Date);

      // Should be ~60 days from now
      const expectedMin = beforeRequest + (59 * 24 * 60 * 60 * 1000);
      const expectedMax = beforeRequest + (61 * 24 * 60 * 60 * 1000);
      expect(suspensionDate.getTime()).toBeGreaterThan(expectedMin);
      expect(suspensionDate.getTime()).toBeLessThan(expectedMax);
    });

    it('should clear booking_suspended_until (null) when tier drops below suspended', async () => {
      mockEffectiveCount = 4;
      mockShopPolicy = {
        caution_threshold: 2,
        deposit_threshold: 3,
        suspension_threshold: 5,
        suspension_duration_days: 30,
      };

      await approveDispute('Count dropped below suspension, clearing suspension date');

      const updateQuery = getCustomerUpdateQuery();
      expect(updateQuery).toBeDefined();
      expect(updateQuery!.params[2]).toBeNull();
    });

    it('should clear booking_suspended_until when tier is "normal"', async () => {
      mockEffectiveCount = 0;
      mockShopPolicy = {
        caution_threshold: 2,
        deposit_threshold: 3,
        suspension_threshold: 5,
        suspension_duration_days: 30,
      };

      await approveDispute('All cleared, no suspension');

      const updateQuery = getCustomerUpdateQuery();
      expect(updateQuery).toBeDefined();
      expect(updateQuery!.params[2]).toBeNull();
    });
  });

  // ============================================================
  // SECTION 4: deposit_required flag sync
  // ============================================================
  describe('deposit_required flag sync', () => {
    it('should set deposit_required=true when tier is "deposit_required"', async () => {
      mockEffectiveCount = 3;
      mockShopPolicy = {
        caution_threshold: 2,
        deposit_threshold: 3,
        suspension_threshold: 5,
        suspension_duration_days: 30,
      };

      await approveDispute('At deposit threshold');

      const updateQuery = getCustomerUpdateQuery();
      expect(updateQuery).toBeDefined();
      expect(updateQuery!.params[3]).toBe(true);
    });

    it('should set deposit_required=true when tier is "suspended"', async () => {
      mockEffectiveCount = 5;
      mockShopPolicy = {
        caution_threshold: 2,
        deposit_threshold: 3,
        suspension_threshold: 5,
        suspension_duration_days: 30,
      };

      await approveDispute('Still suspended');

      const updateQuery = getCustomerUpdateQuery();
      expect(updateQuery).toBeDefined();
      expect(updateQuery!.params[3]).toBe(true);
    });

    it('should set deposit_required=false when tier is "caution"', async () => {
      mockEffectiveCount = 2;
      mockShopPolicy = {
        caution_threshold: 2,
        deposit_threshold: 3,
        suspension_threshold: 5,
        suspension_duration_days: 30,
      };

      await approveDispute('Below deposit threshold');

      const updateQuery = getCustomerUpdateQuery();
      expect(updateQuery).toBeDefined();
      expect(updateQuery!.params[3]).toBe(false);
    });

    it('should set deposit_required=false when tier is "normal"', async () => {
      mockEffectiveCount = 0;
      mockShopPolicy = {
        caution_threshold: 2,
        deposit_threshold: 3,
        suspension_threshold: 5,
        suspension_duration_days: 30,
      };

      await approveDispute('Fully cleared');

      const updateQuery = getCustomerUpdateQuery();
      expect(updateQuery).toBeDefined();
      expect(updateQuery!.params[3]).toBe(false);
    });
  });

  // ============================================================
  // SECTION 5: Default thresholds fallback
  // ============================================================
  describe('Default thresholds when no shop policy exists', () => {
    it('should use default thresholds (2/3/5) when shop has no policy', async () => {
      mockEffectiveCount = 4;
      mockShopPolicy = null;

      await approveDispute('Shop without custom policy');

      const updateQuery = getCustomerUpdateQuery();
      expect(updateQuery).toBeDefined();
      // 4 >= 3 (default deposit_threshold) but < 5 (default suspension_threshold)
      expect(updateQuery!.params[1]).toBe('deposit_required');
    });

    it('should use default suspension (30 days) when no policy and count >= 5', async () => {
      mockEffectiveCount = 5;
      mockShopPolicy = null;

      const beforeRequest = Date.now();

      await approveDispute('No policy, default suspension');

      const updateQuery = getCustomerUpdateQuery();
      expect(updateQuery).toBeDefined();
      expect(updateQuery!.params[1]).toBe('suspended');

      const suspensionDate = updateQuery!.params[2];
      expect(suspensionDate).toBeInstanceOf(Date);
      const expectedMin = beforeRequest + (29 * 24 * 60 * 60 * 1000);
      expect(suspensionDate.getTime()).toBeGreaterThan(expectedMin);
    });

    it('should set "normal" tier with defaults when effective count is 1', async () => {
      mockEffectiveCount = 1;
      mockShopPolicy = null;

      await approveDispute('Only one no-show left, below all defaults');

      const updateQuery = getCustomerUpdateQuery();
      expect(updateQuery).toBeDefined();
      // 1 < 2 (default caution_threshold) → normal
      expect(updateQuery!.params[1]).toBe('normal');
      expect(updateQuery!.params[2]).toBeNull();
      expect(updateQuery!.params[3]).toBe(false);
    });
  });

  // ============================================================
  // SECTION 6: Effective count query scope
  // ============================================================
  describe('Effective count query scope', () => {
    it('should count no-shows across all shops (global count)', async () => {
      mockEffectiveCount = 3;
      mockShopPolicy = {
        caution_threshold: 2,
        deposit_threshold: 3,
        suspension_threshold: 5,
        suspension_duration_days: 30,
      };

      await approveDispute('Testing global count scope');

      // Verify the effective count query does NOT filter by shop_id
      const countQuery = mockQueries.find(q =>
        q.text.includes('SELECT COUNT(*)') &&
        q.text.includes('no_show_history') &&
        q.text.includes('DISPUTE_REVERSED')
      );

      expect(countQuery).toBeDefined();
      // Should only have 1 param (customerAddress), not 2 (customerAddress + shopId)
      expect(countQuery!.params).toHaveLength(1);
    });
  });

  // ============================================================
  // SECTION 7: Custom shop policy thresholds
  // ============================================================
  describe('Custom shop policy thresholds', () => {
    it('should respect custom caution threshold', async () => {
      mockEffectiveCount = 4;
      mockShopPolicy = {
        caution_threshold: 5,
        deposit_threshold: 8,
        suspension_threshold: 12,
        suspension_duration_days: 30,
      };

      await approveDispute('Custom high thresholds');

      const updateQuery = getCustomerUpdateQuery();
      expect(updateQuery).toBeDefined();
      // 4 < 5 (custom caution) → normal
      expect(updateQuery!.params[1]).toBe('normal');
    });

    it('should respect custom suspension threshold', async () => {
      mockEffectiveCount = 8;
      mockShopPolicy = {
        caution_threshold: 3,
        deposit_threshold: 5,
        suspension_threshold: 10,
        suspension_duration_days: 14,
      };

      await approveDispute('High suspension threshold');

      const updateQuery = getCustomerUpdateQuery();
      expect(updateQuery).toBeDefined();
      // 8 >= 5 (deposit) but < 10 (suspension) → deposit_required
      expect(updateQuery!.params[1]).toBe('deposit_required');
      expect(updateQuery!.params[2]).toBeNull();
    });
  });
});
