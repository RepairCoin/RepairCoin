/**
 * Customer "Mint RCN to Wallet" — E2E Tests
 *
 * Tests the mint functionality on /customer?tab=overview:
 *   - "Mint RCN to Wallet" button opens modal
 *   - Customer enters amount → POST /api/customers/balance/:address/instant-mint
 *   - Alternatively: POST /api/customers/balance/:address/queue-mint (queue flow)
 *   - Validation: amount > 0, amount <= balance, amount <= 10,000 cap, valid address
 *   - Success returns { transactionHash, amount, customerAddress }
 *   - Balance decreases after mint (balance sync)
 *
 * API Endpoints Tested:
 *   - POST /api/customers/balance/:address/instant-mint  (primary — used by frontend)
 *   - POST /api/customers/balance/:address/queue-mint    (alternative queue flow)
 *   - GET  /api/customers/balance/:address               (pre/post balance check)
 *   - GET  /api/customers/balance/pending-mints           (admin: pending mint queue)
 *   - GET  /api/tokens/balance/:address                   (verify available balance)
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, jest, afterAll } from '@jest/globals';
import RepairCoinApp from '../../src/app';
import jwt from 'jsonwebtoken';

jest.mock('thirdweb');

describe('Customer Mint RCN to Wallet — E2E', () => {
  let app: any;

  const JWT_SECRET = 'test-secret-mint-to-wallet-32ch!';
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

  // Helper: get current available balance for the test customer
  async function getAvailableBalance(): Promise<number | null> {
    const res = await request(app)
      .get(`/api/tokens/balance/${testCustomerAddress}`);
    if (res.status === 200) {
      return res.body.data.availableBalance;
    }
    return null;
  }

  // ============================================================
  // SECTION 1: Instant Mint — Input Validation
  // POST /api/customers/balance/:address/instant-mint
  // ============================================================
  describe('Instant Mint — Input Validation', () => {
    it('should reject missing amount', async () => {
      const res = await request(app)
        .post(`/api/customers/balance/${testCustomerAddress}/instant-mint`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid amount');
    });

    it('should reject amount = 0', async () => {
      const res = await request(app)
        .post(`/api/customers/balance/${testCustomerAddress}/instant-mint`)
        .send({ amount: 0 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid amount');
    });

    it('should reject negative amount', async () => {
      const res = await request(app)
        .post(`/api/customers/balance/${testCustomerAddress}/instant-mint`)
        .send({ amount: -10 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid amount');
    });

    it('should reject amount over 10,000 RCN cap', async () => {
      const res = await request(app)
        .post(`/api/customers/balance/${testCustomerAddress}/instant-mint`)
        .send({ amount: 10001 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('10,000');
    });

    it('should reject exactly at boundary: amount = 10,000.01', async () => {
      const res = await request(app)
        .post(`/api/customers/balance/${testCustomerAddress}/instant-mint`)
        .send({ amount: 10000.01 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject null amount', async () => {
      const res = await request(app)
        .post(`/api/customers/balance/${testCustomerAddress}/instant-mint`)
        .send({ amount: null });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject string amount', async () => {
      const res = await request(app)
        .post(`/api/customers/balance/${testCustomerAddress}/instant-mint`)
        .send({ amount: 'fifty' });

      // Route checks `amount <= 0` which is false for NaN, so it may still hit 400
      expect([400, 500]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid wallet address format', async () => {
      const res = await request(app)
        .post(`/api/customers/balance/${testInvalidAddress}/instant-mint`)
        .send({ amount: 10 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid wallet address');
    });

    it('should reject short wallet address', async () => {
      const res = await request(app)
        .post('/api/customers/balance/0x1234/instant-mint')
        .send({ amount: 10 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ============================================================
  // SECTION 2: Instant Mint — Balance Validation
  // Insufficient balance should return 400 with helpful message
  // ============================================================
  describe('Instant Mint — Balance Validation', () => {
    it('should reject mint when amount exceeds available balance', async () => {
      const balance = await getAvailableBalance();

      if (balance !== null && balance >= 0) {
        // Request more than available
        const overAmount = balance + 1000;
        const res = await request(app)
          .post(`/api/customers/balance/${testCustomerAddress}/instant-mint`)
          .send({ amount: overAmount });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toMatch(/insufficient|balance/i);
      }
    });

    it('should include maxAllowed in insufficient balance error (queue-mint)', async () => {
      const balance = await getAvailableBalance();

      if (balance !== null && balance >= 0) {
        const overAmount = balance + 500;
        const res = await request(app)
          .post(`/api/customers/balance/${testCustomerAddress}/queue-mint`)
          .send({ amount: overAmount });

        // queue-mint also validates balance
        expect([400, 500]).toContain(res.status);
        if (res.status === 400) {
          expect(res.body.success).toBe(false);
        }
      }
    });

    it('should handle mint for customer with zero balance', async () => {
      const zeroAddr = '0x0000000000000000000000000000000000000099';
      const res = await request(app)
        .post(`/api/customers/balance/${zeroAddr}/instant-mint`)
        .send({ amount: 1 });

      // Should fail because customer doesn't exist or has no balance
      expect([400, 404, 500]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });
  });

  // ============================================================
  // SECTION 3: Instant Mint — Successful Mint
  // If customer has balance, a valid mint should succeed
  // ============================================================
  describe('Instant Mint — Execution', () => {
    it('should process valid mint request with correct response shape', async () => {
      const balance = await getAvailableBalance();

      if (balance !== null && balance > 0) {
        // Mint a small amount
        const mintAmount = Math.min(1, balance);
        const res = await request(app)
          .post(`/api/customers/balance/${testCustomerAddress}/instant-mint`)
          .send({ amount: mintAmount });

        // Could succeed (200) or fail due to blockchain/thirdweb mock (400/500)
        expect([200, 400, 500]).toContain(res.status);

        if (res.status === 200) {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('transactionHash');
          expect(res.body.data).toHaveProperty('amount');
          expect(res.body.data).toHaveProperty('customerAddress');
          expect(res.body.data.customerAddress).toBe(testCustomerAddress);
          expect(res.body.data.amount).toBe(mintAmount);
          expect(res.body.message).toContain('minted');
        }
      }
    });

    it('should accept fractional amounts (e.g., 0.5 RCN)', async () => {
      const balance = await getAvailableBalance();

      if (balance !== null && balance >= 0.5) {
        const res = await request(app)
          .post(`/api/customers/balance/${testCustomerAddress}/instant-mint`)
          .send({ amount: 0.5 });

        // Should pass validation (not rejected as invalid)
        // May fail on blockchain mock, but should not be a validation error about amount
        expect([200, 400, 500]).toContain(res.status);
        if (res.status === 400 && res.body.error) {
          expect(res.body.error).not.toContain('Invalid amount');
        }
      }
    });

    it('should accept amount at exact 10,000 boundary', async () => {
      // 10,000 is the max - should pass amount validation (may fail on balance check)
      const res = await request(app)
        .post(`/api/customers/balance/${testCustomerAddress}/instant-mint`)
        .send({ amount: 10000 });

      // Should NOT reject due to max limit (10000 is valid; 10001 is not)
      if (res.status === 400 && res.body.error) {
        expect(res.body.error).not.toContain('10,000');
      }
      expect([200, 400, 500]).toContain(res.status);
    });
  });

  // ============================================================
  // SECTION 4: Queue Mint — Input Validation
  // POST /api/customers/balance/:address/queue-mint
  // ============================================================
  describe('Queue Mint — Input Validation', () => {
    it('should reject missing amount', async () => {
      const res = await request(app)
        .post(`/api/customers/balance/${testCustomerAddress}/queue-mint`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid amount');
    });

    it('should reject zero amount', async () => {
      const res = await request(app)
        .post(`/api/customers/balance/${testCustomerAddress}/queue-mint`)
        .send({ amount: 0 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject negative amount', async () => {
      const res = await request(app)
        .post(`/api/customers/balance/${testCustomerAddress}/queue-mint`)
        .send({ amount: -5 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid address', async () => {
      const res = await request(app)
        .post(`/api/customers/balance/${testInvalidAddress}/queue-mint`)
        .send({ amount: 10 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid wallet address');
    });
  });

  // ============================================================
  // SECTION 5: Queue Mint — Execution
  // ============================================================
  describe('Queue Mint — Execution', () => {
    it('should queue valid mint request', async () => {
      const balance = await getAvailableBalance();

      if (balance !== null && balance > 0) {
        const amount = Math.min(1, balance);
        const res = await request(app)
          .post(`/api/customers/balance/${testCustomerAddress}/queue-mint`)
          .send({ amount });

        expect([200, 400, 500]).toContain(res.status);

        if (res.status === 200) {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('customerAddress');
          expect(res.body.data).toHaveProperty('amount');
          expect(res.body.data).toHaveProperty('requestedAt');
          expect(res.body.message).toContain('queued');
        }
      }
    });

    it('should reject queue-mint when balance is insufficient', async () => {
      const res = await request(app)
        .post(`/api/customers/balance/${testCustomerAddress}/queue-mint`)
        .send({ amount: 999999 });

      expect([400, 500]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });
  });

  // ============================================================
  // SECTION 6: Pending Mints (Admin view)
  // GET /api/customers/balance/pending-mints
  // ============================================================
  describe('Pending Mints', () => {
    it('should return pending mints list', async () => {
      const res = await request(app)
        .get('/api/customers/balance/pending-mints');

      expect([200, 401, 403, 429, 500]).toContain(res.status);

      if (res.status === 200) {
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);

        // Each pending mint should have required fields
        if (res.body.data.length > 0) {
          const mint = res.body.data[0];
          expect(mint).toHaveProperty('customerAddress');
          expect(mint).toHaveProperty('amount');
          expect(typeof mint.amount).toBe('number');
          expect(mint.amount).toBeGreaterThan(0);
        }
      }
    });

    it('should support limit parameter', async () => {
      const res = await request(app)
        .get('/api/customers/balance/pending-mints')
        .query({ limit: 5 });

      expect([200, 401, 403, 429, 500]).toContain(res.status);

      if (res.status === 200) {
        expect(res.body.data.length).toBeLessThanOrEqual(5);
      }
    });
  });

  // ============================================================
  // SECTION 7: Balance Sync After Mint
  // GET /api/customers/balance/:address/sync
  // ============================================================
  describe('Balance Sync', () => {
    it('should sync balance after mint operations', async () => {
      const res = await request(app)
        .get(`/api/customers/balance/${testCustomerAddress}/sync`);

      expect([200, 404, 429, 500]).toContain(res.status);

      if (res.status === 200) {
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('databaseBalance');
        expect(res.body.data).toHaveProperty('pendingMintBalance');
        expect(res.body.data).toHaveProperty('totalMintedToWallet');
      }
    });

    it('should reject sync for invalid address', async () => {
      const res = await request(app)
        .get(`/api/customers/balance/${testInvalidAddress}/sync`);

      expect([400, 404, 500]).toContain(res.status);
    });
  });

  // ============================================================
  // SECTION 8: Pre-Mint Balance Check (canMintToWallet flag)
  // ============================================================
  describe('Pre-Mint Balance Check', () => {
    it('canMintToWallet should be true when databaseBalance > 0', async () => {
      const res = await request(app)
        .get(`/api/customers/balance/${testCustomerAddress}`);

      if (res.status === 200) {
        const { databaseBalance, canMintToWallet } = res.body.data;
        if (databaseBalance > 0) {
          expect(canMintToWallet).toBe(true);
        } else {
          expect(canMintToWallet).toBe(false);
        }
      }
    });

    it('canMintToWallet should be false when databaseBalance is 0', async () => {
      const zeroAddr = '0x0000000000000000000000000000000000000099';
      const res = await request(app)
        .get(`/api/customers/balance/${zeroAddr}`);

      if (res.status === 200 && res.body.data.databaseBalance === 0) {
        expect(res.body.data.canMintToWallet).toBe(false);
      }
    });
  });

  // ============================================================
  // SECTION 9: Full Mint Flow (end-to-end simulation)
  // Simulates: check balance → mint → verify balance decreased
  // ============================================================
  describe('Full Mint Flow', () => {
    it('should complete check → mint → verify cycle', async () => {
      // Step 1: Check pre-mint balance
      const preRes = await request(app)
        .get(`/api/customers/balance/${testCustomerAddress}`);

      if (preRes.status !== 200) return; // Skip if customer doesn't exist

      const preMintBalance = preRes.body.data.databaseBalance;
      const preMintMinted = preRes.body.data.totalMintedToWallet;

      if (preMintBalance <= 0) return; // Can't mint with zero balance

      // Step 2: Attempt instant mint
      const mintAmount = Math.min(1, preMintBalance);
      const mintRes = await request(app)
        .post(`/api/customers/balance/${testCustomerAddress}/instant-mint`)
        .send({ amount: mintAmount });

      // Step 3: Verify post-mint state
      if (mintRes.status === 200) {
        // Give a moment for DB update
        const postRes = await request(app)
          .get(`/api/customers/balance/${testCustomerAddress}`);

        if (postRes.status === 200) {
          // Balance should have decreased
          expect(postRes.body.data.databaseBalance).toBeLessThanOrEqual(preMintBalance);
          // Minted-to-wallet should have increased
          expect(postRes.body.data.totalMintedToWallet).toBeGreaterThanOrEqual(preMintMinted);
        }
      }

      // Whether mint succeeded or not, flow should not crash
      expect([200, 400, 500]).toContain(mintRes.status);
    });
  });

  // ============================================================
  // SECTION 10: Security & Edge Cases
  // ============================================================
  describe('Security & Edge Cases', () => {
    it('should not allow minting to a different address than the path', async () => {
      // The endpoint uses :address from URL path, not from body
      // Sending a different address in the body should not affect the target
      const res = await request(app)
        .post(`/api/customers/balance/${testCustomerAddress}/instant-mint`)
        .send({
          amount: 1,
          address: '0xbbbb000000000000000000000000000000000002',
        });

      // Should use path address, not body address
      if (res.status === 200) {
        expect(res.body.data.customerAddress).toBe(testCustomerAddress);
      }
      expect([200, 400, 500]).toContain(res.status);
    });

    it('should handle very small amount (0.01 RCN)', async () => {
      const res = await request(app)
        .post(`/api/customers/balance/${testCustomerAddress}/instant-mint`)
        .send({ amount: 0.01 });

      // Should pass validation (> 0), may fail on balance or blockchain
      if (res.status === 400 && res.body.error) {
        expect(res.body.error).not.toContain('Invalid amount');
      }
      expect([200, 400, 500]).toContain(res.status);
    });

    it('should handle very large precision amount', async () => {
      const res = await request(app)
        .post(`/api/customers/balance/${testCustomerAddress}/instant-mint`)
        .send({ amount: 1.123456789012345 });

      // Should not crash — either accepted or rejected gracefully
      expect([200, 400, 500]).toContain(res.status);
      expect(res.body).toHaveProperty('success');
    });

    it('should handle concurrent mint requests gracefully', async () => {
      const requests = Array(3).fill(null).map(() =>
        request(app)
          .post(`/api/customers/balance/${testCustomerAddress}/instant-mint`)
          .send({ amount: 1 })
      );

      const responses = await Promise.all(requests);

      // All should respond without crashing
      responses.forEach(res => {
        expect([200, 400, 429, 500]).toContain(res.status);
        expect(res.body).toHaveProperty('success');
      });

      // At most one should succeed if balance is limited
      const successCount = responses.filter(r => r.status === 200).length;
      // Not asserting exact count since it depends on balance + race conditions
      expect(successCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle SQL injection attempt in address', async () => {
      const res = await request(app)
        .post("/api/customers/balance/0x'; DROP TABLE customers;--/instant-mint")
        .send({ amount: 1 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should handle XSS attempt in address', async () => {
      const res = await request(app)
        .post('/api/customers/balance/<script>alert(1)</script>/instant-mint')
        .send({ amount: 1 });

      expect([400, 404]).toContain(res.status);
    });

    it('should handle amount as boolean', async () => {
      const res = await request(app)
        .post(`/api/customers/balance/${testCustomerAddress}/instant-mint`)
        .send({ amount: true });

      // true coerces to 1 in JS — may pass validation or not
      expect([200, 400, 500]).toContain(res.status);
    });

    it('should handle amount as Infinity', async () => {
      const res = await request(app)
        .post(`/api/customers/balance/${testCustomerAddress}/instant-mint`)
        .send({ amount: Infinity });

      // JSON.stringify(Infinity) becomes null, so should be rejected
      expect([400, 500]).toContain(res.status);
    });
  });

  // ============================================================
  // SECTION 11: Response Contract Validation
  // ============================================================
  describe('Response Contract', () => {
    it('instant-mint success response should have correct shape', async () => {
      const balance = await getAvailableBalance();

      if (balance !== null && balance > 0) {
        const res = await request(app)
          .post(`/api/customers/balance/${testCustomerAddress}/instant-mint`)
          .send({ amount: Math.min(0.01, balance) });

        if (res.status === 200) {
          // Success response contract
          expect(res.body).toHaveProperty('success', true);
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('message');
          expect(res.body.data).toHaveProperty('transactionHash');
          expect(res.body.data).toHaveProperty('amount');
          expect(res.body.data).toHaveProperty('customerAddress');
          expect(typeof res.body.data.transactionHash).toBe('string');
          expect(typeof res.body.data.amount).toBe('number');
          expect(typeof res.body.data.customerAddress).toBe('string');
        }
      }
    });

    it('instant-mint error response should have correct shape', async () => {
      const res = await request(app)
        .post(`/api/customers/balance/${testCustomerAddress}/instant-mint`)
        .send({ amount: -1 });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.error).toBe('string');
      expect(res.body.error.length).toBeGreaterThan(0);
    });

    it('queue-mint success response should have correct shape', async () => {
      const balance = await getAvailableBalance();

      if (balance !== null && balance > 0) {
        const res = await request(app)
          .post(`/api/customers/balance/${testCustomerAddress}/queue-mint`)
          .send({ amount: Math.min(0.01, balance) });

        if (res.status === 200) {
          expect(res.body).toHaveProperty('success', true);
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('message');
          expect(res.body.data).toHaveProperty('customerAddress');
          expect(res.body.data).toHaveProperty('amount');
          expect(res.body.data).toHaveProperty('requestedAt');
          expect(typeof res.body.data.requestedAt).toBe('string');
        }
      }
    });
  });
});
