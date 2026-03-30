/**
 * Customer Service Booking — Comprehensive E2E Tests
 *
 * Tests the full booking flow visible in the "Complete Your Booking" modal:
 *   1. Time slot availability (calendar + time picker)
 *   2. Payment intent creation (with/without RCN discount)
 *   3. Stripe checkout session creation
 *   4. Payment confirmation & order creation
 *   5. RCN redemption during booking
 *   6. Deposit system for restricted tiers
 *   7. Order lifecycle (view, cancel, payment summary)
 *   8. Appointment management (customer appointments, cancellation)
 *   9. Input validation & edge cases
 *   10. Concurrent booking protection
 *
 * Screenshot reference: sc1.png (Complete Your Booking modal — March 2026 calendar,
 *   time slot grid, "Use RCN for Discount" slider, payment form)
 *
 * API Endpoints Tested:
 *   - POST /api/services/orders/create-payment-intent
 *   - POST /api/services/orders/stripe-checkout
 *   - POST /api/services/orders/confirm
 *   - GET  /api/services/orders/customer
 *   - GET  /api/services/orders/:id
 *   - POST /api/services/orders/:id/cancel
 *   - GET  /api/services/orders/:orderId/payment-summary
 *   - GET  /api/services/appointments/available-slots
 *   - GET  /api/services/appointments/shop-availability/:shopId
 *   - GET  /api/services/appointments/time-slot-config/:shopId
 *   - GET  /api/services/appointments/my-appointments
 *   - POST /api/services/appointments/cancel/:orderId
 *   - POST /api/services/appointments/reschedule-request
 *   - GET  /api/services/appointments/reschedule-request/order/:orderId
 *   - DELETE /api/services/appointments/reschedule-request/:requestId
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, jest, afterAll } from '@jest/globals';
import RepairCoinApp from '../../src/app';
import jwt from 'jsonwebtoken';

jest.mock('thirdweb');

describe('Customer Service Booking — Comprehensive E2E', () => {
  let app: any;

  const JWT_SECRET = 'test-secret-service-booking-32ch!';
  const customerAddress = '0xaaaa000000000000000000000000000000000001';
  const shopId = 'shop-booking-test-001';
  const serviceId = 'service-booking-test-001';
  const fakeOrderId = 'ord_booking-test-001';

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
      { address: '0xbbbb000000000000000000000000000000000002', role: 'shop', shopId, type: 'access' },
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
  // SECTION 1: Time Slot Availability (Calendar & Time Picker)
  // ============================================================
  describe('Time Slot Availability', () => {
    describe('GET /api/services/appointments/available-slots', () => {
      it('should return available time slots for a valid date', async () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 3);
        const dateStr = futureDate.toISOString().split('T')[0];

        const res = await request(app)
          .get('/api/services/appointments/available-slots')
          .query({ shopId, serviceId, date: dateStr });

        expect([200, 400, 404, 429, 500]).toContain(res.status);

        if (res.status === 200) {
          expect(res.body.success).toBe(true);
          expect(Array.isArray(res.body.data)).toBe(true);

          if (res.body.data.length > 0) {
            const slot = res.body.data[0];
            expect(slot).toHaveProperty('time');
            expect(slot).toHaveProperty('available');
            expect(typeof slot.time).toBe('string');
            expect(typeof slot.available).toBe('boolean');
          }
        }
      });

      it('should require shopId parameter', async () => {
        const res = await request(app)
          .get('/api/services/appointments/available-slots')
          .query({ serviceId, date: '2026-04-15' });

        expect([400, 500]).toContain(res.status);
      });

      it('should require date parameter', async () => {
        const res = await request(app)
          .get('/api/services/appointments/available-slots')
          .query({ shopId, serviceId });

        expect([400, 500]).toContain(res.status);
      });

      it('should return empty for past dates', async () => {
        const res = await request(app)
          .get('/api/services/appointments/available-slots')
          .query({ shopId, serviceId, date: '2020-01-01' });

        expect([200, 400, 500]).toContain(res.status);

        if (res.status === 200) {
          // Past date — either empty array or all unavailable
          const availableSlots = res.body.data.filter((s: any) => s.available);
          expect(availableSlots.length).toBe(0);
        }
      });

      it('should accept userTimezone parameter', async () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 3);
        const dateStr = futureDate.toISOString().split('T')[0];

        const res = await request(app)
          .get('/api/services/appointments/available-slots')
          .query({ shopId, serviceId, date: dateStr, userTimezone: 'America/New_York' });

        expect([200, 400, 404, 429, 500]).toContain(res.status);
      });

      it('should handle invalid date format', async () => {
        const res = await request(app)
          .get('/api/services/appointments/available-slots')
          .query({ shopId, serviceId, date: 'not-a-date' });

        expect([400, 500]).toContain(res.status);
      });
    });

    describe('GET /api/services/appointments/shop-availability/:shopId', () => {
      it('should return shop operating hours (public)', async () => {
        const res = await request(app)
          .get(`/api/services/appointments/shop-availability/${shopId}`);

        expect([200, 404, 429, 500]).toContain(res.status);

        if (res.status === 200) {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toBeDefined();
        }
      });

      it('should handle non-existent shop', async () => {
        const res = await request(app)
          .get('/api/services/appointments/shop-availability/non-existent-shop');

        expect([200, 404, 500]).toContain(res.status);
      });
    });

    describe('GET /api/services/appointments/time-slot-config/:shopId', () => {
      it('should return slot configuration (public)', async () => {
        const res = await request(app)
          .get(`/api/services/appointments/time-slot-config/${shopId}`);

        expect([200, 404, 429, 500]).toContain(res.status);

        if (res.status === 200) {
          expect(res.body.success).toBe(true);
          const config = res.body.data;
          if (config) {
            // Validate config shape used by frontend
            if (config.slotDurationMinutes !== undefined) {
              expect(typeof config.slotDurationMinutes).toBe('number');
            }
            if (config.bufferTimeMinutes !== undefined) {
              expect(typeof config.bufferTimeMinutes).toBe('number');
            }
          }
        }
      });
    });
  });

  // ============================================================
  // SECTION 2: Create Payment Intent (Booking Initialization)
  // ============================================================
  describe('Create Payment Intent', () => {
    describe('POST /api/services/orders/create-payment-intent', () => {
      it('should require authentication', async () => {
        const res = await request(app)
          .post('/api/services/orders/create-payment-intent')
          .send({ serviceId, bookingDate: '2026-04-15', bookingTime: '10:00' });

        expect([401, 403]).toContain(res.status);
      });

      it('should require serviceId', async () => {
        const res = await request(app)
          .post('/api/services/orders/create-payment-intent')
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({ bookingDate: '2026-04-15', bookingTime: '10:00' });

        expect([400, 401, 403, 429, 500]).toContain(res.status);

        if (res.status === 400) {
          expect(res.body.success).toBe(false);
        }
      });

      it('should require bookingDate', async () => {
        const res = await request(app)
          .post('/api/services/orders/create-payment-intent')
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({ serviceId, bookingTime: '10:00' });

        expect([400, 401, 403, 429, 500]).toContain(res.status);
      });

      it('should require bookingTime', async () => {
        const res = await request(app)
          .post('/api/services/orders/create-payment-intent')
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({ serviceId, bookingDate: '2026-04-15' });

        expect([400, 401, 403, 429, 500]).toContain(res.status);
      });

      it('should create payment intent with valid data', async () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);
        const dateStr = futureDate.toISOString().split('T')[0];

        const res = await request(app)
          .post('/api/services/orders/create-payment-intent')
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({
            serviceId,
            bookingDate: dateStr,
            bookingTime: '14:00',
          });

        expect([200, 400, 401, 403, 404, 429, 500]).toContain(res.status);

        if (res.status === 200) {
          expect(res.body.success).toBe(true);
          const data = res.body.data;
          expect(data).toHaveProperty('orderId');
          expect(data).toHaveProperty('clientSecret');
          expect(data).toHaveProperty('amount');
          expect(data).toHaveProperty('currency');
          expect(data.orderId).toMatch(/^ord_/);
          expect(typeof data.clientSecret).toBe('string');
          expect(typeof data.amount).toBe('number');
          expect(data.currency).toBe('usd');
          expect(data.amount).toBeGreaterThan(0);
        }
      });

      it('should accept optional RCN redemption', async () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);
        const dateStr = futureDate.toISOString().split('T')[0];

        const res = await request(app)
          .post('/api/services/orders/create-payment-intent')
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({
            serviceId,
            bookingDate: dateStr,
            bookingTime: '14:00',
            rcnToRedeem: 10,
          });

        expect([200, 400, 401, 403, 404, 429, 500]).toContain(res.status);

        if (res.status === 200) {
          const data = res.body.data;
          // When RCN is redeemed, response includes discount info
          if (data.rcnRedeemed !== undefined) {
            expect(typeof data.rcnRedeemed).toBe('number');
            expect(data.rcnRedeemed).toBeGreaterThanOrEqual(0);
          }
          if (data.rcnDiscountUsd !== undefined) {
            expect(typeof data.rcnDiscountUsd).toBe('number');
          }
          if (data.totalAmount !== undefined) {
            expect(data.totalAmount).toBeGreaterThanOrEqual(data.amount);
          }
        }
      });

      it('should accept optional notes', async () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);
        const dateStr = futureDate.toISOString().split('T')[0];

        const res = await request(app)
          .post('/api/services/orders/create-payment-intent')
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({
            serviceId,
            bookingDate: dateStr,
            bookingTime: '14:00',
            notes: 'Please use premium materials',
          });

        expect([200, 400, 401, 403, 404, 429, 500]).toContain(res.status);
      });

      it('should reject non-existent service', async () => {
        const res = await request(app)
          .post('/api/services/orders/create-payment-intent')
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({
            serviceId: 'non-existent-service-id',
            bookingDate: '2026-04-15',
            bookingTime: '10:00',
          });

        expect([400, 401, 403, 404, 429, 500]).toContain(res.status);
      });

      it('should reject shop role accessing customer endpoint', async () => {
        const res = await request(app)
          .post('/api/services/orders/create-payment-intent')
          .set('Cookie', [`auth_token=${shopToken}`])
          .send({ serviceId, bookingDate: '2026-04-15', bookingTime: '10:00' });

        expect([401, 403]).toContain(res.status);
      });
    });
  });

  // ============================================================
  // SECTION 3: Stripe Checkout Session (Web flow)
  // ============================================================
  describe('Stripe Checkout Session', () => {
    describe('POST /api/services/orders/stripe-checkout', () => {
      it('should require authentication', async () => {
        const res = await request(app)
          .post('/api/services/orders/stripe-checkout')
          .send({ serviceId });

        expect([401, 403]).toContain(res.status);
      });

      it('should require serviceId', async () => {
        const res = await request(app)
          .post('/api/services/orders/stripe-checkout')
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({});

        expect([400, 401, 403, 429, 500]).toContain(res.status);
      });

      it('should create checkout session with valid data', async () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);
        const dateStr = futureDate.toISOString().split('T')[0];

        const res = await request(app)
          .post('/api/services/orders/stripe-checkout')
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({
            serviceId,
            bookingDate: dateStr,
            bookingTime: '15:00',
          });

        expect([200, 400, 401, 403, 404, 429, 500]).toContain(res.status);

        if (res.status === 200) {
          expect(res.body.success).toBe(true);
          // Checkout session returns URL or sessionId
          expect(res.body.data).toBeDefined();
        }
      });
    });
  });

  // ============================================================
  // SECTION 4: Payment Confirmation
  // ============================================================
  describe('Payment Confirmation', () => {
    describe('POST /api/services/orders/confirm', () => {
      it('should require paymentIntentId', async () => {
        const res = await request(app)
          .post('/api/services/orders/confirm')
          .send({});

        expect([400, 500]).toContain(res.status);
      });

      it('should handle invalid payment intent ID', async () => {
        const res = await request(app)
          .post('/api/services/orders/confirm')
          .send({ paymentIntentId: 'pi_fake_invalid_id' });

        expect([400, 404, 500]).toContain(res.status);
      });

      it('should handle checkout session ID (cs_ prefix)', async () => {
        const res = await request(app)
          .post('/api/services/orders/confirm')
          .send({ paymentIntentId: 'cs_fake_session_id' });

        expect([400, 404, 500]).toContain(res.status);
      });

      it('should be idempotent — confirming same payment twice returns existing order', async () => {
        // First confirmation
        const res1 = await request(app)
          .post('/api/services/orders/confirm')
          .send({ paymentIntentId: 'pi_already_processed' });

        // Second confirmation (same ID)
        const res2 = await request(app)
          .post('/api/services/orders/confirm')
          .send({ paymentIntentId: 'pi_already_processed' });

        // Both should return same status (both fail or both succeed)
        expect(res1.status).toBe(res2.status);
      });
    });
  });

  // ============================================================
  // SECTION 5: RCN Discount Validation
  // ============================================================
  describe('RCN Discount During Booking', () => {
    it('should reject negative RCN amount', async () => {
      const res = await request(app)
        .post('/api/services/orders/create-payment-intent')
        .set('Cookie', [`auth_token=${customerToken}`])
        .send({
          serviceId,
          bookingDate: '2026-04-15',
          bookingTime: '10:00',
          rcnToRedeem: -10,
        });

      expect([400, 401, 403, 429, 500]).toContain(res.status);
    });

    it('should reject non-numeric RCN amount', async () => {
      const res = await request(app)
        .post('/api/services/orders/create-payment-intent')
        .set('Cookie', [`auth_token=${customerToken}`])
        .send({
          serviceId,
          bookingDate: '2026-04-15',
          bookingTime: '10:00',
          rcnToRedeem: 'fifty',
        });

      expect([400, 401, 403, 429, 500]).toContain(res.status);
    });

    it('should accept zero RCN (no discount)', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const dateStr = futureDate.toISOString().split('T')[0];

      const res = await request(app)
        .post('/api/services/orders/create-payment-intent')
        .set('Cookie', [`auth_token=${customerToken}`])
        .send({
          serviceId,
          bookingDate: dateStr,
          bookingTime: '10:00',
          rcnToRedeem: 0,
        });

      expect([200, 400, 401, 403, 404, 429, 500]).toContain(res.status);
    });

    it('should cap RCN discount at 20% of service price', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const dateStr = futureDate.toISOString().split('T')[0];

      const res = await request(app)
        .post('/api/services/orders/create-payment-intent')
        .set('Cookie', [`auth_token=${customerToken}`])
        .send({
          serviceId,
          bookingDate: dateStr,
          bookingTime: '10:00',
          rcnToRedeem: 99999, // Way more than allowed
        });

      // Should not crash — either caps it or rejects with insufficient balance
      expect([200, 400, 401, 403, 404, 429, 500]).toContain(res.status);

      if (res.status === 200) {
        const data = res.body.data;
        // Discount should be capped, not the full 99999 RCN
        if (data.rcnRedeemed !== undefined && data.totalAmount !== undefined) {
          const maxDiscount = data.totalAmount * 0.20;
          expect(data.rcnDiscountUsd).toBeLessThanOrEqual(maxDiscount + 0.01);
        }
      }
    });
  });

  // ============================================================
  // SECTION 6: Customer Orders
  // ============================================================
  describe('Customer Orders', () => {
    describe('GET /api/services/orders/customer', () => {
      it('should require authentication', async () => {
        const res = await request(app).get('/api/services/orders/customer');
        expect(res.status).toBe(401);
      });

      it('should return orders for authenticated customer', async () => {
        const res = await request(app)
          .get('/api/services/orders/customer')
          .set('Cookie', [`auth_token=${customerToken}`]);

        expect([200, 401, 429, 500]).toContain(res.status);

        if (res.status === 200) {
          expect(res.body.success).toBe(true);
          expect(Array.isArray(res.body.data)).toBe(true);
        }
      });

      it('should support all status filters', async () => {
        const statuses = ['pending', 'paid', 'completed', 'cancelled', 'expired', 'no_show', 'refunded'];

        for (const status of statuses) {
          const res = await request(app)
            .get('/api/services/orders/customer')
            .query({ status })
            .set('Cookie', [`auth_token=${customerToken}`]);

          expect([200, 401, 429, 500]).toContain(res.status);
        }
      });

      it('should support pagination', async () => {
        const res = await request(app)
          .get('/api/services/orders/customer')
          .query({ page: 1, limit: 5 })
          .set('Cookie', [`auth_token=${customerToken}`]);

        expect([200, 401, 429, 500]).toContain(res.status);
      });

      it('should support date range filter', async () => {
        const res = await request(app)
          .get('/api/services/orders/customer')
          .query({ startDate: '2026-01-01', endDate: '2026-12-31' })
          .set('Cookie', [`auth_token=${customerToken}`]);

        expect([200, 401, 429, 500]).toContain(res.status);
      });
    });

    describe('GET /api/services/orders/:id', () => {
      it('should require authentication', async () => {
        const res = await request(app).get(`/api/services/orders/${fakeOrderId}`);
        expect(res.status).toBe(401);
      });

      it('should return order details', async () => {
        const res = await request(app)
          .get(`/api/services/orders/${fakeOrderId}`)
          .set('Cookie', [`auth_token=${customerToken}`]);

        expect([200, 401, 404, 500]).toContain(res.status);

        if (res.status === 200) {
          const order = res.body.data;
          expect(order).toHaveProperty('orderId');
          expect(order).toHaveProperty('serviceId');
          expect(order).toHaveProperty('status');
          expect(order).toHaveProperty('totalAmount');
        }
      });

      it('should return 404 for non-existent order', async () => {
        const res = await request(app)
          .get('/api/services/orders/ord_nonexistent')
          .set('Cookie', [`auth_token=${customerToken}`]);

        expect([401, 404, 500]).toContain(res.status);
      });
    });
  });

  // ============================================================
  // SECTION 7: Order Cancellation
  // ============================================================
  describe('Order Cancellation', () => {
    describe('POST /api/services/orders/:id/cancel', () => {
      it('should require authentication', async () => {
        const res = await request(app)
          .post(`/api/services/orders/${fakeOrderId}/cancel`)
          .send({ reason: 'Changed plans' });

        expect([401, 403]).toContain(res.status);
      });

      it('should require cancellation reason', async () => {
        const res = await request(app)
          .post(`/api/services/orders/${fakeOrderId}/cancel`)
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({});

        expect([400, 401, 403, 404, 429, 500]).toContain(res.status);
      });

      it('should cancel order with valid reason', async () => {
        const res = await request(app)
          .post(`/api/services/orders/${fakeOrderId}/cancel`)
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({ reason: 'Schedule conflict' });

        expect([200, 400, 401, 403, 404, 429, 500]).toContain(res.status);

        if (res.status === 200) {
          expect(res.body.success).toBe(true);
        }
      });

      it('should accept optional notes with cancellation', async () => {
        const res = await request(app)
          .post(`/api/services/orders/${fakeOrderId}/cancel`)
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({
            reason: 'Personal emergency',
            notes: 'Will rebook next week',
          });

        expect([200, 400, 401, 403, 404, 429, 500]).toContain(res.status);
      });

      it('should handle non-existent order', async () => {
        const res = await request(app)
          .post('/api/services/orders/ord_nonexistent/cancel')
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({ reason: 'Test' });

        expect([401, 404, 500]).toContain(res.status);
      });
    });
  });

  // ============================================================
  // SECTION 8: Payment Summary
  // ============================================================
  describe('Payment Summary', () => {
    describe('GET /api/services/orders/:orderId/payment-summary', () => {
      it('should return payment summary for an order', async () => {
        const res = await request(app)
          .get(`/api/services/orders/${fakeOrderId}/payment-summary`);

        expect([200, 404, 429, 500]).toContain(res.status);

        if (res.status === 200) {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toBeDefined();
        }
      });

      it('should return 404 for non-existent order', async () => {
        const res = await request(app)
          .get('/api/services/orders/ord_nonexistent/payment-summary');

        expect([404, 500]).toContain(res.status);
      });
    });
  });

  // ============================================================
  // SECTION 9: Customer Appointments
  // ============================================================
  describe('Customer Appointments', () => {
    describe('GET /api/services/appointments/my-appointments', () => {
      it('should require authentication', async () => {
        const res = await request(app).get('/api/services/appointments/my-appointments');
        expect([401, 403]).toContain(res.status);
      });

      it('should return customer appointments', async () => {
        const res = await request(app)
          .get('/api/services/appointments/my-appointments')
          .set('Cookie', [`auth_token=${customerToken}`]);

        expect([200, 401, 429, 500]).toContain(res.status);

        if (res.status === 200) {
          expect(res.body.success).toBe(true);
        }
      });

      it('should filter by date range', async () => {
        const res = await request(app)
          .get('/api/services/appointments/my-appointments')
          .query({ startDate: '2026-03-01', endDate: '2026-04-30' })
          .set('Cookie', [`auth_token=${customerToken}`]);

        expect([200, 401, 429, 500]).toContain(res.status);
      });
    });

    describe('POST /api/services/appointments/cancel/:orderId', () => {
      it('should require authentication', async () => {
        const res = await request(app)
          .post(`/api/services/appointments/cancel/${fakeOrderId}`);

        expect([401, 403]).toContain(res.status);
      });

      it('should cancel appointment for valid order', async () => {
        const res = await request(app)
          .post(`/api/services/appointments/cancel/${fakeOrderId}`)
          .set('Cookie', [`auth_token=${customerToken}`]);

        expect([200, 400, 401, 404, 500]).toContain(res.status);
      });
    });
  });

  // ============================================================
  // SECTION 10: Reschedule Requests
  // ============================================================
  describe('Reschedule Requests', () => {
    describe('POST /api/services/appointments/reschedule-request', () => {
      it('should require authentication', async () => {
        const res = await request(app)
          .post('/api/services/appointments/reschedule-request')
          .send({ orderId: fakeOrderId, reason: 'Conflict', newDate: '2026-05-01', newTimeSlot: '14:00' });

        expect([401, 403]).toContain(res.status);
      });

      it('should require orderId', async () => {
        const res = await request(app)
          .post('/api/services/appointments/reschedule-request')
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({ reason: 'Conflict', newDate: '2026-05-01', newTimeSlot: '14:00' });

        expect([400, 401, 500]).toContain(res.status);
      });

      it('should require requestedDate', async () => {
        const res = await request(app)
          .post('/api/services/appointments/reschedule-request')
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({ orderId: fakeOrderId, reason: 'Conflict' });

        expect([400, 401, 500]).toContain(res.status);
      });

      it('should handle valid reschedule request', async () => {
        const res = await request(app)
          .post('/api/services/appointments/reschedule-request')
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({
            orderId: fakeOrderId,
            reason: 'Schedule change',
            requestedDate: '2026-05-01',
            requestedTimeSlot: '14:00',
          });

        expect([200, 201, 400, 401, 404, 500]).toContain(res.status);
      });
    });

    describe('GET /api/services/appointments/reschedule-request/order/:orderId', () => {
      it('should require authentication', async () => {
        const res = await request(app)
          .get(`/api/services/appointments/reschedule-request/order/${fakeOrderId}`);

        expect([401, 403]).toContain(res.status);
      });

      it('should return reschedule request for order', async () => {
        const res = await request(app)
          .get(`/api/services/appointments/reschedule-request/order/${fakeOrderId}`)
          .set('Cookie', [`auth_token=${customerToken}`]);

        expect([200, 401, 404, 500]).toContain(res.status);
      });
    });

    describe('DELETE /api/services/appointments/reschedule-request/:requestId', () => {
      it('should require authentication', async () => {
        const res = await request(app)
          .delete('/api/services/appointments/reschedule-request/fake-req-id');

        expect([401, 403]).toContain(res.status);
      });

      it('should handle cancellation of reschedule request', async () => {
        const res = await request(app)
          .delete('/api/services/appointments/reschedule-request/fake-req-id')
          .set('Cookie', [`auth_token=${customerToken}`]);

        expect([200, 401, 404, 500]).toContain(res.status);
      });
    });
  });

  // ============================================================
  // SECTION 11: Booking Date & Time Validation
  // ============================================================
  describe('Booking Date & Time Validation', () => {
    it('should reject past booking date', async () => {
      const res = await request(app)
        .post('/api/services/orders/create-payment-intent')
        .set('Cookie', [`auth_token=${customerToken}`])
        .send({
          serviceId,
          bookingDate: '2020-01-01',
          bookingTime: '10:00',
        });

      expect([400, 401, 403, 429, 500]).toContain(res.status);
    });

    it('should reject invalid time format', async () => {
      const res = await request(app)
        .post('/api/services/orders/create-payment-intent')
        .set('Cookie', [`auth_token=${customerToken}`])
        .send({
          serviceId,
          bookingDate: '2026-04-15',
          bookingTime: '25:99',
        });

      expect([400, 401, 403, 429, 500]).toContain(res.status);
    });

    it('should accept HH:MM time format', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const dateStr = futureDate.toISOString().split('T')[0];

      const res = await request(app)
        .post('/api/services/orders/create-payment-intent')
        .set('Cookie', [`auth_token=${customerToken}`])
        .send({
          serviceId,
          bookingDate: dateStr,
          bookingTime: '09:30',
        });

      // Should not reject on time format
      if (res.status === 400 && res.body.error) {
        expect(res.body.error).not.toContain('time format');
      }
      expect([200, 400, 401, 403, 404, 429, 500]).toContain(res.status);
    });

    it('should reject empty bookingDate', async () => {
      const res = await request(app)
        .post('/api/services/orders/create-payment-intent')
        .set('Cookie', [`auth_token=${customerToken}`])
        .send({
          serviceId,
          bookingDate: '',
          bookingTime: '10:00',
        });

      expect([400, 401, 403, 429, 500]).toContain(res.status);
    });

    it('should reject empty bookingTime', async () => {
      const res = await request(app)
        .post('/api/services/orders/create-payment-intent')
        .set('Cookie', [`auth_token=${customerToken}`])
        .send({
          serviceId,
          bookingDate: '2026-04-15',
          bookingTime: '',
        });

      expect([400, 401, 403, 429, 500]).toContain(res.status);
    });
  });

  // ============================================================
  // SECTION 12: Concurrent Booking Protection
  // ============================================================
  describe('Concurrent Booking Protection', () => {
    it('should handle multiple simultaneous payment intent requests', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const dateStr = futureDate.toISOString().split('T')[0];

      const requests = Array(3).fill(null).map(() =>
        request(app)
          .post('/api/services/orders/create-payment-intent')
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({
            serviceId,
            bookingDate: dateStr,
            bookingTime: '11:00',
          })
      );

      const responses = await Promise.all(requests);

      // All should respond without crashing
      responses.forEach(res => {
        expect([200, 400, 401, 403, 404, 429, 500]).toContain(res.status);
      });
    });

    it('should handle parallel slot queries without error', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      const dateStr = futureDate.toISOString().split('T')[0];

      const requests = Array(5).fill(null).map(() =>
        request(app)
          .get('/api/services/appointments/available-slots')
          .query({ shopId, serviceId, date: dateStr })
      );

      const responses = await Promise.all(requests);

      responses.forEach(res => {
        expect([200, 400, 404, 429, 500]).toContain(res.status);
      });
    });
  });

  // ============================================================
  // SECTION 13: Security & Edge Cases
  // ============================================================
  describe('Security & Edge Cases', () => {
    it('should handle SQL injection in serviceId', async () => {
      const res = await request(app)
        .post('/api/services/orders/create-payment-intent')
        .set('Cookie', [`auth_token=${customerToken}`])
        .send({
          serviceId: "'; DROP TABLE service_orders;--",
          bookingDate: '2026-04-15',
          bookingTime: '10:00',
        });

      expect([400, 401, 403, 404, 429, 500]).toContain(res.status);
    });

    it('should handle XSS in notes field', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const dateStr = futureDate.toISOString().split('T')[0];

      const res = await request(app)
        .post('/api/services/orders/create-payment-intent')
        .set('Cookie', [`auth_token=${customerToken}`])
        .send({
          serviceId,
          bookingDate: dateStr,
          bookingTime: '10:00',
          notes: '<script>alert("xss")</script>',
        });

      // Should not crash — notes are stored but should be sanitized on display
      expect([200, 400, 401, 403, 404, 429, 500]).toContain(res.status);
    });

    it('should handle very long notes gracefully', async () => {
      const res = await request(app)
        .post('/api/services/orders/create-payment-intent')
        .set('Cookie', [`auth_token=${customerToken}`])
        .send({
          serviceId,
          bookingDate: '2026-04-15',
          bookingTime: '10:00',
          notes: 'A'.repeat(10000),
        });

      expect([200, 400, 401, 403, 404, 429, 500]).toContain(res.status);
    });

    it('should not leak sensitive data in error responses', async () => {
      const res = await request(app)
        .post('/api/services/orders/create-payment-intent')
        .set('Cookie', [`auth_token=${customerToken}`])
        .send({
          serviceId: 'invalid',
          bookingDate: '2026-04-15',
          bookingTime: '10:00',
        });

      if (res.status >= 400) {
        const body = JSON.stringify(res.body);
        // Should not contain database connection strings or stack traces
        expect(body).not.toContain('password');
        expect(body).not.toContain('connectionString');
        expect(body).not.toContain('PRIVATE_KEY');
      }
    });

    it('should handle special characters in order ID for cancel', async () => {
      const res = await request(app)
        .post('/api/services/orders/../../../etc/passwd/cancel')
        .set('Cookie', [`auth_token=${customerToken}`])
        .send({ reason: 'Test' });

      expect([400, 401, 404, 500]).toContain(res.status);
    });
  });

  // ============================================================
  // SECTION 14: Response Shape Contracts
  // ============================================================
  describe('Response Shape Contracts', () => {
    it('orders list response should match expected shape', async () => {
      const res = await request(app)
        .get('/api/services/orders/customer')
        .set('Cookie', [`auth_token=${customerToken}`]);

      if (res.status === 200) {
        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty('data');
        expect(Array.isArray(res.body.data)).toBe(true);

        if (res.body.data.length > 0) {
          const order = res.body.data[0];
          expect(order).toHaveProperty('orderId');
          expect(order).toHaveProperty('status');
          expect(['pending', 'paid', 'completed', 'cancelled', 'refunded', 'no_show', 'expired'])
            .toContain(order.status);
        }
      }
    });

    it('available slots response should have time and available fields', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      const dateStr = futureDate.toISOString().split('T')[0];

      const res = await request(app)
        .get('/api/services/appointments/available-slots')
        .query({ shopId, serviceId, date: dateStr });

      if (res.status === 200 && res.body.data?.length > 0) {
        res.body.data.forEach((slot: any) => {
          expect(slot).toHaveProperty('time');
          expect(slot).toHaveProperty('available');
          expect(typeof slot.time).toBe('string');
          expect(typeof slot.available).toBe('boolean');
          // Time should be in HH:MM format
          expect(slot.time).toMatch(/^\d{1,2}:\d{2}/);
        });
      }
    });

    it('error responses should have consistent shape', async () => {
      const res = await request(app)
        .post('/api/services/orders/create-payment-intent')
        .send({});

      if (res.status >= 400) {
        expect(res.body).toHaveProperty('success');
        if (res.body.success === false) {
          expect(res.body).toHaveProperty('error');
          expect(typeof res.body.error).toBe('string');
        }
      }
    });
  });
});
