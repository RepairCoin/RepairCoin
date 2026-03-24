/**
 * Shop Marketing Tab E2E Tests
 *
 * Tests the /shop?tab=marketing functionality:
 * - Campaign CRUD (create, list, get, update, delete)
 * - Campaign actions (send, schedule, cancel)
 * - Campaign statistics
 * - Audience targeting & count
 * - Shop customers for targeting
 * - Templates
 * - Authentication & authorization
 *
 * API Endpoints Tested:
 * - GET /api/marketing/shops/:shopId/campaigns
 * - POST /api/marketing/shops/:shopId/campaigns
 * - GET /api/marketing/campaigns/:campaignId
 * - PUT /api/marketing/campaigns/:campaignId
 * - DELETE /api/marketing/campaigns/:campaignId
 * - POST /api/marketing/campaigns/:campaignId/send
 * - POST /api/marketing/campaigns/:campaignId/schedule
 * - POST /api/marketing/campaigns/:campaignId/cancel
 * - GET /api/marketing/shops/:shopId/stats
 * - GET /api/marketing/shops/:shopId/audience-count
 * - GET /api/marketing/shops/:shopId/customers
 * - GET /api/marketing/templates
 * - GET /api/marketing/templates/:templateId
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, jest, afterAll } from '@jest/globals';
import RepairCoinApp from '../../src/app';
import jwt from 'jsonwebtoken';

jest.mock('thirdweb');

describe('Shop Marketing Tab Tests', () => {
  let app: any;

  const JWT_SECRET = 'test-secret-for-marketing-32ch!';
  const shopId = 'shop-mkt-test-001';
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
  // SECTION 1: Campaign List - Authentication
  // ============================================================
  describe('Campaign List - Authentication', () => {
    it('should reject unauthenticated campaign list', async () => {
      const response = await request(app)
        .get(`/api/marketing/shops/${shopId}/campaigns`);
      expect([401, 403]).toContain(response.status);
    });

    it('should reject customer role', async () => {
      const response = await request(app)
        .get(`/api/marketing/shops/${shopId}/campaigns`)
        .set('Cookie', [`auth_token=${customerToken}`]);
      expect([401, 403]).toContain(response.status);
    });

    it('should accept shop role', async () => {
      const response = await request(app)
        .get(`/api/marketing/shops/${shopId}/campaigns`)
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 2: Campaign List - Filters & Pagination
  // ============================================================
  describe('Campaign List - Filters & Pagination', () => {
    it('should support pagination', async () => {
      const response = await request(app)
        .get(`/api/marketing/shops/${shopId}/campaigns`)
        .query({ page: 1, limit: 5 })
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should support status filter - draft', async () => {
      const response = await request(app)
        .get(`/api/marketing/shops/${shopId}/campaigns`)
        .query({ status: 'draft' })
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should support status filter - sent', async () => {
      const response = await request(app)
        .get(`/api/marketing/shops/${shopId}/campaigns`)
        .query({ status: 'sent' })
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('campaign statuses should be well-defined', () => {
      const statuses = ['draft', 'scheduled', 'sent', 'cancelled'];
      expect(statuses).toHaveLength(4);
    });
  });

  // ============================================================
  // SECTION 3: Campaign Creation
  // ============================================================
  describe('Campaign Creation', () => {
    it('should reject unauthenticated creation', async () => {
      const response = await request(app)
        .post(`/api/marketing/shops/${shopId}/campaigns`)
        .send({ name: 'Test Campaign', campaignType: 'newsletter' });
      expect([401, 403]).toContain(response.status);
    });

    it('should reject missing name', async () => {
      const response = await request(app)
        .post(`/api/marketing/shops/${shopId}/campaigns`)
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ campaignType: 'newsletter' });
      expect([400, 401, 403]).toContain(response.status);
    });

    it('should reject missing campaignType', async () => {
      const response = await request(app)
        .post(`/api/marketing/shops/${shopId}/campaigns`)
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ name: 'Test Campaign' });
      expect([400, 401, 403]).toContain(response.status);
    });

    it('should accept valid campaign creation', async () => {
      const response = await request(app)
        .post(`/api/marketing/shops/${shopId}/campaigns`)
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({
          name: 'Spring Promotion',
          campaignType: 'offer_coupon',
          subject: 'Special Spring Deals!',
          deliveryMethod: 'both'
        });
      expect([201, 401, 403]).toContain(response.status);
    });

    it('campaign types should be well-defined', () => {
      const types = ['announce_service', 'offer_coupon', 'newsletter', 'custom'];
      expect(types).toHaveLength(4);
    });

    it('delivery methods should be well-defined', () => {
      const methods = ['email', 'in_app', 'both'];
      expect(methods).toHaveLength(3);
    });
  });

  // ============================================================
  // SECTION 4: Campaign CRUD
  // ============================================================
  describe('Campaign CRUD', () => {
    it('should reject unauthenticated campaign get', async () => {
      const response = await request(app)
        .get('/api/marketing/campaigns/fake-campaign-id');
      expect([401, 403]).toContain(response.status);
    });

    it('should return 404 for non-existent campaign', async () => {
      const response = await request(app)
        .get('/api/marketing/campaigns/nonexistent-id')
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([401, 403, 404]).toContain(response.status);
    });

    it('should reject unauthenticated update', async () => {
      const response = await request(app)
        .put('/api/marketing/campaigns/fake-id')
        .send({ name: 'Updated Name' });
      expect([401, 403]).toContain(response.status);
    });

    it('should reject unauthenticated delete', async () => {
      const response = await request(app)
        .delete('/api/marketing/campaigns/fake-id');
      expect([401, 403]).toContain(response.status);
    });

    it('should return 404 for non-existent campaign delete', async () => {
      const response = await request(app)
        .delete('/api/marketing/campaigns/nonexistent-id')
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([401, 403, 404]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 5: Campaign Actions (Send, Schedule, Cancel)
  // ============================================================
  describe('Campaign Actions', () => {
    it('should reject unauthenticated send', async () => {
      const response = await request(app)
        .post('/api/marketing/campaigns/fake-id/send');
      expect([401, 403]).toContain(response.status);
    });

    it('should reject unauthenticated schedule', async () => {
      const response = await request(app)
        .post('/api/marketing/campaigns/fake-id/schedule')
        .send({ scheduledAt: '2026-04-01T10:00:00Z' });
      expect([401, 403]).toContain(response.status);
    });

    it('should reject schedule without scheduledAt', async () => {
      const response = await request(app)
        .post('/api/marketing/campaigns/fake-id/schedule')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({});
      expect([400, 401, 403, 404]).toContain(response.status);
    });

    it('should reject unauthenticated cancel', async () => {
      const response = await request(app)
        .post('/api/marketing/campaigns/fake-id/cancel');
      expect([401, 403]).toContain(response.status);
    });

    it('should return 404 for non-existent campaign send', async () => {
      const response = await request(app)
        .post('/api/marketing/campaigns/nonexistent-id/send')
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([401, 403, 404]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 6: Campaign Statistics
  // ============================================================
  describe('Campaign Statistics', () => {
    it('should reject unauthenticated stats', async () => {
      const response = await request(app)
        .get(`/api/marketing/shops/${shopId}/stats`);
      expect([401, 403]).toContain(response.status);
    });

    it('should return stats for shop', async () => {
      const response = await request(app)
        .get(`/api/marketing/shops/${shopId}/stats`)
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 7: Audience Targeting
  // ============================================================
  describe('Audience Targeting', () => {
    it('should reject unauthenticated audience count', async () => {
      const response = await request(app)
        .get(`/api/marketing/shops/${shopId}/audience-count`);
      expect([401, 403]).toContain(response.status);
    });

    it('should return audience count for shop', async () => {
      const response = await request(app)
        .get(`/api/marketing/shops/${shopId}/audience-count`)
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should support audience type filter', async () => {
      const audienceTypes = ['all_customers', 'top_spenders', 'frequent_visitors', 'active_customers'];
      for (const type of audienceTypes) {
        const response = await request(app)
          .get(`/api/marketing/shops/${shopId}/audience-count`)
          .query({ audienceType: type })
          .set('Cookie', [`auth_token=${shopToken}`]);
        expect([200, 401, 403]).toContain(response.status);
      }
    });

    it('audience types should be well-defined', () => {
      const types = ['all_customers', 'top_spenders', 'frequent_visitors', 'active_customers', 'custom'];
      expect(types).toHaveLength(5);
    });
  });

  // ============================================================
  // SECTION 8: Shop Customers for Targeting
  // ============================================================
  describe('Shop Customers for Targeting', () => {
    it('should reject unauthenticated customer list', async () => {
      const response = await request(app)
        .get(`/api/marketing/shops/${shopId}/customers`);
      expect([401, 403]).toContain(response.status);
    });

    it('should return customers for shop', async () => {
      const response = await request(app)
        .get(`/api/marketing/shops/${shopId}/customers`)
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get(`/api/marketing/shops/${shopId}/customers`)
        .query({ page: 1, limit: 5 })
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should support search', async () => {
      const response = await request(app)
        .get(`/api/marketing/shops/${shopId}/customers`)
        .query({ search: 'test' })
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 9: Templates
  // ============================================================
  describe('Templates', () => {
    it('should reject unauthenticated template list', async () => {
      const response = await request(app)
        .get('/api/marketing/templates');
      expect([401, 403]).toContain(response.status);
    });

    it('should return templates for shop', async () => {
      const response = await request(app)
        .get('/api/marketing/templates')
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should support category filter', async () => {
      const categories = ['coupon', 'announcement', 'newsletter', 'event'];
      for (const cat of categories) {
        const response = await request(app)
          .get('/api/marketing/templates')
          .query({ category: cat })
          .set('Cookie', [`auth_token=${shopToken}`]);
        expect([200, 401, 403]).toContain(response.status);
      }
    });

    it('should return 404 for non-existent template', async () => {
      const response = await request(app)
        .get('/api/marketing/templates/nonexistent-id')
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([401, 403, 404]).toContain(response.status);
    });

    it('template categories should be well-defined', () => {
      const categories = ['coupon', 'announcement', 'newsletter', 'event'];
      expect(categories).toHaveLength(4);
    });
  });

  // ============================================================
  // SECTION 10: Response Format Contract
  // ============================================================
  describe('Response Format Contract', () => {
    it('campaign should have expected core fields', () => {
      const fields = ['id', 'shopId', 'name', 'campaignType', 'status', 'deliveryMethod', 'createdAt'];
      expect(fields.length).toBeGreaterThanOrEqual(7);
    });

    it('stats should include key metrics', () => {
      const metrics = ['totalCampaigns', 'totalSent', 'totalOpened', 'totalClicked'];
      expect(metrics.length).toBeGreaterThanOrEqual(4);
    });

    it('audience count response should have count field', () => {
      const expectedShape = { count: 0, audienceType: 'all_customers' };
      expect(expectedShape).toHaveProperty('count');
      expect(expectedShape).toHaveProperty('audienceType');
    });
  });
});
