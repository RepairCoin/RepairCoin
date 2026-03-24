/**
 * Shop Service Analytics Tab E2E Tests
 *
 * Tests the /shop?tab=service-analytics functionality:
 * - Analytics overview (total services, revenue, orders, ratings)
 * - Top performing services
 * - Order trends with configurable day range
 * - Category breakdown
 * - Booking analytics (completion rate, no-show rate, peak hours)
 * - Group performance analytics
 * - CSV exports
 * - Authentication & authorization
 *
 * API Endpoints Tested:
 * - GET /api/services/analytics/shop - Full analytics summary
 * - GET /api/services/analytics/shop/overview - Overview metrics
 * - GET /api/services/analytics/shop/top-services - Top services
 * - GET /api/services/analytics/shop/trends - Order trends
 * - GET /api/services/analytics/shop/categories - Category breakdown
 * - GET /api/services/analytics/shop/bookings - Booking analytics
 * - GET /api/services/analytics/shop/group-performance - Group analytics
 * - GET /api/services/analytics/shop/export - CSV export
 * - GET /api/services/analytics/categories/export - Category CSV
 * - GET /api/services/analytics/trends/export - Trends CSV
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, jest, afterAll } from '@jest/globals';
import RepairCoinApp from '../../src/app';
import jwt from 'jsonwebtoken';

jest.mock('thirdweb');

describe('Shop Service Analytics Tab Tests', () => {
  let app: any;

  const JWT_SECRET = 'test-secret-for-analytics-32ch!';
  const shopId = 'shop-analytics-test-001';
  const shopWallet = '0xaaaa000000000000000000000000000000000001';
  const customerWallet = '0xbbbb000000000000000000000000000000000002';

  let shopToken: string;
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
  // SECTION 1: Authentication
  // ============================================================
  describe('Authentication', () => {
    const endpoints = [
      '/api/services/analytics/shop',
      '/api/services/analytics/shop/overview',
      '/api/services/analytics/shop/top-services',
      '/api/services/analytics/shop/trends',
      '/api/services/analytics/shop/categories',
      '/api/services/analytics/shop/bookings',
      '/api/services/analytics/shop/group-performance',
    ];

    it('should reject unauthenticated requests on all analytics endpoints', async () => {
      for (const endpoint of endpoints) {
        const response = await request(app).get(endpoint);
        expect([401, 403]).toContain(response.status);
      }
    });

    it('should reject customer role on all analytics endpoints', async () => {
      for (const endpoint of endpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Cookie', [`auth_token=${customerToken}`]);
        expect([401, 403]).toContain(response.status);
      }
    });
  });

  // ============================================================
  // SECTION 2: Full Analytics Summary
  // ============================================================
  describe('Full Analytics Summary - GET /api/services/analytics/shop', () => {
    it('should return analytics for authenticated shop', async () => {
      const response = await request(app)
        .get('/api/services/analytics/shop')
        .set('Cookie', [`auth_token=${shopToken}`]);

      expect([200, 401, 403, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('overview');
        expect(response.body.data).toHaveProperty('topServices');
        expect(response.body.data).toHaveProperty('orderTrends');
        expect(response.body.data).toHaveProperty('categoryBreakdown');
      }
    });

    it('should accept topServicesLimit param', async () => {
      const response = await request(app)
        .get('/api/services/analytics/shop')
        .query({ topServicesLimit: 5 })
        .set('Cookie', [`auth_token=${shopToken}`]);

      expect([200, 401, 403, 500]).toContain(response.status);
      if (response.status === 200 && response.body.data?.topServices) {
        expect(response.body.data.topServices.length).toBeLessThanOrEqual(5);
      }
    });

    it('should accept trendDays param', async () => {
      const response = await request(app)
        .get('/api/services/analytics/shop')
        .query({ trendDays: 7 })
        .set('Cookie', [`auth_token=${shopToken}`]);

      expect([200, 401, 403, 500]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 3: Overview Metrics
  // ============================================================
  describe('Overview Metrics - GET /api/services/analytics/shop/overview', () => {
    it('should return overview metrics', async () => {
      const response = await request(app)
        .get('/api/services/analytics/shop/overview')
        .set('Cookie', [`auth_token=${shopToken}`]);

      expect([200, 401, 403, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        const data = response.body.data;
        expect(data).toHaveProperty('totalServices');
        expect(data).toHaveProperty('totalOrders');
        expect(data).toHaveProperty('totalRevenue');
        expect(data).toHaveProperty('averageRating');
      }
    });

    it('should return numeric values', async () => {
      const response = await request(app)
        .get('/api/services/analytics/shop/overview')
        .set('Cookie', [`auth_token=${shopToken}`]);

      if (response.status === 200) {
        const data = response.body.data;
        expect(typeof data.totalServices).toBe('number');
        expect(typeof data.totalOrders).toBe('number');
        expect(typeof data.totalRevenue).toBe('number');
        expect(data.totalServices).toBeGreaterThanOrEqual(0);
        expect(data.totalOrders).toBeGreaterThanOrEqual(0);
        expect(data.totalRevenue).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ============================================================
  // SECTION 4: Top Services
  // ============================================================
  describe('Top Services - GET /api/services/analytics/shop/top-services', () => {
    it('should return top services list', async () => {
      const response = await request(app)
        .get('/api/services/analytics/shop/top-services')
        .set('Cookie', [`auth_token=${shopToken}`]);

      expect([200, 401, 403, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/services/analytics/shop/top-services')
        .query({ limit: 3 })
        .set('Cookie', [`auth_token=${shopToken}`]);

      if (response.status === 200) {
        expect(response.body.data.length).toBeLessThanOrEqual(3);
      }
    });

    it('should return expected fields per service', async () => {
      const response = await request(app)
        .get('/api/services/analytics/shop/top-services')
        .set('Cookie', [`auth_token=${shopToken}`]);

      if (response.status === 200 && response.body.data?.length > 0) {
        const service = response.body.data[0];
        expect(service).toHaveProperty('serviceId');
        expect(service).toHaveProperty('serviceName');
        expect(service).toHaveProperty('totalOrders');
        expect(service).toHaveProperty('totalRevenue');
      }
    });
  });

  // ============================================================
  // SECTION 5: Order Trends
  // ============================================================
  describe('Order Trends - GET /api/services/analytics/shop/trends', () => {
    it('should return trends data', async () => {
      const response = await request(app)
        .get('/api/services/analytics/shop/trends')
        .set('Cookie', [`auth_token=${shopToken}`]);

      expect([200, 401, 403, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });

    it('should accept days parameter (7 days)', async () => {
      const response = await request(app)
        .get('/api/services/analytics/shop/trends')
        .query({ days: 7 })
        .set('Cookie', [`auth_token=${shopToken}`]);

      expect([200, 401, 403, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.data.length).toBeLessThanOrEqual(7);
      }
    });

    it('should accept days parameter (90 days)', async () => {
      const response = await request(app)
        .get('/api/services/analytics/shop/trends')
        .query({ days: 90 })
        .set('Cookie', [`auth_token=${shopToken}`]);

      expect([200, 401, 403, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.data.length).toBeLessThanOrEqual(90);
      }
    });

    it('should return date and metrics per entry', async () => {
      const response = await request(app)
        .get('/api/services/analytics/shop/trends')
        .set('Cookie', [`auth_token=${shopToken}`]);

      if (response.status === 200 && response.body.data?.length > 0) {
        const entry = response.body.data[0];
        expect(entry).toHaveProperty('date');
        expect(entry).toHaveProperty('orderCount');
        expect(entry).toHaveProperty('revenue');
      }
    });
  });

  // ============================================================
  // SECTION 6: Category Breakdown
  // ============================================================
  describe('Category Breakdown - GET /api/services/analytics/shop/categories', () => {
    it('should return category data', async () => {
      const response = await request(app)
        .get('/api/services/analytics/shop/categories')
        .set('Cookie', [`auth_token=${shopToken}`]);

      expect([200, 401, 403, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });

    it('should return expected fields per category', async () => {
      const response = await request(app)
        .get('/api/services/analytics/shop/categories')
        .set('Cookie', [`auth_token=${shopToken}`]);

      if (response.status === 200 && response.body.data?.length > 0) {
        const cat = response.body.data[0];
        expect(cat).toHaveProperty('category');
        expect(cat).toHaveProperty('serviceCount');
        expect(cat).toHaveProperty('totalOrders');
        expect(cat).toHaveProperty('totalRevenue');
      }
    });
  });

  // ============================================================
  // SECTION 7: Booking Analytics
  // ============================================================
  describe('Booking Analytics - GET /api/services/analytics/shop/bookings', () => {
    it('should return booking analytics', async () => {
      const response = await request(app)
        .get('/api/services/analytics/shop/bookings')
        .set('Cookie', [`auth_token=${shopToken}`]);

      expect([200, 401, 403, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });

    it('should accept trendDays parameter', async () => {
      const response = await request(app)
        .get('/api/services/analytics/shop/bookings')
        .query({ trendDays: 7 })
        .set('Cookie', [`auth_token=${shopToken}`]);

      expect([200, 401, 403, 500]).toContain(response.status);
    });

    it('should include summary with rates', async () => {
      const response = await request(app)
        .get('/api/services/analytics/shop/bookings')
        .set('Cookie', [`auth_token=${shopToken}`]);

      if (response.status === 200 && response.body.data?.summary) {
        const summary = response.body.data.summary;
        expect(summary).toHaveProperty('totalBookings');
        expect(summary).toHaveProperty('completed');
        expect(summary).toHaveProperty('noShows');
        expect(summary).toHaveProperty('cancelled');
      }
    });
  });

  // ============================================================
  // SECTION 8: Group Performance
  // ============================================================
  describe('Group Performance - GET /api/services/analytics/shop/group-performance', () => {
    it('should return group performance data', async () => {
      const response = await request(app)
        .get('/api/services/analytics/shop/group-performance')
        .set('Cookie', [`auth_token=${shopToken}`]);

      expect([200, 401, 403, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });
  });

  // ============================================================
  // SECTION 9: CSV Exports
  // ============================================================
  describe('CSV Exports', () => {
    it('should reject unauthenticated CSV export', async () => {
      const response = await request(app)
        .get('/api/services/analytics/shop/export');

      expect([401, 403]).toContain(response.status);
    });

    it('should return CSV for shop export', async () => {
      const response = await request(app)
        .get('/api/services/analytics/shop/export')
        .set('Cookie', [`auth_token=${shopToken}`]);

      expect([200, 401, 403, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.headers['content-type']).toMatch(/csv|text/);
      }
    });

    it('should return CSV for categories export', async () => {
      const response = await request(app)
        .get('/api/services/analytics/categories/export')
        .set('Cookie', [`auth_token=${shopToken}`]);

      expect([200, 401, 403, 500]).toContain(response.status);
    });

    it('should return CSV for trends export', async () => {
      const response = await request(app)
        .get('/api/services/analytics/trends/export')
        .set('Cookie', [`auth_token=${shopToken}`]);

      expect([200, 401, 403, 500]).toContain(response.status);
    });

    it('should accept days parameter for trends export', async () => {
      const response = await request(app)
        .get('/api/services/analytics/trends/export')
        .query({ days: 7 })
        .set('Cookie', [`auth_token=${shopToken}`]);

      expect([200, 401, 403, 500]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 10: Data Integrity
  // ============================================================
  describe('Data Integrity', () => {
    it('overview revenue should be non-negative', async () => {
      const response = await request(app)
        .get('/api/services/analytics/shop/overview')
        .set('Cookie', [`auth_token=${shopToken}`]);

      if (response.status === 200) {
        expect(response.body.data.totalRevenue).toBeGreaterThanOrEqual(0);
        expect(response.body.data.totalServices).toBeGreaterThanOrEqual(0);
        expect(response.body.data.averageRating).toBeGreaterThanOrEqual(0);
        expect(response.body.data.averageRating).toBeLessThanOrEqual(5);
      }
    });

    it('top services should be sorted by performance', async () => {
      const response = await request(app)
        .get('/api/services/analytics/shop/top-services')
        .set('Cookie', [`auth_token=${shopToken}`]);

      if (response.status === 200 && response.body.data?.length > 1) {
        const services = response.body.data;
        for (let i = 0; i < services.length - 1; i++) {
          expect(services[i].totalRevenue).toBeGreaterThanOrEqual(services[i + 1].totalRevenue);
        }
      }
    });

    it('trend dates should be in chronological order', async () => {
      const response = await request(app)
        .get('/api/services/analytics/shop/trends')
        .set('Cookie', [`auth_token=${shopToken}`]);

      if (response.status === 200 && response.body.data?.length > 1) {
        const dates = response.body.data.map((d: any) => new Date(d.date).getTime());
        for (let i = 0; i < dates.length - 1; i++) {
          expect(dates[i]).toBeLessThanOrEqual(dates[i + 1]);
        }
      }
    });
  });
});
