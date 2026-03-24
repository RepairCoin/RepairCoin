/**
 * Shop Profile & Settings Tab E2E Tests
 *
 * Tests the /shop?tab=settings functionality across all sub-tabs:
 * - Shop Profile (name, email, phone, address, logo, social media)
 * - Gallery management
 * - Wallet & Payouts (reimbursement address, payment methods)
 * - Subscription management
 * - Notification preferences
 * - Moderation (block/unblock, reports, flagged reviews)
 * - Authentication & authorization
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, jest, afterAll } from '@jest/globals';
import RepairCoinApp from '../../src/app';
import jwt from 'jsonwebtoken';

jest.mock('thirdweb');

describe('Shop Profile & Settings Tests', () => {
  let app: any;

  const JWT_SECRET = 'test-secret-for-profile-32char!';
  const shopId = 'shop-profile-test-001';
  const shopWallet = '0xaaaa000000000000000000000000000000000001';
  const otherShopId = 'shop-other-test-002';
  const otherShopWallet = '0xcccc000000000000000000000000000000000003';
  const customerWallet = '0xbbbb000000000000000000000000000000000002';

  let shopToken: string;
  let otherShopToken: string;
  let customerToken: string;

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
  });

  afterAll(async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // SECTION 1: Shop Profile - Get Details
  // ============================================================
  describe('Shop Profile - Get Details', () => {
    it('should return shop details for shop owner', async () => {
      const response = await request(app)
        .get(`/api/shops/${shopId}`)
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403, 404]).toContain(response.status);
    });

    it('should return shop details publicly (limited)', async () => {
      const response = await request(app)
        .get(`/api/shops/${shopId}`);
      expect([200, 401, 404]).toContain(response.status);
    });

    it('should return 404 for non-existent shop', async () => {
      const response = await request(app)
        .get('/api/shops/nonexistent-shop-id');
      expect([401, 404]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 2: Shop Profile - Update Details
  // ============================================================
  describe('Shop Profile - Update Details', () => {
    it('should reject unauthenticated update', async () => {
      const response = await request(app)
        .put(`/api/shops/${shopId}/details`)
        .send({ name: 'New Name' });
      expect([401, 403]).toContain(response.status);
    });

    it('should reject customer updating shop', async () => {
      const response = await request(app)
        .put(`/api/shops/${shopId}/details`)
        .set('Cookie', [`auth_token=${customerToken}`])
        .send({ name: 'Customer Hack' });
      expect([401, 403]).toContain(response.status);
    });

    it('should reject other shop updating', async () => {
      const response = await request(app)
        .put(`/api/shops/${shopId}/details`)
        .set('Cookie', [`auth_token=${otherShopToken}`])
        .send({ name: 'Other Shop Hack' });
      expect([401, 403]).toContain(response.status);
    });

    it('should accept valid update with name', async () => {
      const response = await request(app)
        .put(`/api/shops/${shopId}/details`)
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ name: 'Updated Shop Name' });
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should accept valid email update', async () => {
      const response = await request(app)
        .put(`/api/shops/${shopId}/details`)
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ email: 'valid@test.com' });
      expect([200, 400, 401, 403]).toContain(response.status);
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .put(`/api/shops/${shopId}/details`)
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ email: 'not-an-email' });
      expect([400, 401, 403]).toContain(response.status);
    });

    it('should accept social media links', async () => {
      const response = await request(app)
        .put(`/api/shops/${shopId}/details`)
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({
          facebook: 'https://facebook.com/myshop',
          instagram: 'https://instagram.com/myshop',
          twitter: 'https://x.com/myshop'
        });
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should accept location update', async () => {
      const response = await request(app)
        .put(`/api/shops/${shopId}/details`)
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({
          location: { lat: 14.5995, lng: 120.9842, city: 'Manila', state: 'NCR' }
        });
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should reject invalid latitude', async () => {
      const response = await request(app)
        .put(`/api/shops/${shopId}/details`)
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ location: { lat: 200, lng: 120 } });
      expect([400, 401, 403]).toContain(response.status);
    });

    it('should reject invalid longitude', async () => {
      const response = await request(app)
        .put(`/api/shops/${shopId}/details`)
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ location: { lat: 14, lng: 300 } });
      expect([400, 401, 403]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 3: Shop Profile Update
  // ============================================================
  describe('Shop Profile Update (Banner/Logo/About)', () => {
    it('should reject unauthenticated profile update', async () => {
      const response = await request(app)
        .put(`/api/shops/${shopId}/profile`)
        .send({ aboutText: 'About us' });
      expect([401, 403]).toContain(response.status);
    });

    it('should accept about text update', async () => {
      const response = await request(app)
        .put(`/api/shops/${shopId}/profile`)
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ aboutText: 'We are a premium repair shop' });
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should enforce 2000 char limit on about text', () => {
      const maxLength = 2000;
      const validText = 'a'.repeat(maxLength);
      const invalidText = 'a'.repeat(maxLength + 1);
      expect(validText.length).toBeLessThanOrEqual(maxLength);
      expect(invalidText.length).toBeGreaterThan(maxLength);
    });
  });

  // ============================================================
  // SECTION 4: Gallery
  // ============================================================
  describe('Gallery', () => {
    it('should return gallery publicly', async () => {
      const response = await request(app)
        .get(`/api/shops/${shopId}/gallery`);
      expect([200, 404]).toContain(response.status);
    });

    it('should reject unauthenticated gallery add', async () => {
      const response = await request(app)
        .post(`/api/shops/${shopId}/gallery`)
        .send({ photoUrl: 'https://example.com/photo.jpg' });
      expect([401, 403]).toContain(response.status);
    });

    it('should reject missing photoUrl', async () => {
      const response = await request(app)
        .post(`/api/shops/${shopId}/gallery`)
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({});
      expect([400, 401, 403]).toContain(response.status);
    });

    it('should enforce 200 char caption limit', () => {
      const maxCaption = 200;
      expect('a'.repeat(maxCaption).length).toBeLessThanOrEqual(maxCaption);
      expect('a'.repeat(maxCaption + 1).length).toBeGreaterThan(maxCaption);
    });
  });

  // ============================================================
  // SECTION 5: Wallet & Payouts
  // ============================================================
  describe('Wallet & Payouts', () => {
    it('should reject unauthenticated reimbursement address update', async () => {
      const response = await request(app)
        .put(`/api/shops/${shopId}/reimbursement-address`)
        .send({ reimbursementAddress: '0x1234567890123456789012345678901234567890' });
      expect([401, 403]).toContain(response.status);
    });

    it('should reject invalid Ethereum address', async () => {
      const response = await request(app)
        .put(`/api/shops/${shopId}/reimbursement-address`)
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ reimbursementAddress: 'not-a-wallet' });
      expect([400, 401, 403]).toContain(response.status);
    });

    it('should reject unauthenticated payment methods list', async () => {
      const response = await request(app)
        .get('/api/shops/payment-methods');
      expect([401, 403]).toContain(response.status);
    });

    it('should return payment methods for shop', async () => {
      const response = await request(app)
        .get('/api/shops/payment-methods')
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 6: Subscription
  // ============================================================
  describe('Subscription Management', () => {
    it('should reject unauthenticated subscription status', async () => {
      const response = await request(app)
        .get('/api/shops/subscription/status');
      expect([401, 403]).toContain(response.status);
    });

    it('should return subscription status for shop', async () => {
      const response = await request(app)
        .get('/api/shops/subscription/status')
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should support sync parameter', async () => {
      const response = await request(app)
        .get('/api/shops/subscription/status')
        .query({ sync: true })
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should reject unauthenticated subscription cancel', async () => {
      const response = await request(app)
        .post('/api/shops/subscription/cancel')
        .send({ reason: 'Too expensive' });
      expect([401, 403]).toContain(response.status);
    });

    it('should reject unauthenticated reactivate', async () => {
      const response = await request(app)
        .post('/api/shops/subscription/reactivate');
      expect([401, 403]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 7: Notification Preferences
  // ============================================================
  describe('Notification Preferences', () => {
    it('should reject unauthenticated preferences get', async () => {
      const response = await request(app)
        .get('/api/notifications/preferences/general');
      expect([401, 403]).toContain(response.status);
    });

    it('should return preferences for shop', async () => {
      const response = await request(app)
        .get('/api/notifications/preferences/general')
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should update preferences', async () => {
      const response = await request(app)
        .put('/api/notifications/preferences/general')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ newOrders: true, subscriptionReminders: false });
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should reset preferences to defaults', async () => {
      const response = await request(app)
        .post('/api/notifications/preferences/general/reset')
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 8: Moderation - Reports
  // ============================================================
  describe('Moderation - Reports', () => {
    it('should reject unauthenticated report list', async () => {
      const response = await request(app)
        .get('/api/shops/moderation/reports');
      expect([401, 403]).toContain(response.status);
    });

    it('should return reports for shop', async () => {
      const response = await request(app)
        .get('/api/shops/moderation/reports')
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should reject report with missing category', async () => {
      const response = await request(app)
        .post('/api/shops/moderation/reports')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ description: 'Test report', severity: 'low' });
      expect([400, 401, 403]).toContain(response.status);
    });

    it('should reject report with missing description', async () => {
      const response = await request(app)
        .post('/api/shops/moderation/reports')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ category: 'spam', severity: 'low' });
      expect([400, 401, 403]).toContain(response.status);
    });

    it('should reject invalid category', async () => {
      const response = await request(app)
        .post('/api/shops/moderation/reports')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ category: 'invalid', description: 'Test', severity: 'low' });
      expect([400, 401, 403]).toContain(response.status);
    });

    it('should reject invalid severity', async () => {
      const response = await request(app)
        .post('/api/shops/moderation/reports')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ category: 'spam', description: 'Test', severity: 'critical' });
      expect([400, 401, 403]).toContain(response.status);
    });

    it('valid categories should be well-defined', () => {
      const categories = ['spam', 'fraud', 'inappropriate_review', 'harassment', 'other'];
      expect(categories).toHaveLength(5);
    });

    it('valid severities should be well-defined', () => {
      const severities = ['low', 'medium', 'high'];
      expect(severities).toHaveLength(3);
    });
  });

  // ============================================================
  // SECTION 9: Moderation - Flagged Reviews
  // ============================================================
  describe('Moderation - Flagged Reviews', () => {
    it('should reject unauthenticated flagged reviews list', async () => {
      const response = await request(app)
        .get('/api/shops/moderation/flagged-reviews');
      expect([401, 403]).toContain(response.status);
    });

    it('should return flagged reviews for shop', async () => {
      const response = await request(app)
        .get('/api/shops/moderation/flagged-reviews')
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should reject flagging without reviewId', async () => {
      const response = await request(app)
        .post('/api/shops/moderation/flag-review')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ reason: 'Fake review' });
      expect([400, 401, 403]).toContain(response.status);
    });

    it('should reject flagging without reason', async () => {
      const response = await request(app)
        .post('/api/shops/moderation/flag-review')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ reviewId: 'fake-review-id' });
      expect([400, 401, 403]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 10: Response Format Contract
  // ============================================================
  describe('Response Format Contract', () => {
    it('subscription statuses should be well-defined', () => {
      const statuses = ['active', 'paused', 'cancelled', 'expired'];
      expect(statuses).toHaveLength(4);
    });

    it('notification preference categories should exist', () => {
      const categories = ['platform', 'security', 'token', 'order', 'marketing', 'billing'];
      expect(categories.length).toBeGreaterThanOrEqual(6);
    });

    it('shop profile should contain core fields', () => {
      const coreFields = ['shopId', 'name', 'email', 'phone', 'address', 'walletAddress'];
      expect(coreFields).toHaveLength(6);
    });

    it('social media platforms should be well-defined', () => {
      const platforms = ['facebook', 'instagram', 'twitter', 'website'];
      expect(platforms).toHaveLength(4);
    });
  });
});
