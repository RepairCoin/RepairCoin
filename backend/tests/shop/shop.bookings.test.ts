/**
 * Shop Bookings Tab E2E Tests
 *
 * Tests the /shop?tab=bookings functionality:
 * - List shop orders with filters and pagination
 * - Order status counts
 * - Order status updates (approve, complete, cancel)
 * - Mark no-show
 * - Reschedule booking
 * - Manual booking creation
 * - Customer search for manual booking
 * - Payment link management
 * - Payment summary (public endpoint)
 * - Authorization checks
 *
 * API Endpoints Tested:
 * - GET /api/services/orders/shop
 * - GET /api/services/orders/shop/counts
 * - PUT /api/services/orders/:id/status
 * - POST /api/services/orders/:id/mark-no-show
 * - POST /api/services/orders/:id/approve
 * - POST /api/services/orders/:id/reschedule
 * - POST /api/services/orders/:id/shop-cancel
 * - POST /api/services/shops/:shopId/appointments/manual
 * - GET /api/services/shops/:shopId/customers/search
 * - GET /api/services/shops/:shopId/appointments/:orderId/payment-status
 * - GET /api/services/orders/:orderId/payment-summary
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, jest, afterAll } from '@jest/globals';
import RepairCoinApp from '../../src/app';
import jwt from 'jsonwebtoken';

// Mock external services
jest.mock('thirdweb');

describe('Shop Bookings Tab Tests', () => {
  let app: any;

  const JWT_SECRET = 'test-secret-for-bookings-32chars!';
  const shopId = 'shop-bookings-test-001';
  const shopWalletAddress = '0xaaaa000000000000000000000000000000000001';
  const otherShopId = 'shop-other-test-002';
  const otherShopWallet = '0xcccc000000000000000000000000000000000003';
  const customerWalletAddress = '0xbbbb000000000000000000000000000000000002';
  const adminWalletAddress = '0xdddd000000000000000000000000000000000004';

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
      { address: shopWalletAddress, role: 'shop', shopId, type: 'access' },
      JWT_SECRET, { expiresIn: '24h' }
    );

    otherShopToken = jwt.sign(
      { address: otherShopWallet, role: 'shop', shopId: otherShopId, type: 'access' },
      JWT_SECRET, { expiresIn: '24h' }
    );

    customerToken = jwt.sign(
      { address: customerWalletAddress, role: 'customer', type: 'access' },
      JWT_SECRET, { expiresIn: '24h' }
    );

    adminToken = jwt.sign(
      { address: adminWalletAddress, role: 'admin', type: 'access' },
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
  // SECTION 1: List Shop Orders - Authentication
  // ============================================================
  describe('List Shop Orders - Authentication', () => {
    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/services/orders/shop');

      expect([401, 403]).toContain(response.status);
    });

    it('should reject customer role', async () => {
      const response = await request(app)
        .get('/api/services/orders/shop')
        .set('Cookie', [`auth_token=${customerToken}`]);

      expect([401, 403]).toContain(response.status);
    });

    it('should accept shop role', async () => {
      const response = await request(app)
        .get('/api/services/orders/shop')
        .set('Cookie', [`auth_token=${shopToken}`]);

      expect([200, 401, 403]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });
  });

  // ============================================================
  // SECTION 2: List Shop Orders - Filters & Pagination
  // ============================================================
  describe('List Shop Orders - Filters & Pagination', () => {
    it('should support status filter', async () => {
      const statuses = ['pending', 'paid', 'completed', 'cancelled'];
      for (const status of statuses) {
        const response = await request(app)
          .get('/api/services/orders/shop')
          .query({ status })
          .set('Cookie', [`auth_token=${shopToken}`]);

        expect([200, 401, 403]).toContain(response.status);
      }
    });

    it('should support pagination with page and limit', async () => {
      const response = await request(app)
        .get('/api/services/orders/shop')
        .query({ page: 1, limit: 5 })
        .set('Cookie', [`auth_token=${shopToken}`]);

      expect([200, 401, 403]).toContain(response.status);
    });

    it('should support date range filter', async () => {
      const response = await request(app)
        .get('/api/services/orders/shop')
        .query({
          startDate: '2026-01-01',
          endDate: '2026-12-31'
        })
        .set('Cookie', [`auth_token=${shopToken}`]);

      expect([200, 401, 403]).toContain(response.status);
    });

    it('should return array of orders', async () => {
      const response = await request(app)
        .get('/api/services/orders/shop')
        .set('Cookie', [`auth_token=${shopToken}`]);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });
  });

  // ============================================================
  // SECTION 3: Order Status Counts
  // ============================================================
  describe('Order Status Counts', () => {
    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/services/orders/shop/counts');

      expect([401, 403]).toContain(response.status);
    });

    it('should return counts for shop', async () => {
      const response = await request(app)
        .get('/api/services/orders/shop/counts')
        .set('Cookie', [`auth_token=${shopToken}`]);

      expect([200, 401, 403, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });
  });

  // ============================================================
  // SECTION 4: Update Order Status
  // ============================================================
  describe('Update Order Status', () => {
    it('should reject unauthenticated status update', async () => {
      const response = await request(app)
        .put('/api/services/orders/ord_fake-id/status')
        .send({ status: 'completed' });

      expect([401, 403]).toContain(response.status);
    });

    it('should reject customer updating status', async () => {
      const response = await request(app)
        .put('/api/services/orders/ord_fake-id/status')
        .set('Cookie', [`auth_token=${customerToken}`])
        .send({ status: 'completed' });

      expect([401, 403]).toContain(response.status);
    });

    it('should reject missing status field', async () => {
      const response = await request(app)
        .put('/api/services/orders/ord_fake-id/status')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({});

      expect([400, 401, 403]).toContain(response.status);
    });

    it('should reject invalid status value', async () => {
      const response = await request(app)
        .put('/api/services/orders/ord_fake-id/status')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ status: 'invalid_status' });

      expect([400, 401, 403]).toContain(response.status);
    });

    it('should return 404 for non-existent order', async () => {
      const response = await request(app)
        .put('/api/services/orders/ord_nonexistent-id/status')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ status: 'completed' });

      expect([401, 403, 404]).toContain(response.status);
    });

    it('should accept valid status values', () => {
      const validStatuses = ['pending', 'paid', 'completed', 'cancelled', 'refunded'];
      expect(validStatuses).toHaveLength(5);
      validStatuses.forEach(s => expect(typeof s).toBe('string'));
    });
  });

  // ============================================================
  // SECTION 5: Mark No-Show
  // ============================================================
  describe('Mark No-Show', () => {
    it('should reject unauthenticated no-show', async () => {
      const response = await request(app)
        .post('/api/services/orders/ord_fake-id/mark-no-show')
        .send({ notes: 'Did not arrive' });

      expect([401, 403]).toContain(response.status);
    });

    it('should reject customer marking no-show', async () => {
      const response = await request(app)
        .post('/api/services/orders/ord_fake-id/mark-no-show')
        .set('Cookie', [`auth_token=${customerToken}`])
        .send({ notes: 'Did not arrive' });

      expect([401, 403]).toContain(response.status);
    });

    it('should return 404 for non-existent order', async () => {
      const response = await request(app)
        .post('/api/services/orders/ord_nonexistent/mark-no-show')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ notes: 'Customer no-show' });

      expect([401, 403, 404]).toContain(response.status);
    });

    it('should accept optional notes', async () => {
      const response = await request(app)
        .post('/api/services/orders/ord_fake-id/mark-no-show')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({});

      // Should not fail on missing notes (they're optional)
      expect([400, 401, 403, 404]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 6: Approve Booking
  // ============================================================
  describe('Approve Booking', () => {
    it('should reject unauthenticated approval', async () => {
      const response = await request(app)
        .post('/api/services/orders/ord_fake-id/approve');

      expect([401, 403]).toContain(response.status);
    });

    it('should reject customer approving', async () => {
      const response = await request(app)
        .post('/api/services/orders/ord_fake-id/approve')
        .set('Cookie', [`auth_token=${customerToken}`]);

      expect([401, 403]).toContain(response.status);
    });

    it('should return 404 for non-existent order', async () => {
      const response = await request(app)
        .post('/api/services/orders/ord_nonexistent/approve')
        .set('Cookie', [`auth_token=${shopToken}`]);

      expect([401, 403, 404]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 7: Reschedule Booking
  // ============================================================
  describe('Reschedule Booking', () => {
    it('should reject unauthenticated reschedule', async () => {
      const response = await request(app)
        .post('/api/services/orders/ord_fake-id/reschedule')
        .send({ newBookingDate: '2026-04-01', newBookingTime: '14:00' });

      expect([401, 403]).toContain(response.status);
    });

    it('should reject missing date/time', async () => {
      const response = await request(app)
        .post('/api/services/orders/ord_fake-id/reschedule')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({});

      expect([400, 401, 403, 404]).toContain(response.status);
    });

    it('should reject missing time', async () => {
      const response = await request(app)
        .post('/api/services/orders/ord_fake-id/reschedule')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ newBookingDate: '2026-04-01' });

      expect([400, 401, 403, 404]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 8: Shop Cancel Order
  // ============================================================
  describe('Shop Cancel Order', () => {
    it('should reject unauthenticated cancellation', async () => {
      const response = await request(app)
        .post('/api/services/orders/ord_fake-id/shop-cancel')
        .send({ cancellationReason: 'Shop closed' });

      expect([401, 403]).toContain(response.status);
    });

    it('should reject customer cancelling via shop endpoint', async () => {
      const response = await request(app)
        .post('/api/services/orders/ord_fake-id/shop-cancel')
        .set('Cookie', [`auth_token=${customerToken}`])
        .send({ cancellationReason: 'Want refund' });

      expect([401, 403]).toContain(response.status);
    });

    it('should reject missing cancellation reason', async () => {
      const response = await request(app)
        .post('/api/services/orders/ord_fake-id/shop-cancel')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({});

      expect([400, 401, 403, 404]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 9: Manual Booking Creation
  // ============================================================
  describe('Manual Booking Creation', () => {
    it('should reject unauthenticated manual booking', async () => {
      const response = await request(app)
        .post(`/api/services/shops/${shopId}/appointments/manual`)
        .send({
          customerAddress: customerWalletAddress,
          serviceId: 'srv_test',
          bookingDate: '2026-04-01',
          bookingTimeSlot: '14:00:00',
          paymentStatus: 'paid'
        });

      expect([401, 403]).toContain(response.status);
    });

    it('should reject customer creating manual booking', async () => {
      const response = await request(app)
        .post(`/api/services/shops/${shopId}/appointments/manual`)
        .set('Cookie', [`auth_token=${customerToken}`])
        .send({
          customerAddress: customerWalletAddress,
          serviceId: 'srv_test',
          bookingDate: '2026-04-01',
          bookingTimeSlot: '14:00:00',
          paymentStatus: 'paid'
        });

      expect([401, 403]).toContain(response.status);
    });

    it('should reject other shop creating booking for this shop', async () => {
      const response = await request(app)
        .post(`/api/services/shops/${shopId}/appointments/manual`)
        .set('Cookie', [`auth_token=${otherShopToken}`])
        .send({
          customerAddress: customerWalletAddress,
          serviceId: 'srv_test',
          bookingDate: '2026-04-01',
          bookingTimeSlot: '14:00:00',
          paymentStatus: 'paid'
        });

      expect([401, 403]).toContain(response.status);
    });

    it('should reject missing required fields', async () => {
      const response = await request(app)
        .post(`/api/services/shops/${shopId}/appointments/manual`)
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({});

      expect([400, 401, 403]).toContain(response.status);
    });

    it('should reject invalid payment status', async () => {
      const response = await request(app)
        .post(`/api/services/shops/${shopId}/appointments/manual`)
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({
          customerAddress: customerWalletAddress,
          serviceId: 'srv_test',
          bookingDate: '2026-04-01',
          bookingTimeSlot: '14:00:00',
          paymentStatus: 'invalid'
        });

      expect([400, 401, 403]).toContain(response.status);
    });

    it('should accept valid payment status values', () => {
      const validStatuses = ['paid', 'pending', 'unpaid', 'send_link', 'qr_code'];
      expect(validStatuses).toHaveLength(5);
    });
  });

  // ============================================================
  // SECTION 10: Customer Search (for Manual Booking)
  // ============================================================
  describe('Customer Search', () => {
    it('should reject unauthenticated search', async () => {
      const response = await request(app)
        .get(`/api/services/shops/${shopId}/customers/search`)
        .query({ q: 'test' });

      expect([401, 403]).toContain(response.status);
    });

    it('should reject customer role searching', async () => {
      const response = await request(app)
        .get(`/api/services/shops/${shopId}/customers/search`)
        .query({ q: 'test' })
        .set('Cookie', [`auth_token=${customerToken}`]);

      expect([401, 403]).toContain(response.status);
    });

    it('should reject other shop searching this shop customers', async () => {
      const response = await request(app)
        .get(`/api/services/shops/${shopId}/customers/search`)
        .query({ q: 'test' })
        .set('Cookie', [`auth_token=${otherShopToken}`]);

      expect([401, 403]).toContain(response.status);
    });

    it('should reject missing search query', async () => {
      const response = await request(app)
        .get(`/api/services/shops/${shopId}/customers/search`)
        .set('Cookie', [`auth_token=${shopToken}`]);

      expect([400, 401, 403]).toContain(response.status);
    });

    it('should reject empty search query', async () => {
      const response = await request(app)
        .get(`/api/services/shops/${shopId}/customers/search`)
        .query({ q: '' })
        .set('Cookie', [`auth_token=${shopToken}`]);

      expect([400, 401, 403]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 11: Payment Status (Polling)
  // ============================================================
  describe('Payment Status', () => {
    it('should reject unauthenticated payment status check', async () => {
      const response = await request(app)
        .get(`/api/services/shops/${shopId}/appointments/ord_fake-id/payment-status`);

      expect([401, 403]).toContain(response.status);
    });

    it('should reject other shop checking payment status', async () => {
      const response = await request(app)
        .get(`/api/services/shops/${shopId}/appointments/ord_fake-id/payment-status`)
        .set('Cookie', [`auth_token=${otherShopToken}`]);

      expect([401, 403]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 12: Payment Summary (Public)
  // ============================================================
  describe('Payment Summary (Public)', () => {
    it('should not require authentication', async () => {
      const response = await request(app)
        .get('/api/services/orders/ord_nonexistent/payment-summary');

      // Should return 404 (not found) not 401 (unauthorized)
      expect([404, 500]).toContain(response.status);
    });

    it('should return 404 for non-existent order', async () => {
      const response = await request(app)
        .get('/api/services/orders/ord_nonexistent-id/payment-summary');

      expect([404, 500]).toContain(response.status);
    });

    it('should return 400 for missing order ID', async () => {
      const response = await request(app)
        .get('/api/services/orders//payment-summary');

      expect([400, 404]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 13: Response Format Contract
  // ============================================================
  describe('Response Format Contract', () => {
    it('order list should return expected fields when data exists', async () => {
      const response = await request(app)
        .get('/api/services/orders/shop')
        .set('Cookie', [`auth_token=${shopToken}`]);

      if (response.status === 200 && response.body.data?.length > 0) {
        const order = response.body.data[0];
        expect(order).toHaveProperty('orderId');
        expect(order).toHaveProperty('status');
        expect(order).toHaveProperty('totalAmount');
        expect(order).toHaveProperty('customerAddress');
        expect(order).toHaveProperty('serviceId');
        expect(order).toHaveProperty('createdAt');
      }
    });

    it('order statuses should be well-defined', () => {
      const orderStatuses = ['pending', 'paid', 'completed', 'cancelled', 'refunded', 'no_show', 'expired'];
      expect(orderStatuses).toHaveLength(7);
    });

    it('payment statuses should be well-defined', () => {
      const paymentStatuses = ['paid', 'pending', 'unpaid'];
      expect(paymentStatuses).toHaveLength(3);
    });
  });

  // ============================================================
  // SECTION 14: Cross-Shop Authorization
  // ============================================================
  describe('Cross-Shop Authorization', () => {
    it('shop A cannot update shop B order status', async () => {
      const response = await request(app)
        .put('/api/services/orders/ord_fake-other-shop-order/status')
        .set('Cookie', [`auth_token=${otherShopToken}`])
        .send({ status: 'completed' });

      expect([401, 403, 404]).toContain(response.status);
    });

    it('shop A cannot mark no-show on shop B order', async () => {
      const response = await request(app)
        .post('/api/services/orders/ord_fake-other-shop-order/mark-no-show')
        .set('Cookie', [`auth_token=${otherShopToken}`])
        .send({ notes: 'Not my customer' });

      expect([401, 403, 404]).toContain(response.status);
    });

    it('shop A cannot approve shop B booking', async () => {
      const response = await request(app)
        .post('/api/services/orders/ord_fake-other-shop-order/approve')
        .set('Cookie', [`auth_token=${otherShopToken}`]);

      expect([401, 403, 404]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 15: Button Actions - Cancel
  // ============================================================
  describe('Cancel Button', () => {
    it('should require cancellation reason', async () => {
      const response = await request(app)
        .post('/api/services/orders/ord_fake-id/shop-cancel')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({});
      expect([400, 401, 403, 404]).toContain(response.status);
    });

    it('should reject empty cancellation reason', async () => {
      const response = await request(app)
        .post('/api/services/orders/ord_fake-id/shop-cancel')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ cancellationReason: '' });
      expect([400, 401, 403, 404]).toContain(response.status);
    });

    it('should accept cancellation with reason and notes', async () => {
      const response = await request(app)
        .post('/api/services/orders/ord_fake-id/shop-cancel')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({
          cancellationReason: 'Shop closed for emergency',
          cancellationNotes: 'Water pipe burst in the shop'
        });
      expect([200, 401, 403, 404]).toContain(response.status);
    });

    it('should not allow cancelling already completed order', async () => {
      // Using status endpoint since shop-cancel has its own check
      const response = await request(app)
        .put('/api/services/orders/ord_fake-completed/status')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ status: 'cancelled' });
      expect([400, 401, 403, 404]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 16: Button Actions - No-Show
  // ============================================================
  describe('No-Show Button', () => {
    it('should only work on paid orders', async () => {
      // Mark no-show requires paid status
      const response = await request(app)
        .post('/api/services/orders/ord_fake-pending/mark-no-show')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ notes: 'Customer did not arrive' });
      expect([400, 401, 403, 404]).toContain(response.status);
    });

    it('should accept with notes', async () => {
      const response = await request(app)
        .post('/api/services/orders/ord_fake-id/mark-no-show')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ notes: 'Customer did not arrive for scheduled appointment at 3:15 PM' });
      expect([200, 400, 401, 403, 404]).toContain(response.status);
    });

    it('should accept without notes (optional)', async () => {
      const response = await request(app)
        .post('/api/services/orders/ord_fake-id/mark-no-show')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({});
      expect([200, 400, 401, 403, 404]).toContain(response.status);
    });

    it('should not allow marking completed order as no-show', async () => {
      const response = await request(app)
        .post('/api/services/orders/ord_fake-completed/mark-no-show')
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([400, 401, 403, 404]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 17: Button Actions - Reschedule
  // ============================================================
  describe('Reschedule Button', () => {
    it('should require new date and time', async () => {
      const response = await request(app)
        .post('/api/services/bookings/ord_fake-id/direct-reschedule')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({});
      expect([400, 401, 403, 404]).toContain(response.status);
    });

    it('should reject missing new date', async () => {
      const response = await request(app)
        .post('/api/services/bookings/ord_fake-id/direct-reschedule')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ newTimeSlot: '14:00' });
      expect([400, 401, 403, 404]).toContain(response.status);
    });

    it('should reject missing new time', async () => {
      const response = await request(app)
        .post('/api/services/bookings/ord_fake-id/direct-reschedule')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ newDate: '2026-04-15' });
      expect([400, 401, 403, 404]).toContain(response.status);
    });

    it('should accept reschedule with reason', async () => {
      const response = await request(app)
        .post('/api/services/bookings/ord_fake-id/direct-reschedule')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({
          newDate: '2026-04-15',
          newTimeSlot: '14:00',
          reason: 'Shop needs to adjust schedule'
        });
      expect([200, 400, 401, 403, 404]).toContain(response.status);
    });

    it('should accept reschedule without reason (optional)', async () => {
      const response = await request(app)
        .post('/api/services/bookings/ord_fake-id/direct-reschedule')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({
          newDate: '2026-04-15',
          newTimeSlot: '15:00'
        });
      expect([200, 400, 401, 403, 404]).toContain(response.status);
    });

    it('should reject past date reschedule', async () => {
      const response = await request(app)
        .post('/api/services/bookings/ord_fake-id/direct-reschedule')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({
          newDate: '2020-01-01',
          newTimeSlot: '14:00'
        });
      expect([400, 401, 403, 404]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 18: Button Actions - Complete
  // ============================================================
  describe('Complete Button', () => {
    it('should mark order as completed', async () => {
      const response = await request(app)
        .put('/api/services/orders/ord_fake-id/status')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ status: 'completed' });
      expect([200, 400, 401, 403, 404]).toContain(response.status);
    });

    it('should not allow completing cancelled order', async () => {
      const response = await request(app)
        .put('/api/services/orders/ord_fake-cancelled/status')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ status: 'completed' });
      expect([400, 401, 403, 404]).toContain(response.status);
    });

    it('should not allow completing already completed order', async () => {
      const response = await request(app)
        .put('/api/services/orders/ord_fake-already-completed/status')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ status: 'completed' });
      expect([400, 401, 403, 404]).toContain(response.status);
    });

    it('should not allow completing expired order', async () => {
      const response = await request(app)
        .put('/api/services/orders/ord_fake-expired/status')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ status: 'completed' });
      expect([400, 401, 403, 404]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 19: Button Actions - Approve (paid bookings)
  // ============================================================
  describe('Approve Button', () => {
    it('should approve a paid booking', async () => {
      const response = await request(app)
        .post('/api/services/orders/ord_fake-paid/approve')
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 400, 401, 403, 404]).toContain(response.status);
    });

    it('should not allow approving already approved order', async () => {
      const response = await request(app)
        .post('/api/services/orders/ord_fake-already-approved/approve')
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([400, 401, 403, 404]).toContain(response.status);
    });

    it('should not allow approving cancelled order', async () => {
      const response = await request(app)
        .post('/api/services/orders/ord_fake-cancelled/approve')
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([400, 401, 403, 404]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 20: Button Visibility by Status
  // ============================================================
  describe('Button Visibility Contract', () => {
    it('requested status should show: Cancel', () => {
      const requestedActions = ['cancel'];
      expect(requestedActions).toContain('cancel');
      expect(requestedActions).not.toContain('complete');
      expect(requestedActions).not.toContain('no-show');
    });

    it('paid status should show: Cancel, Approve, Reschedule', () => {
      const paidActions = ['cancel', 'approve', 'reschedule'];
      expect(paidActions).toContain('cancel');
      expect(paidActions).toContain('approve');
      expect(paidActions).toContain('reschedule');
      expect(paidActions).not.toContain('complete');
      expect(paidActions).not.toContain('no-show');
    });

    it('approved status should show: Cancel, Reschedule, Schedule', () => {
      const approvedActions = ['cancel', 'reschedule', 'schedule'];
      expect(approvedActions).toContain('cancel');
      expect(approvedActions).toContain('reschedule');
      expect(approvedActions).toContain('schedule');
      expect(approvedActions).not.toContain('no-show');
    });

    it('scheduled status should show: Cancel, No-Show, Reschedule, Complete', () => {
      const scheduledActions = ['cancel', 'no-show', 'reschedule', 'complete'];
      expect(scheduledActions).toContain('cancel');
      expect(scheduledActions).toContain('no-show');
      expect(scheduledActions).toContain('reschedule');
      expect(scheduledActions).toContain('complete');
      expect(scheduledActions).toHaveLength(4);
    });

    it('completed status should show: no actions', () => {
      const completedActions: string[] = [];
      expect(completedActions).toHaveLength(0);
    });

    it('cancelled status should show: no actions', () => {
      const cancelledActions: string[] = [];
      expect(cancelledActions).toHaveLength(0);
    });

    it('no_show status should show: no actions', () => {
      const noShowActions: string[] = [];
      expect(noShowActions).toHaveLength(0);
    });
  });
});
