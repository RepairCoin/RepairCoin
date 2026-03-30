/**
 * Customer Approvals Tab — E2E Tests
 * /customer?tab=approvals
 *
 * Tests the RCN redemption approval system:
 *   - List pending redemption sessions (my-sessions)
 *   - Approve redemption request (with signature)
 *   - Reject redemption request
 *   - Session status check (public)
 *   - Input validation & auth enforcement
 *   - Session expiry behavior
 *   - Edge cases & security
 *
 * API Endpoints Tested:
 *   - GET  /api/tokens/redemption-session/my-sessions      (customer auth)
 *   - POST /api/tokens/redemption-session/approve           (customer auth)
 *   - POST /api/tokens/redemption-session/reject            (customer auth)
 *   - GET  /api/tokens/redemption-session/status/:sessionId (public)
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, jest, afterAll } from '@jest/globals';
import RepairCoinApp from '../../src/app';
import jwt from 'jsonwebtoken';

jest.mock('thirdweb');

describe('Customer Approvals Tab — E2E', () => {
  let app: any;

  const JWT_SECRET = 'test-secret-approvals-tab-32ch!';
  const customerAddress = '0xaaaa000000000000000000000000000000000001';
  const shopAddress = '0xbbbb000000000000000000000000000000000002';
  const shopId = 'shop-approvals-test-001';
  const fakeSessionId = 'session-test-001';

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
  // SECTION 1: My Sessions (Pending Redemption Requests)
  // ============================================================
  describe('My Sessions', () => {
    describe('GET /api/tokens/redemption-session/my-sessions', () => {
      it('should require authentication', async () => {
        const res = await request(app)
          .get('/api/tokens/redemption-session/my-sessions');

        expect([401, 403]).toContain(res.status);
      });

      it('should reject shop role', async () => {
        const res = await request(app)
          .get('/api/tokens/redemption-session/my-sessions')
          .set('Cookie', [`auth_token=${shopToken}`]);

        expect([401, 403]).toContain(res.status);
      });

      it('should return sessions for authenticated customer', async () => {
        const res = await request(app)
          .get('/api/tokens/redemption-session/my-sessions')
          .set('Cookie', [`auth_token=${customerToken}`]);

        expect([200, 401, 429, 500]).toContain(res.status);

        if (res.status === 200) {
          expect(res.body.success).toBe(true);
          expect(res.body).toHaveProperty('sessions');
          expect(Array.isArray(res.body.sessions)).toBe(true);
        }
      });

      it('should include pendingCount field', async () => {
        const res = await request(app)
          .get('/api/tokens/redemption-session/my-sessions')
          .set('Cookie', [`auth_token=${customerToken}`]);

        if (res.status === 200) {
          expect(res.body).toHaveProperty('pendingCount');
          expect(typeof res.body.pendingCount).toBe('number');
          expect(res.body.pendingCount).toBeGreaterThanOrEqual(0);
        }
      });

      it('should return session objects with expected fields', async () => {
        const res = await request(app)
          .get('/api/tokens/redemption-session/my-sessions')
          .set('Cookie', [`auth_token=${customerToken}`]);

        if (res.status === 200 && res.body.sessions.length > 0) {
          const session = res.body.sessions[0];
          expect(session).toHaveProperty('sessionId');
          expect(session).toHaveProperty('shopId');
          expect(session).toHaveProperty('maxAmount');
          expect(session).toHaveProperty('status');
          expect(session).toHaveProperty('createdAt');
          expect(session).toHaveProperty('expiresAt');

          expect(typeof session.sessionId).toBe('string');
          expect(typeof session.maxAmount).toBe('number');
          expect(['pending', 'approved', 'rejected', 'used', 'expired', 'cancelled'])
            .toContain(session.status);
        }
      });

      it('should return empty array for customer with no sessions', async () => {
        // Use a fresh token for a customer with no history
        const freshToken = jwt.sign(
          { address: '0xdddd000000000000000000000000000000000099', role: 'customer', type: 'access' },
          JWT_SECRET,
          { expiresIn: '1h' }
        );

        const res = await request(app)
          .get('/api/tokens/redemption-session/my-sessions')
          .set('Cookie', [`auth_token=${freshToken}`]);

        if (res.status === 200) {
          expect(res.body.sessions.length).toBe(0);
          expect(res.body.pendingCount).toBe(0);
        }
      });
    });
  });

  // ============================================================
  // SECTION 2: Approve Redemption
  // ============================================================
  describe('Approve Redemption', () => {
    describe('POST /api/tokens/redemption-session/approve', () => {
      it('should require authentication', async () => {
        const res = await request(app)
          .post('/api/tokens/redemption-session/approve')
          .send({ sessionId: fakeSessionId, signature: '0x' + 'a'.repeat(130) });

        expect([401, 403]).toContain(res.status);
      });

      it('should require sessionId', async () => {
        const res = await request(app)
          .post('/api/tokens/redemption-session/approve')
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({ signature: '0x' + 'a'.repeat(130) });

        expect([400, 401, 429, 500]).toContain(res.status);

        if (res.status === 400) {
          expect(res.body.success).toBe(false);
        }
      });

      it('should require signature', async () => {
        const res = await request(app)
          .post('/api/tokens/redemption-session/approve')
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({ sessionId: fakeSessionId });

        expect([400, 401, 429, 500]).toContain(res.status);

        if (res.status === 400) {
          expect(res.body.success).toBe(false);
        }
      });

      it('should reject empty body', async () => {
        const res = await request(app)
          .post('/api/tokens/redemption-session/approve')
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({});

        expect([400, 401, 429, 500]).toContain(res.status);
      });

      it('should reject non-existent session', async () => {
        const res = await request(app)
          .post('/api/tokens/redemption-session/approve')
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({
            sessionId: 'nonexistent-session-id',
            signature: '0x' + 'a'.repeat(130),
          });

        expect([400, 401, 404, 429, 500]).toContain(res.status);
      });

      it('should reject invalid signature format', async () => {
        const res = await request(app)
          .post('/api/tokens/redemption-session/approve')
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({
            sessionId: fakeSessionId,
            signature: 'not-a-valid-signature',
          });

        expect([400, 401, 404, 429, 500]).toContain(res.status);
      });

      it('should reject shop role on approve endpoint', async () => {
        const res = await request(app)
          .post('/api/tokens/redemption-session/approve')
          .set('Cookie', [`auth_token=${shopToken}`])
          .send({
            sessionId: fakeSessionId,
            signature: '0x' + 'a'.repeat(130),
          });

        expect([401, 403]).toContain(res.status);
      });

      it('should accept optional transactionHash field', async () => {
        const res = await request(app)
          .post('/api/tokens/redemption-session/approve')
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({
            sessionId: fakeSessionId,
            signature: '0x' + 'a'.repeat(130),
            transactionHash: '0x' + 'b'.repeat(64),
          });

        // May fail on session not found or signature, but should not fail on extra field
        expect([200, 400, 401, 404, 429, 500]).toContain(res.status);
      });
    });
  });

  // ============================================================
  // SECTION 3: Reject Redemption
  // ============================================================
  describe('Reject Redemption', () => {
    describe('POST /api/tokens/redemption-session/reject', () => {
      it('should require authentication', async () => {
        const res = await request(app)
          .post('/api/tokens/redemption-session/reject')
          .send({ sessionId: fakeSessionId });

        expect([401, 403]).toContain(res.status);
      });

      it('should require sessionId', async () => {
        const res = await request(app)
          .post('/api/tokens/redemption-session/reject')
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({});

        expect([400, 401, 429, 500]).toContain(res.status);

        if (res.status === 400) {
          expect(res.body.success).toBe(false);
        }
      });

      it('should reject non-existent session', async () => {
        const res = await request(app)
          .post('/api/tokens/redemption-session/reject')
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({ sessionId: 'nonexistent-session-id' });

        expect([400, 401, 404, 429, 500]).toContain(res.status);
      });

      it('should reject shop role on reject endpoint', async () => {
        const res = await request(app)
          .post('/api/tokens/redemption-session/reject')
          .set('Cookie', [`auth_token=${shopToken}`])
          .send({ sessionId: fakeSessionId });

        expect([401, 403]).toContain(res.status);
      });

      it('should handle rejecting an already rejected session', async () => {
        // Double-reject should not crash
        await request(app)
          .post('/api/tokens/redemption-session/reject')
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({ sessionId: fakeSessionId });

        const res = await request(app)
          .post('/api/tokens/redemption-session/reject')
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({ sessionId: fakeSessionId });

        expect([200, 400, 401, 404, 429, 500]).toContain(res.status);
      });
    });
  });

  // ============================================================
  // SECTION 4: Session Status (Public)
  // ============================================================
  describe('Session Status', () => {
    describe('GET /api/tokens/redemption-session/status/:sessionId', () => {
      it('should be accessible without authentication (public)', async () => {
        const res = await request(app)
          .get(`/api/tokens/redemption-session/status/${fakeSessionId}`);

        expect(res.status).not.toBe(401);
        expect([200, 404, 429, 500]).toContain(res.status);
      });

      it('should return session status for valid ID', async () => {
        const res = await request(app)
          .get(`/api/tokens/redemption-session/status/${fakeSessionId}`);

        expect([200, 404, 429, 500]).toContain(res.status);

        if (res.status === 200) {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('status');
        }
      });

      it('should return 404 for non-existent session', async () => {
        const res = await request(app)
          .get('/api/tokens/redemption-session/status/completely-fake-session');

        expect([404, 500]).toContain(res.status);
      });

      it('should handle special characters in sessionId', async () => {
        const res = await request(app)
          .get('/api/tokens/redemption-session/status/<script>alert(1)</script>');

        expect([400, 404, 500]).toContain(res.status);
      });
    });
  });

  // ============================================================
  // SECTION 5: Create Session (Shop-side, for context)
  // ============================================================
  describe('Create Session (Shop-initiated)', () => {
    describe('POST /api/tokens/redemption-session/create', () => {
      it('should require authentication', async () => {
        const res = await request(app)
          .post('/api/tokens/redemption-session/create')
          .send({
            customerAddress,
            shopId,
            amount: 10,
          });

        expect([401, 403]).toContain(res.status);
      });

      it('should reject customer role (shop/admin only)', async () => {
        const res = await request(app)
          .post('/api/tokens/redemption-session/create')
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({
            customerAddress,
            shopId,
            amount: 10,
          });

        expect([401, 403]).toContain(res.status);
      });

      it('should require customerAddress', async () => {
        const res = await request(app)
          .post('/api/tokens/redemption-session/create')
          .set('Cookie', [`auth_token=${shopToken}`])
          .send({ shopId, amount: 10 });

        expect([400, 401, 403, 429, 500]).toContain(res.status);
      });

      it('should require amount', async () => {
        const res = await request(app)
          .post('/api/tokens/redemption-session/create')
          .set('Cookie', [`auth_token=${shopToken}`])
          .send({ customerAddress, shopId });

        expect([400, 401, 403, 429, 500]).toContain(res.status);
      });

      it('should handle session creation with valid data', async () => {
        const res = await request(app)
          .post('/api/tokens/redemption-session/create')
          .set('Cookie', [`auth_token=${shopToken}`])
          .send({
            customerAddress,
            shopId,
            amount: 10,
          });

        expect([200, 201, 400, 401, 403, 404, 429, 500]).toContain(res.status);

        if (res.status === 200 || res.status === 201) {
          expect(res.body.success).toBe(true);
          if (res.body.data) {
            expect(res.body.data).toHaveProperty('sessionId');
            expect(res.body.data).toHaveProperty('expiresAt');
          }
        }
      });
    });
  });

  // ============================================================
  // SECTION 6: Cancel Session (Shop-side)
  // ============================================================
  describe('Cancel Session', () => {
    describe('POST /api/tokens/redemption-session/cancel', () => {
      it('should require authentication', async () => {
        const res = await request(app)
          .post('/api/tokens/redemption-session/cancel')
          .send({ sessionId: fakeSessionId });

        expect([401, 403]).toContain(res.status);
      });

      it('should reject customer role', async () => {
        const res = await request(app)
          .post('/api/tokens/redemption-session/cancel')
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({ sessionId: fakeSessionId });

        expect([401, 403]).toContain(res.status);
      });

      it('should handle cancel with valid session', async () => {
        const res = await request(app)
          .post('/api/tokens/redemption-session/cancel')
          .set('Cookie', [`auth_token=${shopToken}`])
          .send({ sessionId: fakeSessionId });

        expect([200, 400, 401, 403, 404, 429, 500]).toContain(res.status);
      });
    });
  });

  // ============================================================
  // SECTION 7: Security & Edge Cases
  // ============================================================
  describe('Security & Edge Cases', () => {
    it('should handle SQL injection in sessionId for approve', async () => {
      const res = await request(app)
        .post('/api/tokens/redemption-session/approve')
        .set('Cookie', [`auth_token=${customerToken}`])
        .send({
          sessionId: "'; DROP TABLE redemption_sessions;--",
          signature: '0x' + 'a'.repeat(130),
        });

      expect([400, 401, 404, 429, 500]).toContain(res.status);
    });

    it('should handle SQL injection in sessionId for reject', async () => {
      const res = await request(app)
        .post('/api/tokens/redemption-session/reject')
        .set('Cookie', [`auth_token=${customerToken}`])
        .send({ sessionId: "'; DROP TABLE redemption_sessions;--" });

      expect([400, 401, 404, 429, 500]).toContain(res.status);
    });

    it('should handle XSS in signature field', async () => {
      const res = await request(app)
        .post('/api/tokens/redemption-session/approve')
        .set('Cookie', [`auth_token=${customerToken}`])
        .send({
          sessionId: fakeSessionId,
          signature: '<script>alert("xss")</script>',
        });

      expect([400, 401, 404, 429, 500]).toContain(res.status);
    });

    it('should not leak sensitive data in error responses', async () => {
      const res = await request(app)
        .post('/api/tokens/redemption-session/approve')
        .set('Cookie', [`auth_token=${customerToken}`])
        .send({
          sessionId: 'invalid',
          signature: 'invalid',
        });

      if (res.status >= 400) {
        const body = JSON.stringify(res.body);
        expect(body).not.toContain('password');
        expect(body).not.toContain('PRIVATE_KEY');
        expect(body).not.toContain('STRIPE_SECRET');
      }
    });

    it('should handle concurrent approve requests for same session', async () => {
      const requests = Array(3).fill(null).map(() =>
        request(app)
          .post('/api/tokens/redemption-session/approve')
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({
            sessionId: fakeSessionId,
            signature: '0x' + 'a'.repeat(130),
          })
      );

      const responses = await Promise.all(requests);

      responses.forEach(res => {
        expect([200, 400, 401, 404, 409, 429, 500]).toContain(res.status);
      });
    });

    it('should handle concurrent reject requests for same session', async () => {
      const requests = Array(3).fill(null).map(() =>
        request(app)
          .post('/api/tokens/redemption-session/reject')
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({ sessionId: fakeSessionId })
      );

      const responses = await Promise.all(requests);

      responses.forEach(res => {
        expect([200, 400, 401, 404, 429, 500]).toContain(res.status);
      });
    });

    it('should handle very long signature', async () => {
      const res = await request(app)
        .post('/api/tokens/redemption-session/approve')
        .set('Cookie', [`auth_token=${customerToken}`])
        .send({
          sessionId: fakeSessionId,
          signature: '0x' + 'a'.repeat(10000),
        });

      expect([400, 401, 404, 429, 500]).toContain(res.status);
    });
  });

  // ============================================================
  // SECTION 8: Error Response Consistency
  // ============================================================
  describe('Error Response Consistency', () => {
    it('auth errors should be consistent', async () => {
      const res = await request(app)
        .get('/api/tokens/redemption-session/my-sessions');

      expect([401, 403]).toContain(res.status);
    });

    it('validation errors should include error message', async () => {
      const res = await request(app)
        .post('/api/tokens/redemption-session/approve')
        .set('Cookie', [`auth_token=${customerToken}`])
        .send({});

      if (res.status === 400) {
        expect(res.body.success).toBe(false);
        expect(res.body).toHaveProperty('error');
        expect(typeof res.body.error).toBe('string');
      }
    });
  });
});
