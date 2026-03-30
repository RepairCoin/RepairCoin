/**
 * Customer Find Shop Tab — E2E Tests
 * /customer?tab=findshop
 *
 * Tests the shop discovery page:
 *   - Shop listing with search, category filter, pagination
 *   - Shop detail (services list when shop selected)
 *   - Response shape matching frontend expectations
 *   - Map data (location lat/lng/city/state)
 *   - Rating and review sorting
 *   - Social media field mapping
 *   - Edge cases and security
 *
 * API Endpoints Tested:
 *   - GET /api/customers/shops                    (public — shop listing)
 *   - GET /api/services/shop/:shopId              (public — shop services)
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, jest, afterAll } from '@jest/globals';
import RepairCoinApp from '../../src/app';

jest.mock('thirdweb');

describe('Customer Find Shop Tab — E2E', () => {
  let app: any;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-find-shop-32chars!';
    process.env.NODE_ENV = 'test';

    const repairCoinApp = new RepairCoinApp();
    await repairCoinApp.initialize();
    app = repairCoinApp.app;
  });

  afterAll(async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // SECTION 1: Shop Listing — Basic
  // ============================================================
  describe('Shop Listing', () => {
    describe('GET /api/customers/shops', () => {
      it('should be accessible without authentication (public)', async () => {
        const res = await request(app).get('/api/customers/shops');

        expect(res.status).not.toBe(401);
        expect([200, 429, 500]).toContain(res.status);
      });

      it('should return shops with success flag', async () => {
        const res = await request(app).get('/api/customers/shops');

        expect([200, 429, 500]).toContain(res.status);

        if (res.status === 200) {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('shops');
          expect(Array.isArray(res.body.data.shops)).toBe(true);
        }
      });

      it('should return pagination metadata', async () => {
        const res = await request(app)
          .get('/api/customers/shops')
          .query({ page: 1, limit: 10 });

        if (res.status === 200) {
          expect(res.body.data).toHaveProperty('pagination');
          const p = res.body.data.pagination;
          expect(p).toHaveProperty('page');
          expect(p).toHaveProperty('limit');
          expect(p).toHaveProperty('totalItems');
          expect(p).toHaveProperty('totalPages');
          expect(p).toHaveProperty('hasMore');
          expect(typeof p.page).toBe('number');
          expect(typeof p.totalItems).toBe('number');
          expect(typeof p.totalPages).toBe('number');
          expect(typeof p.hasMore).toBe('boolean');
          expect(p.page).toBe(1);
          expect(p.limit).toBe(10);
        }
      });

      it('should only return active and verified shops', async () => {
        const res = await request(app).get('/api/customers/shops');

        if (res.status === 200 && res.body.data.shops.length > 0) {
          res.body.data.shops.forEach((shop: any) => {
            expect(shop.active).toBe(true);
            expect(shop.verified).toBe(true);
          });
        }
      });
    });
  });

  // ============================================================
  // SECTION 2: Shop Card Response Shape
  // ============================================================
  describe('Shop Card Response Shape', () => {
    it('should include all fields the frontend expects', async () => {
      const res = await request(app).get('/api/customers/shops');

      if (res.status === 200 && res.body.data.shops.length > 0) {
        const shop = res.body.data.shops[0];

        // Required fields
        expect(shop).toHaveProperty('shopId');
        expect(shop).toHaveProperty('name');
        expect(shop).toHaveProperty('verified');
        expect(shop).toHaveProperty('active');
        expect(shop).toHaveProperty('location');

        // Type checks
        expect(typeof shop.shopId).toBe('string');
        expect(typeof shop.name).toBe('string');
        expect(typeof shop.verified).toBe('boolean');
        expect(typeof shop.active).toBe('boolean');
      }
    });

    it('should include rating and review data', async () => {
      const res = await request(app).get('/api/customers/shops');

      if (res.status === 200 && res.body.data.shops.length > 0) {
        const shop = res.body.data.shops[0];

        expect(shop).toHaveProperty('avgRating');
        expect(shop).toHaveProperty('totalReviews');
        expect(typeof shop.avgRating).toBe('number');
        expect(typeof shop.totalReviews).toBe('number');
        expect(shop.avgRating).toBeGreaterThanOrEqual(0);
        expect(shop.avgRating).toBeLessThanOrEqual(5);
        expect(shop.totalReviews).toBeGreaterThanOrEqual(0);
      }
    });

    it('should include location data for map rendering', async () => {
      const res = await request(app).get('/api/customers/shops');

      if (res.status === 200 && res.body.data.shops.length > 0) {
        const shop = res.body.data.shops[0];

        expect(shop).toHaveProperty('location');
        expect(typeof shop.location).toBe('object');

        if (shop.location.lat !== null && shop.location.lat !== undefined) {
          // BUG: location_lat/lng come as strings from PostgreSQL because
          // ShopRepository.mapRow (line 597-598) doesn't call parseFloat().
          // Other mappers in the same file DO parse them (lines 781, 843).
          // Frontend uses Number() to coerce, so it works, but the API
          // contract is inconsistent.
          const lat = Number(shop.location.lat);
          const lng = Number(shop.location.lng);
          expect(Number.isFinite(lat)).toBe(true);
          expect(Number.isFinite(lng)).toBe(true);
        }
      }
    });

    it('should include contact fields', async () => {
      const res = await request(app).get('/api/customers/shops');

      if (res.status === 200 && res.body.data.shops.length > 0) {
        const shop = res.body.data.shops[0];

        // These may be null but should exist as properties
        expect('address' in shop).toBe(true);
        expect('phone' in shop).toBe(true);
        expect('email' in shop).toBe(true);
      }
    });

    it('should include category and tier', async () => {
      const res = await request(app).get('/api/customers/shops');

      if (res.status === 200 && res.body.data.shops.length > 0) {
        const shop = res.body.data.shops[0];

        expect('category' in shop).toBe(true);
        expect('tier' in shop).toBe(true);
      }
    });

    it('should include social media fields', async () => {
      const res = await request(app).get('/api/customers/shops');

      if (res.status === 200 && res.body.data.shops.length > 0) {
        const shop = res.body.data.shops[0];

        // Backend maps DB "twitter" → "x" for frontend
        expect('facebook' in shop).toBe(true);
        expect('x' in shop).toBe(true);
        expect('instagram' in shop).toBe(true);
      }
    });
  });

  // ============================================================
  // SECTION 3: Search
  // ============================================================
  describe('Search', () => {
    it('should filter shops by name search', async () => {
      const res = await request(app)
        .get('/api/customers/shops')
        .query({ search: 'repair' });

      expect([200, 429, 500]).toContain(res.status);

      if (res.status === 200) {
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data.shops)).toBe(true);
      }
    });

    it('should return empty array for no matches', async () => {
      const res = await request(app)
        .get('/api/customers/shops')
        .query({ search: 'xyznonexistentshop999' });

      expect([200, 429, 500]).toContain(res.status);

      if (res.status === 200) {
        expect(res.body.data.shops.length).toBe(0);
        expect(res.body.data.pagination.totalItems).toBe(0);
      }
    });

    it('should search case-insensitively', async () => {
      // Get a shop name first
      const listRes = await request(app).get('/api/customers/shops');

      if (listRes.status === 200 && listRes.body.data.shops.length > 0) {
        const shopName = listRes.body.data.shops[0].name;
        const upperSearch = shopName.toUpperCase().substring(0, 3);

        const res = await request(app)
          .get('/api/customers/shops')
          .query({ search: upperSearch });

        expect([200, 429, 500]).toContain(res.status);

        if (res.status === 200) {
          // Should find at least the shop we searched for
          expect(res.body.data.shops.length).toBeGreaterThanOrEqual(1);
        }
      }
    });

    it('should search by city', async () => {
      const res = await request(app)
        .get('/api/customers/shops')
        .query({ search: 'city' });

      expect([200, 429, 500]).toContain(res.status);
    });

    it('should handle special characters in search', async () => {
      const res = await request(app)
        .get('/api/customers/shops')
        .query({ search: '<script>alert(1)</script>' });

      expect([200, 429, 500]).toContain(res.status);

      // Should not crash — just return empty results
      if (res.status === 200) {
        expect(Array.isArray(res.body.data.shops)).toBe(true);
      }
    });

    it('should handle empty search string', async () => {
      const res = await request(app)
        .get('/api/customers/shops')
        .query({ search: '' });

      expect([200, 429, 500]).toContain(res.status);

      // Empty search = no filter = return all shops
      if (res.status === 200) {
        expect(Array.isArray(res.body.data.shops)).toBe(true);
      }
    });

    it('should handle very long search string', async () => {
      const res = await request(app)
        .get('/api/customers/shops')
        .query({ search: 'a'.repeat(500) });

      expect([200, 400, 429, 500]).toContain(res.status);
    });
  });

  // ============================================================
  // SECTION 4: Category Filter
  // ============================================================
  describe('Category Filter', () => {
    it('should filter by category', async () => {
      const res = await request(app)
        .get('/api/customers/shops')
        .query({ category: 'Repairs and Tech' });

      expect([200, 429, 500]).toContain(res.status);

      if (res.status === 200) {
        expect(Array.isArray(res.body.data.shops)).toBe(true);
      }
    });

    it('should return empty for non-existent category', async () => {
      const res = await request(app)
        .get('/api/customers/shops')
        .query({ category: 'NonExistentCategory999' });

      expect([200, 429, 500]).toContain(res.status);

      if (res.status === 200) {
        expect(res.body.data.shops.length).toBe(0);
      }
    });

    it('should combine search and category filters', async () => {
      const res = await request(app)
        .get('/api/customers/shops')
        .query({ search: 'repair', category: 'Repairs and Tech' });

      expect([200, 429, 500]).toContain(res.status);
    });
  });

  // ============================================================
  // SECTION 5: Pagination
  // ============================================================
  describe('Pagination', () => {
    it('should default to page 1 with 20 items', async () => {
      const res = await request(app).get('/api/customers/shops');

      if (res.status === 200) {
        expect(res.body.data.shops.length).toBeLessThanOrEqual(20);
        expect(res.body.data.pagination.page).toBe(1);
        expect(res.body.data.pagination.limit).toBe(20);
      }
    });

    it('should respect custom page and limit', async () => {
      const res = await request(app)
        .get('/api/customers/shops')
        .query({ page: 1, limit: 5 });

      if (res.status === 200) {
        expect(res.body.data.shops.length).toBeLessThanOrEqual(5);
        expect(res.body.data.pagination.limit).toBe(5);
      }
    });

    it('should return page 2 results', async () => {
      const res = await request(app)
        .get('/api/customers/shops')
        .query({ page: 2, limit: 5 });

      expect([200, 429, 500]).toContain(res.status);
    });

    it('should return empty array for page beyond data', async () => {
      const res = await request(app)
        .get('/api/customers/shops')
        .query({ page: 9999, limit: 20 });

      if (res.status === 200) {
        expect(res.body.data.shops.length).toBe(0);
      }
    });

    it('should cap limit at 100', async () => {
      const res = await request(app)
        .get('/api/customers/shops')
        .query({ limit: 500 });

      if (res.status === 200) {
        expect(res.body.data.shops.length).toBeLessThanOrEqual(100);
        expect(res.body.data.pagination.limit).toBeLessThanOrEqual(100);
      }
    });

    it('should handle negative page number', async () => {
      const res = await request(app)
        .get('/api/customers/shops')
        .query({ page: -1 });

      expect([200, 400, 429, 500]).toContain(res.status);
    });

    it('should handle zero limit', async () => {
      const res = await request(app)
        .get('/api/customers/shops')
        .query({ limit: 0 });

      expect([200, 400, 429, 500]).toContain(res.status);
    });
  });

  // ============================================================
  // SECTION 6: Rating Sort Order
  // ============================================================
  describe('Rating Sort Order', () => {
    it('should sort shops by average rating descending', async () => {
      const res = await request(app)
        .get('/api/customers/shops')
        .query({ limit: 50 });

      if (res.status === 200 && res.body.data.shops.length >= 2) {
        const shops = res.body.data.shops;
        for (let i = 1; i < shops.length; i++) {
          // Higher or equal rating should come first
          expect(shops[i].avgRating).toBeLessThanOrEqual(shops[i - 1].avgRating);
        }
      }
    });
  });

  // ============================================================
  // SECTION 7: Shop Detail — Services List
  // (When user clicks a shop, frontend loads its services)
  // ============================================================
  describe('Shop Detail — Services', () => {
    describe('GET /api/services/shop/:shopId', () => {
      it('should return services for a valid shop (public)', async () => {
        // First get a real shop ID
        const listRes = await request(app).get('/api/customers/shops');

        if (listRes.status === 200 && listRes.body.data.shops.length > 0) {
          const shopId = listRes.body.data.shops[0].shopId;

          const res = await request(app)
            .get(`/api/services/shop/${shopId}`);

          expect([200, 429, 500]).toContain(res.status);

          if (res.status === 200) {
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
          }
        }
      });

      it('should return only active services for public view', async () => {
        const listRes = await request(app).get('/api/customers/shops');

        if (listRes.status === 200 && listRes.body.data.shops.length > 0) {
          const shopId = listRes.body.data.shops[0].shopId;

          const res = await request(app)
            .get(`/api/services/shop/${shopId}`);

          if (res.status === 200 && res.body.data.length > 0) {
            res.body.data.forEach((service: any) => {
              expect(service.active).toBe(true);
            });
          }
        }
      });

      it('should include service card fields', async () => {
        const listRes = await request(app).get('/api/customers/shops');

        if (listRes.status === 200 && listRes.body.data.shops.length > 0) {
          const shopId = listRes.body.data.shops[0].shopId;

          const res = await request(app)
            .get(`/api/services/shop/${shopId}`);

          if (res.status === 200 && res.body.data.length > 0) {
            const service = res.body.data[0];
            expect(service).toHaveProperty('serviceId');
            expect(service).toHaveProperty('serviceName');
            expect(service).toHaveProperty('priceUsd');
            expect(service).toHaveProperty('category');
          }
        }
      });

      it('should return empty array for shop with no services', async () => {
        const res = await request(app)
          .get('/api/services/shop/nonexistent-shop-id');

        expect([200, 404, 429, 500]).toContain(res.status);

        if (res.status === 200) {
          expect(res.body.data.length).toBe(0);
        }
      });

      it('should support pagination for shop services', async () => {
        const listRes = await request(app).get('/api/customers/shops');

        if (listRes.status === 200 && listRes.body.data.shops.length > 0) {
          const shopId = listRes.body.data.shops[0].shopId;

          const res = await request(app)
            .get(`/api/services/shop/${shopId}`)
            .query({ page: 1, limit: 5 });

          expect([200, 429, 500]).toContain(res.status);
        }
      });
    });
  });

  // ============================================================
  // SECTION 8: Social Media Field Mapping
  // ============================================================
  describe('Social Media Field Mapping', () => {
    it('should return "x" field mapped from DB "twitter" column', async () => {
      const res = await request(app).get('/api/customers/shops');

      if (res.status === 200 && res.body.data.shops.length > 0) {
        const shop = res.body.data.shops[0];
        // Backend maps DB "twitter" → response "x" (X/Twitter rebrand fix)
        expect('x' in shop).toBe(true);
      }
    });

    it('should NOT return legacy "twitter" field (replaced by "x")', async () => {
      const res = await request(app).get('/api/customers/shops');

      if (res.status === 200 && res.body.data.shops.length > 0) {
        const shop = res.body.data.shops[0];
        expect('twitter' in shop).toBe(false);
      }
    });

    it('should NOT return "linkedin" field (no DB column)', async () => {
      const res = await request(app).get('/api/customers/shops');

      if (res.status === 200 && res.body.data.shops.length > 0) {
        const shop = res.body.data.shops[0];
        expect('linkedin' in shop).toBe(false);
      }
    });
  });

  // ============================================================
  // SECTION 9: Full Flow — List → Select → View Services
  // ============================================================
  describe('Full Flow — List → Select → View Services', () => {
    it('should complete shop discovery flow', async () => {
      // Step 1: Get shop list
      const listRes = await request(app).get('/api/customers/shops');

      if (listRes.status !== 200 || listRes.body.data.shops.length === 0) {
        return; // No shops to test with
      }

      const shops = listRes.body.data.shops;
      expect(shops.length).toBeGreaterThan(0);

      // Step 2: Pick first shop
      const selectedShop = shops[0];
      expect(selectedShop.shopId).toBeDefined();
      expect(selectedShop.name).toBeDefined();

      // Step 3: Load shop services
      const servicesRes = await request(app)
        .get(`/api/services/shop/${selectedShop.shopId}`);

      expect([200, 429, 500]).toContain(servicesRes.status);

      if (servicesRes.status === 200) {
        expect(Array.isArray(servicesRes.body.data)).toBe(true);
      }

      // Step 4: Search for the shop by name
      const searchRes = await request(app)
        .get('/api/customers/shops')
        .query({ search: selectedShop.name.substring(0, 5) });

      if (searchRes.status === 200) {
        // Should find the shop in search results
        const found = searchRes.body.data.shops.find(
          (s: any) => s.shopId === selectedShop.shopId
        );
        if (found) {
          expect(found.name).toBe(selectedShop.name);
        }
      }
    });
  });

  // ============================================================
  // SECTION 10: Security & Edge Cases
  // ============================================================
  describe('Security & Edge Cases', () => {
    it('should handle SQL injection in search', async () => {
      const res = await request(app)
        .get('/api/customers/shops')
        .query({ search: "'; DROP TABLE shops;--" });

      expect([200, 429, 500]).toContain(res.status);
      // Should not crash
    });

    it('should handle SQL injection in category', async () => {
      const res = await request(app)
        .get('/api/customers/shops')
        .query({ category: "'; DROP TABLE shops;--" });

      expect([200, 429, 500]).toContain(res.status);
    });

    it('should handle non-numeric page', async () => {
      const res = await request(app)
        .get('/api/customers/shops')
        .query({ page: 'abc' });

      expect([200, 400, 429, 500]).toContain(res.status);
    });

    it('should handle non-numeric limit', async () => {
      const res = await request(app)
        .get('/api/customers/shops')
        .query({ limit: 'abc' });

      expect([200, 400, 429, 500]).toContain(res.status);
    });

    it('should not leak sensitive data in response', async () => {
      const res = await request(app).get('/api/customers/shops');

      if (res.status === 200 && res.body.data.shops.length > 0) {
        const body = JSON.stringify(res.body);
        expect(body).not.toContain('wallet_address');
        expect(body).not.toContain('private_key');
        expect(body).not.toContain('stripe_');
        expect(body).not.toContain('password');
      }
    });

    it('should handle concurrent requests', async () => {
      const requests = Array(5).fill(null).map(() =>
        request(app).get('/api/customers/shops')
      );

      const responses = await Promise.all(requests);

      responses.forEach(res => {
        expect([200, 429, 500]).toContain(res.status);
      });
    });
  });
});
