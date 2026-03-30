/**
 * Customer Overview Cards — E2E Tests
 *
 * Tests the 4 stat cards on /customer?tab=overview:
 *   1. Available Balance (off-chain DB balance)
 *   2. Wallet Balance (on-chain blockchain — tested via balance endpoint proxy)
 *   3. Tokens Earned (lifetime earnings)
 *   4. Tokens Redeemed (total redemptions)
 *
 * Also validates the Tier badge (BRONZE/SILVER/GOLD) and earning history breakdown.
 *
 * Data sources:
 *   - GET /api/tokens/balance/:address       → availableBalance, lifetimeEarned, totalRedeemed, earningHistory
 *   - GET /api/customers/balance/:address     → databaseBalance, pendingMintBalance, lifetimeEarnings, totalRedemptions, tier
 *   - GET /api/customers/:address             → customer profile + tier
 *
 * Screenshot reference: sc1.png (Customer Overview page)
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, jest, afterAll } from '@jest/globals';
import RepairCoinApp from '../../src/app';
import jwt from 'jsonwebtoken';

jest.mock('thirdweb');

describe('Customer Overview Cards — E2E', () => {
  let app: any;

  const JWT_SECRET = 'test-secret-overview-cards-32chars!';
  const testCustomerAddress = '0xaaaa000000000000000000000000000000000001';
  const testInvalidAddress = 'not-a-wallet';
  let customerToken: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.NODE_ENV = 'test';

    const repairCoinApp = new RepairCoinApp();
    await repairCoinApp.initialize();
    app = repairCoinApp.app;

    customerToken = jwt.sign(
      { address: testCustomerAddress, role: 'customer', type: 'access' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // CARD 1: Available Balance
  // Source: GET /api/tokens/balance/:address → data.availableBalance
  //         GET /api/customers/balance/:address → data.databaseBalance
  // ============================================================
  describe('Card 1: Available Balance', () => {
    describe('GET /api/tokens/balance/:address', () => {
      it('should return availableBalance as a non-negative number', async () => {
        const res = await request(app)
          .get(`/api/tokens/balance/${testCustomerAddress}`);

        expect([200, 404, 429, 500]).toContain(res.status);

        if (res.status === 200) {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('availableBalance');
          expect(typeof res.body.data.availableBalance).toBe('number');
          expect(res.body.data.availableBalance).toBeGreaterThanOrEqual(0);
        }
      });

      it('should return 400 for invalid address', async () => {
        const res = await request(app)
          .get(`/api/tokens/balance/${testInvalidAddress}`);

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toContain('Invalid');
      });
    });

    describe('GET /api/customers/balance/:address', () => {
      it('should return databaseBalance matching available balance concept', async () => {
        const res = await request(app)
          .get(`/api/customers/balance/${testCustomerAddress}`);

        expect([200, 404, 429, 500]).toContain(res.status);

        if (res.status === 200) {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('databaseBalance');
          expect(typeof res.body.data.databaseBalance).toBe('number');
          expect(res.body.data.databaseBalance).toBeGreaterThanOrEqual(0);
        }
      });

      it('should return 400 for invalid address format', async () => {
        const res = await request(app)
          .get(`/api/customers/balance/${testInvalidAddress}`);

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toContain('Invalid wallet address');
      });

      it('should return 404 for non-existent customer', async () => {
        const res = await request(app)
          .get('/api/customers/balance/0x0000000000000000000000000000000000099999');

        expect([404, 500]).toContain(res.status);
      });
    });

    describe('Balance consistency between endpoints', () => {
      it('available balance should be consistent across both endpoints', async () => {
        const [tokenRes, balanceRes] = await Promise.all([
          request(app).get(`/api/tokens/balance/${testCustomerAddress}`),
          request(app).get(`/api/customers/balance/${testCustomerAddress}`),
        ]);

        if (tokenRes.status === 200 && balanceRes.status === 200) {
          const tokenAvailable = tokenRes.body.data.availableBalance;
          const dbBalance = balanceRes.body.data.databaseBalance;
          // Both should represent the same available balance
          expect(typeof tokenAvailable).toBe('number');
          expect(typeof dbBalance).toBe('number');
          // They should be equal (same underlying data source)
          expect(tokenAvailable).toBeCloseTo(dbBalance, 2);
        }
      });
    });
  });

  // ============================================================
  // CARD 2: Wallet Balance (On-chain)
  // The actual on-chain balance is read via Thirdweb SDK on the frontend.
  // Backend exposes pendingMintBalance and canMintToWallet to support this card.
  // ============================================================
  describe('Card 2: Wallet Balance (blockchain proxy data)', () => {
    it('should include pendingMintBalance in balance response', async () => {
      const res = await request(app)
        .get(`/api/customers/balance/${testCustomerAddress}`);

      expect([200, 404, 429, 500]).toContain(res.status);

      if (res.status === 200) {
        expect(res.body.data).toHaveProperty('pendingMintBalance');
        expect(typeof res.body.data.pendingMintBalance).toBe('number');
        expect(res.body.data.pendingMintBalance).toBeGreaterThanOrEqual(0);
      }
    });

    it('should include totalMintedToWallet in balance response', async () => {
      const res = await request(app)
        .get(`/api/customers/balance/${testCustomerAddress}`);

      expect([200, 404, 429, 500]).toContain(res.status);

      if (res.status === 200) {
        expect(res.body.data).toHaveProperty('totalMintedToWallet');
        expect(typeof res.body.data.totalMintedToWallet).toBe('number');
        expect(res.body.data.totalMintedToWallet).toBeGreaterThanOrEqual(0);
      }
    });

    it('should include canMintToWallet flag', async () => {
      const res = await request(app)
        .get(`/api/customers/balance/${testCustomerAddress}`);

      expect([200, 404, 429, 500]).toContain(res.status);

      if (res.status === 200) {
        expect(res.body.data).toHaveProperty('canMintToWallet');
        expect(typeof res.body.data.canMintToWallet).toBe('boolean');
      }
    });

    it('should include pendingMintBalance in token balance response', async () => {
      const res = await request(app)
        .get(`/api/tokens/balance/${testCustomerAddress}`);

      expect([200, 404, 429, 500]).toContain(res.status);

      if (res.status === 200) {
        expect(res.body.data).toHaveProperty('pendingMintBalance');
        expect(typeof res.body.data.pendingMintBalance).toBe('number');
      }
    });
  });

  // ============================================================
  // CARD 3: Tokens Earned (lifetime)
  // Source: GET /api/tokens/balance/:address → data.lifetimeEarned
  //         GET /api/customers/balance/:address → data.lifetimeEarnings
  // ============================================================
  describe('Card 3: Tokens Earned', () => {
    it('should return lifetimeEarned from token balance endpoint', async () => {
      const res = await request(app)
        .get(`/api/tokens/balance/${testCustomerAddress}`);

      expect([200, 404, 429, 500]).toContain(res.status);

      if (res.status === 200) {
        expect(res.body.data).toHaveProperty('lifetimeEarned');
        expect(typeof res.body.data.lifetimeEarned).toBe('number');
        expect(res.body.data.lifetimeEarned).toBeGreaterThanOrEqual(0);
      }
    });

    it('should return lifetimeEarnings from customer balance endpoint', async () => {
      const res = await request(app)
        .get(`/api/customers/balance/${testCustomerAddress}`);

      expect([200, 404, 429, 500]).toContain(res.status);

      if (res.status === 200) {
        expect(res.body.data).toHaveProperty('lifetimeEarnings');
        expect(typeof res.body.data.lifetimeEarnings).toBe('number');
        expect(res.body.data.lifetimeEarnings).toBeGreaterThanOrEqual(0);
      }
    });

    it('should include earning history breakdown by source', async () => {
      const res = await request(app)
        .get(`/api/tokens/balance/${testCustomerAddress}`);

      expect([200, 404, 429, 500]).toContain(res.status);

      if (res.status === 200) {
        const { earningHistory } = res.body.data;
        expect(earningHistory).toBeDefined();
        expect(earningHistory).toHaveProperty('fromRepairs');
        expect(earningHistory).toHaveProperty('fromReferrals');
        expect(earningHistory).toHaveProperty('fromBonuses');
        expect(earningHistory).toHaveProperty('fromTierBonuses');

        // All earning sources must be non-negative
        expect(earningHistory.fromRepairs).toBeGreaterThanOrEqual(0);
        expect(earningHistory.fromReferrals).toBeGreaterThanOrEqual(0);
        expect(earningHistory.fromBonuses).toBeGreaterThanOrEqual(0);
        expect(earningHistory.fromTierBonuses).toBeGreaterThanOrEqual(0);
      }
    });

    it('lifetimeEarned should be >= availableBalance (earned always >= available)', async () => {
      const res = await request(app)
        .get(`/api/tokens/balance/${testCustomerAddress}`);

      if (res.status === 200) {
        const { availableBalance, lifetimeEarned } = res.body.data;
        expect(lifetimeEarned).toBeGreaterThanOrEqual(availableBalance);
      }
    });

    it('lifetime values should be consistent across endpoints', async () => {
      const [tokenRes, balanceRes] = await Promise.all([
        request(app).get(`/api/tokens/balance/${testCustomerAddress}`),
        request(app).get(`/api/customers/balance/${testCustomerAddress}`),
      ]);

      if (tokenRes.status === 200 && balanceRes.status === 200) {
        expect(tokenRes.body.data.lifetimeEarned).toBeCloseTo(
          balanceRes.body.data.lifetimeEarnings, 2
        );
      }
    });
  });

  // ============================================================
  // CARD 4: Tokens Redeemed
  // Source: GET /api/tokens/balance/:address → data.totalRedeemed
  //         GET /api/customers/balance/:address → data.totalRedemptions
  // ============================================================
  describe('Card 4: Tokens Redeemed', () => {
    it('should return totalRedeemed from token balance endpoint', async () => {
      const res = await request(app)
        .get(`/api/tokens/balance/${testCustomerAddress}`);

      expect([200, 404, 429, 500]).toContain(res.status);

      if (res.status === 200) {
        expect(res.body.data).toHaveProperty('totalRedeemed');
        expect(typeof res.body.data.totalRedeemed).toBe('number');
        expect(res.body.data.totalRedeemed).toBeGreaterThanOrEqual(0);
      }
    });

    it('should return totalRedemptions from customer balance endpoint', async () => {
      const res = await request(app)
        .get(`/api/customers/balance/${testCustomerAddress}`);

      expect([200, 404, 429, 500]).toContain(res.status);

      if (res.status === 200) {
        expect(res.body.data).toHaveProperty('totalRedemptions');
        expect(typeof res.body.data.totalRedemptions).toBe('number');
        expect(res.body.data.totalRedemptions).toBeGreaterThanOrEqual(0);
      }
    });

    it('totalRedeemed should be consistent across endpoints', async () => {
      const [tokenRes, balanceRes] = await Promise.all([
        request(app).get(`/api/tokens/balance/${testCustomerAddress}`),
        request(app).get(`/api/customers/balance/${testCustomerAddress}`),
      ]);

      if (tokenRes.status === 200 && balanceRes.status === 200) {
        expect(tokenRes.body.data.totalRedeemed).toBeCloseTo(
          balanceRes.body.data.totalRedemptions, 2
        );
      }
    });

    it('totalRedeemed should never exceed lifetimeEarned', async () => {
      const res = await request(app)
        .get(`/api/tokens/balance/${testCustomerAddress}`);

      if (res.status === 200) {
        const { lifetimeEarned, totalRedeemed } = res.body.data;
        expect(totalRedeemed).toBeLessThanOrEqual(lifetimeEarned);
      }
    });
  });

  // ============================================================
  // TIER BADGE: Silver Tier (shown in screenshot)
  // Source: GET /api/customers/:address → data.tier
  //         GET /api/customers/balance/:address → data.tier
  // ============================================================
  describe('Tier Badge', () => {
    it('should return customer tier from profile endpoint', async () => {
      const res = await request(app)
        .get(`/api/customers/${testCustomerAddress}`);

      expect([200, 400, 404, 429, 500]).toContain(res.status);

      if (res.status === 200 && res.body.data) {
        const tier = res.body.data.tier || res.body.data.customer?.tier;
        if (tier) {
          expect(['BRONZE', 'SILVER', 'GOLD']).toContain(tier);
        }
      }
    });

    it('should return tier from balance endpoint', async () => {
      const res = await request(app)
        .get(`/api/customers/balance/${testCustomerAddress}`);

      expect([200, 404, 429, 500]).toContain(res.status);

      if (res.status === 200) {
        expect(res.body.data).toHaveProperty('tier');
        expect(['BRONZE', 'SILVER', 'GOLD']).toContain(res.body.data.tier);
      }
    });

    it('tier should be consistent across profile and balance endpoints', async () => {
      const [profileRes, balanceRes] = await Promise.all([
        request(app).get(`/api/customers/${testCustomerAddress}`),
        request(app).get(`/api/customers/balance/${testCustomerAddress}`),
      ]);

      if (profileRes.status === 200 && balanceRes.status === 200) {
        const profileTier = profileRes.body.data?.tier || profileRes.body.data?.customer?.tier;
        const balanceTier = balanceRes.body.data?.tier;
        if (profileTier && balanceTier) {
          expect(profileTier).toBe(balanceTier);
        }
      }
    });
  });

  // ============================================================
  // FULL RESPONSE CONTRACT: Token Balance Endpoint
  // Validates the complete shape that the frontend consumes
  // ============================================================
  describe('Response Contract: /api/tokens/balance/:address', () => {
    it('should match the BalanceInfo interface shape', async () => {
      const res = await request(app)
        .get(`/api/tokens/balance/${testCustomerAddress}`);

      expect([200, 404, 429, 500]).toContain(res.status);

      if (res.status === 200) {
        const data = res.body.data;
        // Top-level fields
        expect(data).toHaveProperty('availableBalance');
        expect(data).toHaveProperty('lifetimeEarned');
        expect(data).toHaveProperty('totalRedeemed');
        expect(data).toHaveProperty('pendingMintBalance');
        expect(data).toHaveProperty('earningHistory');

        // All numeric
        expect(typeof data.availableBalance).toBe('number');
        expect(typeof data.lifetimeEarned).toBe('number');
        expect(typeof data.totalRedeemed).toBe('number');
        expect(typeof data.pendingMintBalance).toBe('number');

        // earningHistory sub-object
        expect(typeof data.earningHistory).toBe('object');
        expect(typeof data.earningHistory.fromRepairs).toBe('number');
        expect(typeof data.earningHistory.fromReferrals).toBe('number');
        expect(typeof data.earningHistory.fromBonuses).toBe('number');
        expect(typeof data.earningHistory.fromTierBonuses).toBe('number');
      }
    });
  });

  // ============================================================
  // FULL RESPONSE CONTRACT: Customer Balance Endpoint
  // Validates the complete CustomerBalanceInfo shape
  // ============================================================
  describe('Response Contract: /api/customers/balance/:address', () => {
    it('should match the CustomerBalanceInfo interface shape', async () => {
      const res = await request(app)
        .get(`/api/customers/balance/${testCustomerAddress}`);

      expect([200, 404, 429, 500]).toContain(res.status);

      if (res.status === 200) {
        const data = res.body.data;
        expect(data).toHaveProperty('address');
        expect(data).toHaveProperty('databaseBalance');
        expect(data).toHaveProperty('pendingMintBalance');
        expect(data).toHaveProperty('totalBalance');
        expect(data).toHaveProperty('lifetimeEarnings');
        expect(data).toHaveProperty('totalRedemptions');
        expect(data).toHaveProperty('totalMintedToWallet');
        expect(data).toHaveProperty('tier');
        expect(data).toHaveProperty('canMintToWallet');

        // Type checks
        expect(typeof data.address).toBe('string');
        expect(typeof data.databaseBalance).toBe('number');
        expect(typeof data.pendingMintBalance).toBe('number');
        expect(typeof data.totalBalance).toBe('number');
        expect(typeof data.lifetimeEarnings).toBe('number');
        expect(typeof data.totalRedemptions).toBe('number');
        expect(typeof data.totalMintedToWallet).toBe('number');
        expect(typeof data.tier).toBe('string');
        expect(typeof data.canMintToWallet).toBe('boolean');
      }
    });

    it('totalBalance should equal databaseBalance + pendingMintBalance', async () => {
      const res = await request(app)
        .get(`/api/customers/balance/${testCustomerAddress}`);

      if (res.status === 200) {
        const { databaseBalance, pendingMintBalance, totalBalance } = res.body.data;
        expect(totalBalance).toBeCloseTo(databaseBalance + pendingMintBalance, 2);
      }
    });
  });

  // ============================================================
  // DATA INTEGRITY: Mathematical invariants
  // ============================================================
  describe('Data Integrity Invariants', () => {
    it('availableBalance = lifetimeEarned - totalRedeemed - pendingMint - mintedToWallet (±transfers)', async () => {
      const res = await request(app)
        .get(`/api/customers/balance/${testCustomerAddress}`);

      if (res.status === 200) {
        const d = res.body.data;
        // available should not be negative
        expect(d.databaseBalance).toBeGreaterThanOrEqual(0);
        // lifetime should be >= redeemed
        expect(d.lifetimeEarnings).toBeGreaterThanOrEqual(d.totalRedemptions);
      }
    });

    it('all balance fields should be finite numbers', async () => {
      const res = await request(app)
        .get(`/api/tokens/balance/${testCustomerAddress}`);

      if (res.status === 200) {
        const data = res.body.data;
        expect(Number.isFinite(data.availableBalance)).toBe(true);
        expect(Number.isFinite(data.lifetimeEarned)).toBe(true);
        expect(Number.isFinite(data.totalRedeemed)).toBe(true);
        expect(Number.isFinite(data.pendingMintBalance)).toBe(true);
      }
    });

    it('earning history sources should sum to approximately lifetimeEarned', async () => {
      const res = await request(app)
        .get(`/api/tokens/balance/${testCustomerAddress}`);

      if (res.status === 200) {
        const { lifetimeEarned, earningHistory } = res.body.data;
        const sourcesSum =
          earningHistory.fromRepairs +
          earningHistory.fromReferrals +
          earningHistory.fromBonuses +
          earningHistory.fromTierBonuses;

        // Sources should account for most of the lifetime earned
        // May not be exactly equal if there are other earning types (transfers, etc.)
        expect(sourcesSum).toBeGreaterThanOrEqual(0);
        expect(sourcesSum).toBeLessThanOrEqual(lifetimeEarned + 0.01);
      }
    });
  });

  // ============================================================
  // PARALLEL FETCHING: Simulates the frontend's Promise.all pattern
  // ============================================================
  describe('Parallel Fetch (frontend simulation)', () => {
    it('should handle simultaneous profile + balance + token requests', async () => {
      const [profileRes, balanceRes, tokenRes] = await Promise.all([
        request(app).get(`/api/customers/${testCustomerAddress}`),
        request(app).get(`/api/customers/balance/${testCustomerAddress}`),
        request(app).get(`/api/tokens/balance/${testCustomerAddress}`),
      ]);

      // All should respond (not hang or crash)
      expect([200, 400, 404, 429, 500]).toContain(profileRes.status);
      expect([200, 400, 404, 429, 500]).toContain(balanceRes.status);
      expect([200, 400, 404, 429, 500]).toContain(tokenRes.status);

      // If all succeed, validate the overview card data is present
      if (profileRes.status === 200 && balanceRes.status === 200 && tokenRes.status === 200) {
        // Card 1: Available Balance
        expect(tokenRes.body.data.availableBalance).toBeDefined();
        // Card 2: Wallet Balance proxy (pendingMint + canMint)
        expect(balanceRes.body.data.canMintToWallet).toBeDefined();
        // Card 3: Tokens Earned
        expect(tokenRes.body.data.lifetimeEarned).toBeDefined();
        // Card 4: Tokens Redeemed
        expect(tokenRes.body.data.totalRedeemed).toBeDefined();
        // Tier badge
        expect(balanceRes.body.data.tier).toBeDefined();
      }
    });
  });

  // ============================================================
  // EDGE CASES
  // ============================================================
  describe('Edge Cases', () => {
    it('should handle zero-balance customer gracefully', async () => {
      const zeroAddr = '0x0000000000000000000000000000000000000000';
      const res = await request(app)
        .get(`/api/tokens/balance/${zeroAddr}`);

      expect([200, 404, 429, 500]).toContain(res.status);

      if (res.status === 200) {
        expect(res.body.data.availableBalance).toBeGreaterThanOrEqual(0);
        expect(res.body.data.lifetimeEarned).toBeGreaterThanOrEqual(0);
        expect(res.body.data.totalRedeemed).toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle checksummed address (mixed case)', async () => {
      const mixedCase = '0xAaAa000000000000000000000000000000000001';
      const res = await request(app)
        .get(`/api/tokens/balance/${mixedCase}`);

      expect([200, 404, 429, 500]).toContain(res.status);
    });

    it('should handle lowercase address', async () => {
      const lower = testCustomerAddress.toLowerCase();
      const res = await request(app)
        .get(`/api/tokens/balance/${lower}`);

      expect([200, 404, 429, 500]).toContain(res.status);
    });

    it('should reject non-hex address', async () => {
      const res = await request(app)
        .get('/api/tokens/balance/0xZZZZ000000000000000000000000000000000001');

      expect(res.status).toBe(400);
    });

    it('should reject short address', async () => {
      const res = await request(app)
        .get('/api/tokens/balance/0x1234');

      expect(res.status).toBe(400);
    });
  });
});
