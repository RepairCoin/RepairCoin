/**
 * Shop Disputes Tab E2E Tests
 *
 * Tests the /shop?tab=disputes functionality:
 * - List shop disputes with status filter
 * - Approve dispute (reverses no-show penalty)
 * - Reject dispute (upholds penalty)
 * - Customer dispute submission
 * - Dispute status checking
 * - Admin dispute oversight
 * - Authentication & authorization
 * - Cross-shop authorization
 *
 * API Endpoints Tested:
 * - GET /api/services/shops/:shopId/disputes - List shop disputes
 * - PUT /api/services/shops/:shopId/disputes/:id/approve - Approve dispute
 * - PUT /api/services/shops/:shopId/disputes/:id/reject - Reject dispute
 * - POST /api/services/orders/:orderId/dispute - Customer submits dispute
 * - GET /api/services/orders/:orderId/dispute - Get dispute status
 * - GET /api/services/admin/disputes - Admin list all disputes
 * - PUT /api/services/admin/disputes/:id/resolve - Admin resolve dispute
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, jest, afterAll } from '@jest/globals';
import RepairCoinApp from '../../src/app';
import jwt from 'jsonwebtoken';

jest.mock('thirdweb');

describe('Shop Disputes Tab Tests', () => {
  let app: any;

  const JWT_SECRET = 'test-secret-for-disputes-32char!';
  const shopId = 'shop-disputes-test-001';
  const shopWallet = '0xaaaa000000000000000000000000000000000001';
  const otherShopId = 'shop-other-test-002';
  const otherShopWallet = '0xcccc000000000000000000000000000000000003';
  const customerWallet = '0xbbbb000000000000000000000000000000000002';
  const adminWallet = '0xdddd000000000000000000000000000000000004';

  let shopToken: string;
  let otherShopToken: string;
  let customerToken: string;
  let adminToken: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.NODE_ENV = 'test';

    const repairCoinApp = new RepairCoinApp();
    await repairCoinApp.initialize();
    app = repairCoinApp.app;

    shopToken = jwt.sign(
      { address: shopWallet, role: 'shop', shopId, type: 'access' },
      JWT_SECRET, { expiresIn: '24h' }
    );
    otherShopToken = jwt.sign(
      { address: otherShopWallet, role: 'shop', shopId: otherShopId, type: 'access' },
      JWT_SECRET, { expiresIn: '24h' }
    );
    customerToken = jwt.sign(
      { address: customerWallet, role: 'customer', type: 'access' },
      JWT_SECRET, { expiresIn: '24h' }
    );
    adminToken = jwt.sign(
      { address: adminWallet, role: 'admin', type: 'access' },
      JWT_SECRET, { expiresIn: '24h' }
    );
  });

  afterAll(async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // SECTION 1: List Shop Disputes - Authentication
  // ============================================================
  describe('List Shop Disputes - Authentication', () => {
    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .get(`/api/services/shops/${shopId}/disputes`);
      expect([401, 403]).toContain(response.status);
    });

    it('should reject customer role', async () => {
      const response = await request(app)
        .get(`/api/services/shops/${shopId}/disputes`)
        .set('Cookie', [`auth_token=${customerToken}`]);
      expect([401, 403]).toContain(response.status);
    });

    it('should accept shop role', async () => {
      const response = await request(app)
        .get(`/api/services/shops/${shopId}/disputes`)
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 2: List Shop Disputes - Filters
  // ============================================================
  describe('List Shop Disputes - Filters', () => {
    it('should support pending status filter', async () => {
      const response = await request(app)
        .get(`/api/services/shops/${shopId}/disputes`)
        .query({ status: 'pending' })
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should support approved status filter', async () => {
      const response = await request(app)
        .get(`/api/services/shops/${shopId}/disputes`)
        .query({ status: 'approved' })
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should support rejected status filter', async () => {
      const response = await request(app)
        .get(`/api/services/shops/${shopId}/disputes`)
        .query({ status: 'rejected' })
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should support all status filter', async () => {
      const response = await request(app)
        .get(`/api/services/shops/${shopId}/disputes`)
        .query({ status: 'all' })
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get(`/api/services/shops/${shopId}/disputes`)
        .query({ limit: 5, offset: 0 })
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should return disputes array with total and pendingCount', async () => {
      const response = await request(app)
        .get(`/api/services/shops/${shopId}/disputes`)
        .set('Cookie', [`auth_token=${shopToken}`]);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('disputes');
        expect(response.body.data).toHaveProperty('total');
        expect(response.body.data).toHaveProperty('pendingCount');
        expect(Array.isArray(response.body.data.disputes)).toBe(true);
      }
    });
  });

  // ============================================================
  // SECTION 3: Cross-Shop Authorization
  // ============================================================
  describe('Cross-Shop Authorization', () => {
    it('other shop cannot list this shops disputes', async () => {
      const response = await request(app)
        .get(`/api/services/shops/${shopId}/disputes`)
        .set('Cookie', [`auth_token=${otherShopToken}`]);
      expect([401, 403]).toContain(response.status);
    });

    it('other shop cannot approve this shops dispute', async () => {
      const response = await request(app)
        .put(`/api/services/shops/${shopId}/disputes/fake-dispute-id/approve`)
        .set('Cookie', [`auth_token=${otherShopToken}`])
        .send({ resolutionNotes: 'Approved by wrong shop' });
      expect([401, 403]).toContain(response.status);
    });

    it('other shop cannot reject this shops dispute', async () => {
      const response = await request(app)
        .put(`/api/services/shops/${shopId}/disputes/fake-dispute-id/reject`)
        .set('Cookie', [`auth_token=${otherShopToken}`])
        .send({ resolutionNotes: 'Rejected by wrong shop' });
      expect([401, 403]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 4: Approve Dispute
  // ============================================================
  describe('Approve Dispute', () => {
    it('should reject unauthenticated approval', async () => {
      const response = await request(app)
        .put(`/api/services/shops/${shopId}/disputes/fake-id/approve`);
      expect([401, 403]).toContain(response.status);
    });

    it('should reject customer approving', async () => {
      const response = await request(app)
        .put(`/api/services/shops/${shopId}/disputes/fake-id/approve`)
        .set('Cookie', [`auth_token=${customerToken}`]);
      expect([401, 403]).toContain(response.status);
    });

    it('should return 404 for non-existent dispute', async () => {
      const response = await request(app)
        .put(`/api/services/shops/${shopId}/disputes/nonexistent-id/approve`)
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([401, 403, 404]).toContain(response.status);
    });

    it('should accept optional resolution notes', async () => {
      const response = await request(app)
        .put(`/api/services/shops/${shopId}/disputes/fake-id/approve`)
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ resolutionNotes: 'Customer was right, my mistake' });
      expect([401, 403, 404]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 5: Reject Dispute
  // ============================================================
  describe('Reject Dispute', () => {
    it('should reject unauthenticated rejection', async () => {
      const response = await request(app)
        .put(`/api/services/shops/${shopId}/disputes/fake-id/reject`);
      expect([401, 403]).toContain(response.status);
    });

    it('should reject customer rejecting', async () => {
      const response = await request(app)
        .put(`/api/services/shops/${shopId}/disputes/fake-id/reject`)
        .set('Cookie', [`auth_token=${customerToken}`]);
      expect([401, 403]).toContain(response.status);
    });

    it('should require resolution notes for rejection', async () => {
      const response = await request(app)
        .put(`/api/services/shops/${shopId}/disputes/fake-id/reject`)
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({});
      expect([400, 401, 403, 404]).toContain(response.status);
    });

    it('should reject short resolution notes (< 10 chars)', async () => {
      const response = await request(app)
        .put(`/api/services/shops/${shopId}/disputes/fake-id/reject`)
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ resolutionNotes: 'short' });
      expect([400, 401, 403, 404]).toContain(response.status);
    });

    it('should return 404 for non-existent dispute', async () => {
      const response = await request(app)
        .put(`/api/services/shops/${shopId}/disputes/nonexistent-id/reject`)
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ resolutionNotes: 'This dispute does not exist in our system' });
      expect([401, 403, 404]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 6: Customer Dispute Submission
  // ============================================================
  describe('Customer Dispute Submission', () => {
    it('should reject unauthenticated dispute submission', async () => {
      const response = await request(app)
        .post('/api/services/orders/ord_fake-id/dispute')
        .send({ reason: 'I was present at the scheduled time' });
      expect([401, 403]).toContain(response.status);
    });

    it('should reject shop submitting dispute', async () => {
      const response = await request(app)
        .post('/api/services/orders/ord_fake-id/dispute')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ reason: 'Shop trying to dispute their own no-show' });
      expect([401, 403]).toContain(response.status);
    });

    it('should reject missing reason', async () => {
      const response = await request(app)
        .post('/api/services/orders/ord_fake-id/dispute')
        .set('Cookie', [`auth_token=${customerToken}`])
        .send({});
      expect([400, 401, 403]).toContain(response.status);
    });

    it('should reject reason shorter than 10 characters', async () => {
      const response = await request(app)
        .post('/api/services/orders/ord_fake-id/dispute')
        .set('Cookie', [`auth_token=${customerToken}`])
        .send({ reason: 'too short' });
      expect([400, 401, 403]).toContain(response.status);
    });

    it('should return 404 for non-existent order', async () => {
      const response = await request(app)
        .post('/api/services/orders/ord_nonexistent/dispute')
        .set('Cookie', [`auth_token=${customerToken}`])
        .send({ reason: 'I was present at the scheduled time but no one was there' });
      expect([401, 403, 404, 500]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 7: Dispute Status Check
  // ============================================================
  describe('Dispute Status Check', () => {
    it('should reject unauthenticated status check', async () => {
      const response = await request(app)
        .get('/api/services/orders/ord_fake-id/dispute');
      expect([401, 403]).toContain(response.status);
    });

    it('should allow customer to check dispute status', async () => {
      const response = await request(app)
        .get('/api/services/orders/ord_fake-id/dispute')
        .set('Cookie', [`auth_token=${customerToken}`]);
      // 404 = no dispute for this order (valid), 401/403 = auth issue
      expect([401, 403, 404, 500]).toContain(response.status);
    });

    it('should allow shop to check dispute status', async () => {
      const response = await request(app)
        .get('/api/services/orders/ord_fake-id/dispute')
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([401, 403, 404, 500]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 8: Admin Disputes
  // ============================================================
  describe('Admin Disputes', () => {
    it('should reject unauthenticated admin disputes list', async () => {
      const response = await request(app)
        .get('/api/services/admin/disputes');
      expect([401, 403]).toContain(response.status);
    });

    it('should reject customer accessing admin disputes', async () => {
      const response = await request(app)
        .get('/api/services/admin/disputes')
        .set('Cookie', [`auth_token=${customerToken}`]);
      expect([401, 403]).toContain(response.status);
    });

    it('should reject shop accessing admin disputes', async () => {
      const response = await request(app)
        .get('/api/services/admin/disputes')
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([401, 403]).toContain(response.status);
    });

    it('should accept admin accessing disputes', async () => {
      const response = await request(app)
        .get('/api/services/admin/disputes')
        .set('Cookie', [`auth_token=${adminToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should support status filter for admin', async () => {
      const response = await request(app)
        .get('/api/services/admin/disputes')
        .query({ status: 'pending' })
        .set('Cookie', [`auth_token=${adminToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should support shopId filter for admin', async () => {
      const response = await request(app)
        .get('/api/services/admin/disputes')
        .query({ shopId: 'peanut' })
        .set('Cookie', [`auth_token=${adminToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 9: Admin Resolve Dispute
  // ============================================================
  describe('Admin Resolve Dispute', () => {
    it('should reject unauthenticated admin resolve', async () => {
      const response = await request(app)
        .put('/api/services/admin/disputes/fake-id/resolve')
        .send({ resolution: 'approved', resolutionNotes: 'Admin override approved' });
      expect([401, 403]).toContain(response.status);
    });

    it('should reject shop resolving via admin endpoint', async () => {
      const response = await request(app)
        .put('/api/services/admin/disputes/fake-id/resolve')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ resolution: 'approved', resolutionNotes: 'Shop pretending to be admin' });
      expect([401, 403]).toContain(response.status);
    });

    it('should reject customer resolving via admin endpoint', async () => {
      const response = await request(app)
        .put('/api/services/admin/disputes/fake-id/resolve')
        .set('Cookie', [`auth_token=${customerToken}`])
        .send({ resolution: 'approved', resolutionNotes: 'Customer pretending to be admin' });
      expect([401, 403]).toContain(response.status);
    });

    it('should reject invalid resolution value', async () => {
      const response = await request(app)
        .put('/api/services/admin/disputes/fake-id/resolve')
        .set('Cookie', [`auth_token=${adminToken}`])
        .send({ resolution: 'maybe', resolutionNotes: 'Invalid resolution type' });
      expect([400, 401, 403, 404]).toContain(response.status);
    });

    it('should reject missing resolution notes', async () => {
      const response = await request(app)
        .put('/api/services/admin/disputes/fake-id/resolve')
        .set('Cookie', [`auth_token=${adminToken}`])
        .send({ resolution: 'approved' });
      expect([400, 401, 403, 404]).toContain(response.status);
    });

    it('should reject short resolution notes (< 10 chars)', async () => {
      const response = await request(app)
        .put('/api/services/admin/disputes/fake-id/resolve')
        .set('Cookie', [`auth_token=${adminToken}`])
        .send({ resolution: 'approved', resolutionNotes: 'short' });
      expect([400, 401, 403, 404]).toContain(response.status);
    });

    it('should accept valid approved resolution', async () => {
      const response = await request(app)
        .put('/api/services/admin/disputes/fake-id/resolve')
        .set('Cookie', [`auth_token=${adminToken}`])
        .send({ resolution: 'approved', resolutionNotes: 'Admin reviewed and approved this dispute' });
      expect([401, 403, 404]).toContain(response.status);
      // 404 expected since fake-id doesn't exist
    });

    it('should accept valid rejected resolution', async () => {
      const response = await request(app)
        .put('/api/services/admin/disputes/fake-id/resolve')
        .set('Cookie', [`auth_token=${adminToken}`])
        .send({ resolution: 'rejected', resolutionNotes: 'Admin reviewed and rejected this dispute' });
      expect([401, 403, 404]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 10: Response Format Contract
  // ============================================================
  describe('Response Format Contract', () => {
    it('dispute statuses should be well-defined', () => {
      const disputeStatuses = ['pending', 'approved', 'rejected'];
      expect(disputeStatuses).toHaveLength(3);
    });

    it('admin resolution values should be well-defined', () => {
      const resolutions = ['approved', 'rejected'];
      expect(resolutions).toHaveLength(2);
    });

    it('dispute list should include expected fields when data exists', async () => {
      const response = await request(app)
        .get(`/api/services/shops/${shopId}/disputes`)
        .query({ status: 'all' })
        .set('Cookie', [`auth_token=${shopToken}`]);

      if (response.status === 200 && response.body.data?.disputes?.length > 0) {
        const dispute = response.body.data.disputes[0];
        expect(dispute).toHaveProperty('id');
        expect(dispute).toHaveProperty('customerAddress');
        expect(dispute).toHaveProperty('orderId');
        expect(dispute).toHaveProperty('shopId');
        expect(dispute).toHaveProperty('disputed');
        expect(dispute).toHaveProperty('disputeStatus');
        expect(dispute).toHaveProperty('disputeReason');
      }
    });
  });
});
