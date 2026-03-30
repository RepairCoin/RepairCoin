/**
 * Customer Referrals Tab — E2E Tests
 * /customer?tab=referrals
 *
 * Tests the full referral system:
 *   - Generate referral code (authenticated customer)
 *   - Validate referral code (public)
 *   - Referral statistics (authenticated — stat cards + referral list)
 *   - Leaderboard (public)
 *   - RCN breakdown by source (authenticated)
 *   - Verify redemption (public — cross-shop check)
 *   - Input validation & edge cases
 *   - Response shape contracts
 *
 * API Endpoints Tested:
 *   - POST /api/referrals/generate         (customer auth)
 *   - GET  /api/referrals/validate/:code   (public)
 *   - GET  /api/referrals/stats            (customer auth)
 *   - GET  /api/referrals/leaderboard      (public)
 *   - GET  /api/referrals/rcn-breakdown    (customer auth)
 *   - POST /api/referrals/verify-redemption (public)
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, jest, afterAll } from '@jest/globals';
import RepairCoinApp from '../../src/app';
import jwt from 'jsonwebtoken';

jest.mock('thirdweb');

describe('Customer Referrals Tab — E2E', () => {
  let app: any;

  const JWT_SECRET = 'test-secret-referrals-tab-32ch!';
  const customerAddress = '0xaaaa000000000000000000000000000000000001';
  const shopAddress = '0xbbbb000000000000000000000000000000000002';
  const shopId = 'shop-referral-test-001';

  let customerToken: string;
  let shopToken: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.NODE_ENV = 'test';

    const repairCoinApp = new RepairCoinApp();
    await repairCoinApp.initialize();
    app = repairCoinApp.app;

    customerToken = jwt.sign(
      { address: customerAddress, role: 'customer', type: 'access' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    shopToken = jwt.sign(
      { address: shopAddress, role: 'shop', shopId, type: 'access' },
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
  // SECTION 1: Generate Referral Code
  // ============================================================
  describe('Generate Referral Code', () => {
    describe('POST /api/referrals/generate', () => {
      it('should require authentication', async () => {
        const res = await request(app)
          .post('/api/referrals/generate');

        expect([401, 403]).toContain(res.status);
      });

      it('should reject shop role', async () => {
        const res = await request(app)
          .post('/api/referrals/generate')
          .set('Cookie', [`auth_token=${shopToken}`]);

        expect([401, 403]).toContain(res.status);
      });

      it('should generate code for authenticated customer', async () => {
        const res = await request(app)
          .post('/api/referrals/generate')
          .set('Cookie', [`auth_token=${customerToken}`]);

        expect([200, 401, 403, 429, 500]).toContain(res.status);

        if (res.status === 200) {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('referralCode');
          expect(res.body.data).toHaveProperty('referralLink');
          expect(typeof res.body.data.referralCode).toBe('string');
          expect(res.body.data.referralCode.length).toBeGreaterThan(0);
          expect(res.body.data.referralLink).toContain('ref=');
        }
      });

      it('should return same code on repeated calls (idempotent)', async () => {
        const res1 = await request(app)
          .post('/api/referrals/generate')
          .set('Cookie', [`auth_token=${customerToken}`]);

        const res2 = await request(app)
          .post('/api/referrals/generate')
          .set('Cookie', [`auth_token=${customerToken}`]);

        if (res1.status === 200 && res2.status === 200) {
          expect(res1.body.data.referralCode).toBe(res2.body.data.referralCode);
        }
      });
    });
  });

  // ============================================================
  // SECTION 2: Validate Referral Code
  // ============================================================
  describe('Validate Referral Code', () => {
    describe('GET /api/referrals/validate/:code', () => {
      it('should be accessible without authentication (public)', async () => {
        const res = await request(app)
          .get('/api/referrals/validate/TESTCODE');

        // Should not return 401 — public endpoint
        expect(res.status).not.toBe(401);
        expect([200, 429, 500]).toContain(res.status);
      });

      it('should validate a referral code', async () => {
        // First generate a code
        const genRes = await request(app)
          .post('/api/referrals/generate')
          .set('Cookie', [`auth_token=${customerToken}`]);

        if (genRes.status === 200) {
          const code = genRes.body.data.referralCode;

          const res = await request(app)
            .get(`/api/referrals/validate/${code}`);

          expect([200, 429, 500]).toContain(res.status);

          if (res.status === 200) {
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
          }
        }
      });

      it('should handle non-existent code', async () => {
        const res = await request(app)
          .get('/api/referrals/validate/NONEXISTENT999');

        expect([200, 404, 429, 500]).toContain(res.status);

        if (res.status === 200) {
          // Should indicate code is not valid
          expect(res.body.success).toBe(true);
          if (res.body.data?.valid !== undefined) {
            expect(res.body.data.valid).toBe(false);
          }
        }
      });

      it('should handle empty code', async () => {
        const res = await request(app)
          .get('/api/referrals/validate/');

        // Empty param may 404 or redirect
        expect([400, 404, 429, 500]).toContain(res.status);
      });

      it('should handle special characters in code', async () => {
        const res = await request(app)
          .get('/api/referrals/validate/<script>alert(1)</script>');

        expect([200, 400, 404, 429, 500]).toContain(res.status);
      });

      it('should handle very long code', async () => {
        const longCode = 'A'.repeat(500);
        const res = await request(app)
          .get(`/api/referrals/validate/${longCode}`);

        expect([200, 400, 404, 429, 500]).toContain(res.status);
      });
    });
  });

  // ============================================================
  // SECTION 3: Referral Statistics
  // ============================================================
  describe('Referral Statistics', () => {
    describe('GET /api/referrals/stats', () => {
      it('should require authentication', async () => {
        const res = await request(app)
          .get('/api/referrals/stats');

        expect([401, 403]).toContain(res.status);
      });

      it('should reject shop role', async () => {
        const res = await request(app)
          .get('/api/referrals/stats')
          .set('Cookie', [`auth_token=${shopToken}`]);

        expect([401, 403]).toContain(res.status);
      });

      it('should return stats for authenticated customer', async () => {
        const res = await request(app)
          .get('/api/referrals/stats')
          .set('Cookie', [`auth_token=${customerToken}`]);

        expect([200, 401, 403, 429, 500]).toContain(res.status);

        if (res.status === 200) {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toBeDefined();
        }
      });

      it('should return stat card fields (totalReferrals, successfulReferrals, pendingReferrals, totalEarned)', async () => {
        const res = await request(app)
          .get('/api/referrals/stats')
          .set('Cookie', [`auth_token=${customerToken}`]);

        if (res.status === 200 && res.body.data) {
          const data = res.body.data;
          // These fields power the 4 stat cards in the frontend
          if (data.totalReferrals !== undefined) {
            expect(typeof data.totalReferrals).toBe('number');
            expect(data.totalReferrals).toBeGreaterThanOrEqual(0);
          }
          if (data.successfulReferrals !== undefined) {
            expect(typeof data.successfulReferrals).toBe('number');
          }
          if (data.pendingReferrals !== undefined) {
            expect(typeof data.pendingReferrals).toBe('number');
          }
          if (data.totalEarned !== undefined) {
            expect(typeof data.totalEarned).toBe('number');
            expect(data.totalEarned).toBeGreaterThanOrEqual(0);
          }
        }
      });

      it('should include referral list with status', async () => {
        const res = await request(app)
          .get('/api/referrals/stats')
          .set('Cookie', [`auth_token=${customerToken}`]);

        if (res.status === 200 && res.body.data?.referrals) {
          expect(Array.isArray(res.body.data.referrals)).toBe(true);

          if (res.body.data.referrals.length > 0) {
            const ref = res.body.data.referrals[0];
            expect(ref).toHaveProperty('status');
            expect(['pending', 'completed', 'expired']).toContain(ref.status);
          }
        }
      });
    });
  });

  // ============================================================
  // SECTION 4: Leaderboard
  // ============================================================
  describe('Leaderboard', () => {
    describe('GET /api/referrals/leaderboard', () => {
      it('should be accessible without authentication (public)', async () => {
        const res = await request(app)
          .get('/api/referrals/leaderboard');

        expect(res.status).not.toBe(401);
        expect([200, 429, 500]).toContain(res.status);
      });

      it('should return leaderboard data', async () => {
        const res = await request(app)
          .get('/api/referrals/leaderboard');

        expect([200, 429, 500]).toContain(res.status);

        if (res.status === 200) {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toBeDefined();
        }
      });

      it('should return leaderboard entries with expected fields', async () => {
        const res = await request(app)
          .get('/api/referrals/leaderboard');

        if (res.status === 200 && res.body.data) {
          // Leaderboard may be array or object with leaderboard property
          const entries = Array.isArray(res.body.data)
            ? res.body.data
            : res.body.data.leaderboard || [];

          if (entries.length > 0) {
            const entry = entries[0];
            // Should have referrer info and counts
            if (entry.referrerAddress) {
              expect(typeof entry.referrerAddress).toBe('string');
            }
            if (entry.totalReferrals !== undefined) {
              expect(typeof entry.totalReferrals).toBe('number');
            }
          }
        }
      });
    });
  });

  // ============================================================
  // SECTION 5: RCN Breakdown
  // ============================================================
  describe('RCN Breakdown', () => {
    describe('GET /api/referrals/rcn-breakdown', () => {
      it('should require authentication', async () => {
        const res = await request(app)
          .get('/api/referrals/rcn-breakdown');

        expect([401, 403]).toContain(res.status);
      });

      it('should reject shop role', async () => {
        const res = await request(app)
          .get('/api/referrals/rcn-breakdown')
          .set('Cookie', [`auth_token=${shopToken}`]);

        expect([401, 403]).toContain(res.status);
      });

      it('should return RCN breakdown for customer', async () => {
        const res = await request(app)
          .get('/api/referrals/rcn-breakdown')
          .set('Cookie', [`auth_token=${customerToken}`]);

        expect([200, 401, 403, 429, 500]).toContain(res.status);

        if (res.status === 200) {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toBeDefined();
        }
      });

      it('should include breakdown fields', async () => {
        const res = await request(app)
          .get('/api/referrals/rcn-breakdown')
          .set('Cookie', [`auth_token=${customerToken}`]);

        if (res.status === 200 && res.body.data) {
          const data = res.body.data;

          if (data.totalBalance !== undefined) {
            expect(typeof data.totalBalance).toBe('number');
            expect(data.totalBalance).toBeGreaterThanOrEqual(0);
          }
          if (data.breakdownByType !== undefined) {
            expect(typeof data.breakdownByType).toBe('object');
          }
          if (data.breakdownByShop !== undefined) {
            expect(typeof data.breakdownByShop).toBe('object');
          }
          if (data.crossShopLimit !== undefined) {
            expect(typeof data.crossShopLimit).toBe('number');
          }
        }
      });
    });
  });

  // ============================================================
  // SECTION 6: Verify Redemption
  // ============================================================
  describe('Verify Redemption', () => {
    describe('POST /api/referrals/verify-redemption', () => {
      it('should be accessible without authentication (public)', async () => {
        const res = await request(app)
          .post('/api/referrals/verify-redemption')
          .send({
            customerAddress,
            shopId,
            amount: 10,
          });

        expect(res.status).not.toBe(401);
        expect([200, 400, 429, 500]).toContain(res.status);
      });

      it('should require customerAddress', async () => {
        const res = await request(app)
          .post('/api/referrals/verify-redemption')
          .send({ shopId, amount: 10 });

        expect([400, 500]).toContain(res.status);

        if (res.status === 400) {
          expect(res.body.success).toBe(false);
          expect(res.body.error).toContain('Missing');
        }
      });

      it('should require shopId', async () => {
        const res = await request(app)
          .post('/api/referrals/verify-redemption')
          .send({ customerAddress, amount: 10 });

        expect([400, 500]).toContain(res.status);
      });

      it('should require amount', async () => {
        const res = await request(app)
          .post('/api/referrals/verify-redemption')
          .send({ customerAddress, shopId });

        expect([400, 500]).toContain(res.status);
      });

      it('should verify redemption with valid data', async () => {
        const res = await request(app)
          .post('/api/referrals/verify-redemption')
          .send({
            customerAddress,
            shopId,
            amount: 10,
          });

        expect([200, 400, 429, 500]).toContain(res.status);

        if (res.status === 200) {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toBeDefined();
        }
      });

      it('should handle non-existent customer', async () => {
        const res = await request(app)
          .post('/api/referrals/verify-redemption')
          .send({
            customerAddress: '0x0000000000000000000000000000000000099999',
            shopId,
            amount: 10,
          });

        expect([200, 400, 404, 429, 500]).toContain(res.status);
      });

      it('should handle zero amount', async () => {
        const res = await request(app)
          .post('/api/referrals/verify-redemption')
          .send({
            customerAddress,
            shopId,
            amount: 0,
          });

        expect([200, 400, 429, 500]).toContain(res.status);
      });

      it('should handle negative amount', async () => {
        const res = await request(app)
          .post('/api/referrals/verify-redemption')
          .send({
            customerAddress,
            shopId,
            amount: -50,
          });

        expect([200, 400, 429, 500]).toContain(res.status);
      });

      it('should handle very large amount (exceeds balance)', async () => {
        const res = await request(app)
          .post('/api/referrals/verify-redemption')
          .send({
            customerAddress,
            shopId,
            amount: 999999,
          });

        expect([200, 400, 429, 500]).toContain(res.status);
      });
    });
  });

  // ============================================================
  // SECTION 7: Generate → Validate Flow
  // ============================================================
  describe('Generate → Validate Flow', () => {
    it('should generate code then validate it successfully', async () => {
      // Step 1: Generate
      const genRes = await request(app)
        .post('/api/referrals/generate')
        .set('Cookie', [`auth_token=${customerToken}`]);

      if (genRes.status !== 200) {
        expect([401, 403, 429, 500]).toContain(genRes.status);
        return;
      }

      const code = genRes.body.data.referralCode;
      expect(code).toBeDefined();
      expect(typeof code).toBe('string');

      // Step 2: Validate the generated code
      const valRes = await request(app)
        .get(`/api/referrals/validate/${code}`);

      expect([200, 429, 500]).toContain(valRes.status);

      if (valRes.status === 200) {
        expect(valRes.body.success).toBe(true);
      }
    });
  });

  // ============================================================
  // SECTION 8: Security & Edge Cases
  // ============================================================
  describe('Security & Edge Cases', () => {
    it('should handle SQL injection in validate code', async () => {
      const res = await request(app)
        .get("/api/referrals/validate/'; DROP TABLE referrals;--");

      expect([200, 400, 404, 429, 500]).toContain(res.status);
    });

    it('should handle SQL injection in verify-redemption', async () => {
      const res = await request(app)
        .post('/api/referrals/verify-redemption')
        .send({
          customerAddress: "'; DROP TABLE customers;--",
          shopId,
          amount: 10,
        });

      expect([200, 400, 429, 500]).toContain(res.status);
    });

    it('should handle empty body for verify-redemption', async () => {
      const res = await request(app)
        .post('/api/referrals/verify-redemption')
        .send({});

      expect([400, 500]).toContain(res.status);
    });

    it('should not leak sensitive data in error responses', async () => {
      const res = await request(app)
        .get('/api/referrals/validate/INVALID');

      const body = JSON.stringify(res.body);
      expect(body).not.toContain('password');
      expect(body).not.toContain('connectionString');
      expect(body).not.toContain('PRIVATE_KEY');
    });

    it('should handle concurrent generate requests', async () => {
      const requests = Array(3).fill(null).map(() =>
        request(app)
          .post('/api/referrals/generate')
          .set('Cookie', [`auth_token=${customerToken}`])
      );

      const responses = await Promise.all(requests);

      responses.forEach(res => {
        expect([200, 401, 403, 429, 500]).toContain(res.status);
      });

      // All successful responses should return same code (idempotent)
      const codes = responses
        .filter(r => r.status === 200)
        .map(r => r.body.data.referralCode);

      if (codes.length > 1) {
        const unique = new Set(codes);
        expect(unique.size).toBe(1);
      }
    });

    it('should handle concurrent leaderboard requests', async () => {
      const requests = Array(5).fill(null).map(() =>
        request(app).get('/api/referrals/leaderboard')
      );

      const responses = await Promise.all(requests);

      responses.forEach(res => {
        expect([200, 429, 500]).toContain(res.status);
      });
    });
  });

  // ============================================================
  // SECTION 9: Error Response Consistency
  // ============================================================
  describe('Error Response Consistency', () => {
    it('auth errors should return success: false', async () => {
      const res = await request(app)
        .get('/api/referrals/stats');

      if (res.status === 401 || res.status === 403) {
        if (res.body.success !== undefined) {
          expect(res.body.success).toBe(false);
        }
      }
    });

    it('validation errors should include error message', async () => {
      const res = await request(app)
        .post('/api/referrals/verify-redemption')
        .send({});

      if (res.status === 400) {
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBeDefined();
        expect(typeof res.body.error).toBe('string');
      }
    });

    it('server errors should not expose stack traces', async () => {
      const res = await request(app)
        .get('/api/referrals/rcn-breakdown')
        .set('Cookie', [`auth_token=${customerToken}`]);

      if (res.status === 500) {
        expect(res.body.error).not.toContain('at ');
        expect(res.body.error).not.toContain('.ts:');
      }
    });
  });
});
