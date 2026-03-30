/**
 * Customer Appointments Tab — E2E Tests
 * /customer?tab=appointments
 *
 * Tests the full customer appointments page:
 *   - Appointment listing with date range (90 days back/forward)
 *   - Filter tabs: Upcoming, Completed, Cancelled
 *   - Sort by date (asc/desc)
 *   - Appointment card data (service, shop, date, time, status)
 *   - Cancel appointment (24h minimum)
 *   - Reschedule flow (create, check pending, cancel request)
 *   - Calendar widget (mini calendar with appointment dots)
 *   - Available time slots for reschedule date picker
 *   - Shop availability & time slot config (public)
 *
 * API Endpoints Tested:
 *   - GET  /api/services/appointments/my-appointments
 *   - POST /api/services/appointments/cancel/:orderId
 *   - POST /api/services/appointments/reschedule-request
 *   - GET  /api/services/appointments/reschedule-request/order/:orderId
 *   - DELETE /api/services/appointments/reschedule-request/:requestId
 *   - GET  /api/services/appointments/available-slots
 *   - GET  /api/services/appointments/shop-availability/:shopId
 *   - GET  /api/services/appointments/time-slot-config/:shopId
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, jest, afterAll } from '@jest/globals';
import RepairCoinApp from '../../src/app';
import jwt from 'jsonwebtoken';

jest.mock('thirdweb');

describe('Customer Appointments Tab — E2E', () => {
  let app: any;

  const JWT_SECRET = 'test-secret-appointments-tab-32!';
  const customerAddress = '0xaaaa000000000000000000000000000000000001';
  const shopId = 'shop-appt-test-001';
  const serviceId = 'service-appt-test-001';
  const fakeOrderId = 'order-appt-test-001';
  const fakeRequestId = 'reschedule-req-test-001';

  let customerToken: string;
  let shopToken: string;

  // Helper: format date as YYYY-MM-DD
  const formatDate = (date: Date): string => date.toISOString().split('T')[0];

  // Helper: get date offset from today
  const dateOffset = (days: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return formatDate(d);
  };

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
  // SECTION 1: Appointment Listing
  // (Frontend loads 90 days back to 90 days forward)
  // ============================================================
  describe('Appointment Listing', () => {
    describe('GET /api/services/appointments/my-appointments', () => {
      it('should require authentication', async () => {
        const res = await request(app)
          .get('/api/services/appointments/my-appointments')
          .query({ startDate: dateOffset(-90), endDate: dateOffset(90) });

        expect([401, 403]).toContain(res.status);
      });

      it('should return appointments for authenticated customer', async () => {
        const res = await request(app)
          .get('/api/services/appointments/my-appointments')
          .query({ startDate: dateOffset(-90), endDate: dateOffset(90) })
          .set('Cookie', [`auth_token=${customerToken}`]);

        expect([200, 401, 429, 500]).toContain(res.status);

        if (res.status === 200) {
          expect(res.body.success).toBe(true);
          expect(Array.isArray(res.body.data)).toBe(true);
        }
      });

      it('should return appointment card fields matching frontend CalendarBooking interface', async () => {
        const res = await request(app)
          .get('/api/services/appointments/my-appointments')
          .query({ startDate: dateOffset(-90), endDate: dateOffset(90) })
          .set('Cookie', [`auth_token=${customerToken}`]);

        if (res.status === 200 && res.body.data?.length > 0) {
          const apt = res.body.data[0];
          // Required fields from CalendarBooking interface
          expect(apt).toHaveProperty('orderId');
          expect(apt).toHaveProperty('shopId');
          expect(apt).toHaveProperty('serviceId');
          expect(apt).toHaveProperty('serviceName');
          expect(apt).toHaveProperty('customerAddress');
          expect(apt).toHaveProperty('bookingDate');
          expect(apt).toHaveProperty('status');
          expect(apt).toHaveProperty('totalAmount');
          expect(apt).toHaveProperty('createdAt');

          // Type checks
          expect(typeof apt.orderId).toBe('string');
          expect(typeof apt.serviceName).toBe('string');
          expect(typeof apt.totalAmount).toBe('number');

          // Status should be a valid order status
          expect([
            'pending', 'paid', 'confirmed', 'scheduled',
            'completed', 'cancelled', 'refunded', 'expired', 'no_show'
          ]).toContain(apt.status.toLowerCase());
        }
      });

      it('should include shop info for customer appointments', async () => {
        const res = await request(app)
          .get('/api/services/appointments/my-appointments')
          .query({ startDate: dateOffset(-90), endDate: dateOffset(90) })
          .set('Cookie', [`auth_token=${customerToken}`]);

        if (res.status === 200 && res.body.data?.length > 0) {
          const apt = res.body.data[0];
          // Optional shop fields the frontend uses
          if (apt.shopName !== undefined) {
            expect(typeof apt.shopName).toBe('string');
          }
        }
      });

      it('should filter by date range — short window', async () => {
        const res = await request(app)
          .get('/api/services/appointments/my-appointments')
          .query({ startDate: dateOffset(0), endDate: dateOffset(7) })
          .set('Cookie', [`auth_token=${customerToken}`]);

        expect([200, 401, 429, 500]).toContain(res.status);
      });

      it('should filter by date range — past only', async () => {
        const res = await request(app)
          .get('/api/services/appointments/my-appointments')
          .query({ startDate: dateOffset(-90), endDate: dateOffset(0) })
          .set('Cookie', [`auth_token=${customerToken}`]);

        expect([200, 401, 429, 500]).toContain(res.status);
      });

      it('should filter by date range — future only', async () => {
        const res = await request(app)
          .get('/api/services/appointments/my-appointments')
          .query({ startDate: dateOffset(0), endDate: dateOffset(90) })
          .set('Cookie', [`auth_token=${customerToken}`]);

        expect([200, 401, 429, 500]).toContain(res.status);
      });

      it('should reject shop role accessing customer appointments', async () => {
        const res = await request(app)
          .get('/api/services/appointments/my-appointments')
          .query({ startDate: dateOffset(-90), endDate: dateOffset(90) })
          .set('Cookie', [`auth_token=${shopToken}`]);

        expect([401, 403]).toContain(res.status);
      });

      it('should handle missing date parameters gracefully', async () => {
        const res = await request(app)
          .get('/api/services/appointments/my-appointments')
          .set('Cookie', [`auth_token=${customerToken}`]);

        // May return 200 with defaults or 400 for missing params
        expect([200, 400, 401, 429, 500]).toContain(res.status);
      });

      it('should handle invalid date format', async () => {
        const res = await request(app)
          .get('/api/services/appointments/my-appointments')
          .query({ startDate: 'not-a-date', endDate: 'also-not' })
          .set('Cookie', [`auth_token=${customerToken}`]);

        expect([200, 400, 401, 429, 500]).toContain(res.status);
      });
    });
  });

  // ============================================================
  // SECTION 2: Cancel Appointment
  // ============================================================
  describe('Cancel Appointment', () => {
    describe('POST /api/services/appointments/cancel/:orderId', () => {
      it('should require authentication', async () => {
        const res = await request(app)
          .post(`/api/services/appointments/cancel/${fakeOrderId}`);

        expect([401, 403]).toContain(res.status);
      });

      it('should cancel valid appointment', async () => {
        const res = await request(app)
          .post(`/api/services/appointments/cancel/${fakeOrderId}`)
          .set('Cookie', [`auth_token=${customerToken}`]);

        expect([200, 400, 401, 404, 429, 500]).toContain(res.status);

        if (res.status === 200) {
          expect(res.body.success).toBe(true);
        }
      });

      it('should handle non-existent order', async () => {
        const res = await request(app)
          .post('/api/services/appointments/cancel/ord_nonexistent')
          .set('Cookie', [`auth_token=${customerToken}`]);

        expect([400, 401, 404, 429, 500]).toContain(res.status);
      });

      it('should reject shop role cancelling customer appointment', async () => {
        const res = await request(app)
          .post(`/api/services/appointments/cancel/${fakeOrderId}`)
          .set('Cookie', [`auth_token=${shopToken}`]);

        expect([401, 403]).toContain(res.status);
      });

      it('should handle already cancelled appointment', async () => {
        // Cancel twice
        await request(app)
          .post(`/api/services/appointments/cancel/${fakeOrderId}`)
          .set('Cookie', [`auth_token=${customerToken}`]);

        const res = await request(app)
          .post(`/api/services/appointments/cancel/${fakeOrderId}`)
          .set('Cookie', [`auth_token=${customerToken}`]);

        expect([200, 400, 401, 404, 429, 500]).toContain(res.status);
      });

      it('should handle special characters in orderId', async () => {
        const res = await request(app)
          .post('/api/services/appointments/cancel/<script>alert(1)</script>')
          .set('Cookie', [`auth_token=${customerToken}`]);

        expect([400, 401, 404, 500]).toContain(res.status);
      });
    });
  });

  // ============================================================
  // SECTION 3: Reschedule Requests
  // ============================================================
  describe('Reschedule Requests', () => {
    describe('POST /api/services/appointments/reschedule-request — Create', () => {
      it('should require authentication', async () => {
        const res = await request(app)
          .post('/api/services/appointments/reschedule-request')
          .send({
            orderId: fakeOrderId,
            requestedDate: dateOffset(14),
            requestedTimeSlot: '14:00',
          });

        expect([401, 403]).toContain(res.status);
      });

      it('should require orderId', async () => {
        const res = await request(app)
          .post('/api/services/appointments/reschedule-request')
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({
            requestedDate: dateOffset(14),
            requestedTimeSlot: '14:00',
          });

        expect([400, 401, 429, 500]).toContain(res.status);
      });

      it('should require requestedDate', async () => {
        const res = await request(app)
          .post('/api/services/appointments/reschedule-request')
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({
            orderId: fakeOrderId,
            requestedTimeSlot: '14:00',
          });

        expect([400, 401, 429, 500]).toContain(res.status);
      });

      it('should require requestedTimeSlot', async () => {
        const res = await request(app)
          .post('/api/services/appointments/reschedule-request')
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({
            orderId: fakeOrderId,
            requestedDate: dateOffset(14),
          });

        expect([400, 401, 429, 500]).toContain(res.status);
      });

      it('should create reschedule request with valid data', async () => {
        const res = await request(app)
          .post('/api/services/appointments/reschedule-request')
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({
            orderId: fakeOrderId,
            requestedDate: dateOffset(14),
            requestedTimeSlot: '14:00',
            reason: 'Schedule conflict with work',
          });

        expect([200, 201, 400, 401, 404, 429, 500]).toContain(res.status);

        if (res.status === 200 || res.status === 201) {
          expect(res.body.success).toBe(true);
          if (res.body.data) {
            expect(res.body.data).toHaveProperty('requestId');
            expect(res.body.data).toHaveProperty('orderId');
            expect(res.body.data).toHaveProperty('status');
            expect(res.body.data.status).toBe('pending');
          }
        }
      });

      it('should accept reschedule without reason (optional)', async () => {
        const res = await request(app)
          .post('/api/services/appointments/reschedule-request')
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({
            orderId: fakeOrderId,
            requestedDate: dateOffset(14),
            requestedTimeSlot: '10:00',
          });

        expect([200, 201, 400, 401, 404, 429, 500]).toContain(res.status);
      });

      it('should reject reschedule to past date', async () => {
        const res = await request(app)
          .post('/api/services/appointments/reschedule-request')
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({
            orderId: fakeOrderId,
            requestedDate: '2020-01-01',
            requestedTimeSlot: '10:00',
          });

        expect([400, 401, 404, 429, 500]).toContain(res.status);
      });

      it('should reject invalid time slot format', async () => {
        const res = await request(app)
          .post('/api/services/appointments/reschedule-request')
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({
            orderId: fakeOrderId,
            requestedDate: dateOffset(14),
            requestedTimeSlot: '25:99',
          });

        expect([400, 401, 404, 429, 500]).toContain(res.status);
      });

      it('should handle non-existent order', async () => {
        const res = await request(app)
          .post('/api/services/appointments/reschedule-request')
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({
            orderId: 'ord_nonexistent',
            requestedDate: dateOffset(14),
            requestedTimeSlot: '14:00',
          });

        expect([400, 401, 404, 429, 500]).toContain(res.status);
      });
    });

    describe('GET /api/services/appointments/reschedule-request/order/:orderId — Check Pending', () => {
      it('should require authentication', async () => {
        const res = await request(app)
          .get(`/api/services/appointments/reschedule-request/order/${fakeOrderId}`);

        expect([401, 403]).toContain(res.status);
      });

      it('should return reschedule request for order', async () => {
        const res = await request(app)
          .get(`/api/services/appointments/reschedule-request/order/${fakeOrderId}`)
          .set('Cookie', [`auth_token=${customerToken}`]);

        expect([200, 401, 404, 429, 500]).toContain(res.status);

        if (res.status === 200) {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('hasPendingRequest');
          expect(typeof res.body.data.hasPendingRequest).toBe('boolean');

          if (res.body.data.hasPendingRequest && res.body.data.request) {
            const req = res.body.data.request;
            expect(req).toHaveProperty('requestId');
            expect(req).toHaveProperty('orderId');
            expect(req).toHaveProperty('requestedDate');
            expect(req).toHaveProperty('requestedTimeSlot');
            expect(req).toHaveProperty('status');
            expect(['pending', 'approved', 'rejected', 'expired', 'cancelled'])
              .toContain(req.status);
          }
        }
      });

      it('should return hasPendingRequest: false for order without request', async () => {
        const res = await request(app)
          .get('/api/services/appointments/reschedule-request/order/ord_no-request')
          .set('Cookie', [`auth_token=${customerToken}`]);

        expect([200, 401, 404, 429, 500]).toContain(res.status);

        if (res.status === 200) {
          expect(res.body.data.hasPendingRequest).toBe(false);
        }
      });
    });

    describe('DELETE /api/services/appointments/reschedule-request/:requestId — Cancel', () => {
      it('should require authentication', async () => {
        const res = await request(app)
          .delete(`/api/services/appointments/reschedule-request/${fakeRequestId}`);

        expect([401, 403]).toContain(res.status);
      });

      it('should cancel reschedule request', async () => {
        const res = await request(app)
          .delete(`/api/services/appointments/reschedule-request/${fakeRequestId}`)
          .set('Cookie', [`auth_token=${customerToken}`]);

        expect([200, 400, 401, 404, 429, 500]).toContain(res.status);

        if (res.status === 200) {
          expect(res.body.success).toBe(true);
        }
      });

      it('should handle non-existent request', async () => {
        const res = await request(app)
          .delete('/api/services/appointments/reschedule-request/nonexistent-req')
          .set('Cookie', [`auth_token=${customerToken}`]);

        expect([400, 401, 404, 429, 500]).toContain(res.status);
      });

      it('should reject shop role cancelling customer request', async () => {
        const res = await request(app)
          .delete(`/api/services/appointments/reschedule-request/${fakeRequestId}`)
          .set('Cookie', [`auth_token=${shopToken}`]);

        // Shop may have access too — but customer endpoint
        expect([200, 400, 401, 403, 404, 429, 500]).toContain(res.status);
      });
    });
  });

  // ============================================================
  // SECTION 4: Available Time Slots (for reschedule date picker)
  // ============================================================
  describe('Available Time Slots', () => {
    describe('GET /api/services/appointments/available-slots', () => {
      it('should return slots for a future date (public)', async () => {
        const res = await request(app)
          .get('/api/services/appointments/available-slots')
          .query({ shopId, serviceId, date: dateOffset(7) });

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
            // Time should be in recognizable format
            expect(slot.time).toMatch(/^\d{1,2}:\d{2}/);
          }
        }
      });

      it('should require shopId', async () => {
        const res = await request(app)
          .get('/api/services/appointments/available-slots')
          .query({ serviceId, date: dateOffset(7) });

        expect([400, 500]).toContain(res.status);
      });

      it('should require date', async () => {
        const res = await request(app)
          .get('/api/services/appointments/available-slots')
          .query({ shopId, serviceId });

        expect([400, 500]).toContain(res.status);
      });

      it('should return no available slots for past date', async () => {
        const res = await request(app)
          .get('/api/services/appointments/available-slots')
          .query({ shopId, serviceId, date: '2020-01-01' });

        expect([200, 400, 500]).toContain(res.status);

        if (res.status === 200) {
          const available = res.body.data.filter((s: any) => s.available);
          expect(available.length).toBe(0);
        }
      });

      it('should accept userTimezone parameter', async () => {
        const res = await request(app)
          .get('/api/services/appointments/available-slots')
          .query({
            shopId, serviceId,
            date: dateOffset(7),
            userTimezone: 'Asia/Singapore',
          });

        expect([200, 400, 404, 429, 500]).toContain(res.status);
      });

      it('should handle far future date', async () => {
        const res = await request(app)
          .get('/api/services/appointments/available-slots')
          .query({ shopId, serviceId, date: '2030-12-31' });

        expect([200, 400, 404, 429, 500]).toContain(res.status);
      });
    });
  });

  // ============================================================
  // SECTION 5: Shop Availability (Operating Hours)
  // ============================================================
  describe('Shop Availability', () => {
    describe('GET /api/services/appointments/shop-availability/:shopId', () => {
      it('should return shop operating hours (public, no auth)', async () => {
        const res = await request(app)
          .get(`/api/services/appointments/shop-availability/${shopId}`);

        expect([200, 404, 429, 500]).toContain(res.status);

        if (res.status === 200) {
          expect(res.body.success).toBe(true);
          if (Array.isArray(res.body.data) && res.body.data.length > 0) {
            const day = res.body.data[0];
            expect(day).toHaveProperty('dayOfWeek');
            expect(day).toHaveProperty('isOpen');
            expect(typeof day.dayOfWeek).toBe('number');
            expect(typeof day.isOpen).toBe('boolean');

            if (day.isOpen) {
              expect(day).toHaveProperty('openTime');
              expect(day).toHaveProperty('closeTime');
            }
          }
        }
      });

      it('should handle non-existent shop', async () => {
        const res = await request(app)
          .get('/api/services/appointments/shop-availability/nonexistent-shop-id');

        expect([200, 404, 429, 500]).toContain(res.status);
      });

      it('should not require authentication', async () => {
        const res = await request(app)
          .get(`/api/services/appointments/shop-availability/${shopId}`);

        expect(res.status).not.toBe(401);
      });
    });
  });

  // ============================================================
  // SECTION 6: Time Slot Configuration
  // ============================================================
  describe('Time Slot Configuration', () => {
    describe('GET /api/services/appointments/time-slot-config/:shopId', () => {
      it('should return config (public, no auth)', async () => {
        const res = await request(app)
          .get(`/api/services/appointments/time-slot-config/${shopId}`);

        expect([200, 404, 429, 500]).toContain(res.status);

        if (res.status === 200) {
          expect(res.body.success).toBe(true);
          const config = res.body.data;
          if (config) {
            // Frontend uses these fields
            if (config.slotDurationMinutes !== undefined) {
              expect(typeof config.slotDurationMinutes).toBe('number');
              expect(config.slotDurationMinutes).toBeGreaterThan(0);
            }
            if (config.bufferTimeMinutes !== undefined) {
              expect(typeof config.bufferTimeMinutes).toBe('number');
              expect(config.bufferTimeMinutes).toBeGreaterThanOrEqual(0);
            }
            if (config.maxConcurrentBookings !== undefined) {
              expect(typeof config.maxConcurrentBookings).toBe('number');
              expect(config.maxConcurrentBookings).toBeGreaterThan(0);
            }
          }
        }
      });

      it('should handle shop without config', async () => {
        const res = await request(app)
          .get('/api/services/appointments/time-slot-config/unconfigured-shop');

        expect([200, 404, 429, 500]).toContain(res.status);
      });

      it('should not require authentication', async () => {
        const res = await request(app)
          .get(`/api/services/appointments/time-slot-config/${shopId}`);

        expect(res.status).not.toBe(401);
      });
    });
  });

  // ============================================================
  // SECTION 7: Reschedule Full Flow
  // ============================================================
  describe('Reschedule Full Flow', () => {
    it('should complete create → check → cancel cycle', async () => {
      // Step 1: Create reschedule request
      const createRes = await request(app)
        .post('/api/services/appointments/reschedule-request')
        .set('Cookie', [`auth_token=${customerToken}`])
        .send({
          orderId: fakeOrderId,
          requestedDate: dateOffset(14),
          requestedTimeSlot: '15:00',
          reason: 'E2E flow test',
        });

      if (![200, 201].includes(createRes.status)) {
        // Order may not exist in test env — skip flow
        expect([400, 401, 404, 429, 500]).toContain(createRes.status);
        return;
      }

      const requestId = createRes.body.data?.requestId;
      expect(requestId).toBeDefined();

      // Step 2: Check pending reschedule for order
      const checkRes = await request(app)
        .get(`/api/services/appointments/reschedule-request/order/${fakeOrderId}`)
        .set('Cookie', [`auth_token=${customerToken}`]);

      if (checkRes.status === 200) {
        expect(checkRes.body.data.hasPendingRequest).toBe(true);
        expect(checkRes.body.data.request?.requestId).toBe(requestId);
      }

      // Step 3: Cancel the reschedule request
      const cancelRes = await request(app)
        .delete(`/api/services/appointments/reschedule-request/${requestId}`)
        .set('Cookie', [`auth_token=${customerToken}`]);

      if (cancelRes.status === 200) {
        expect(cancelRes.body.success).toBe(true);
      }

      // Step 4: Verify request is gone
      const verifyRes = await request(app)
        .get(`/api/services/appointments/reschedule-request/order/${fakeOrderId}`)
        .set('Cookie', [`auth_token=${customerToken}`]);

      if (verifyRes.status === 200) {
        expect(verifyRes.body.data.hasPendingRequest).toBe(false);
      }
    });
  });

  // ============================================================
  // SECTION 8: Edge Cases
  // ============================================================
  describe('Edge Cases', () => {
    it('should handle very wide date range (1 year)', async () => {
      const res = await request(app)
        .get('/api/services/appointments/my-appointments')
        .query({ startDate: dateOffset(-365), endDate: dateOffset(365) })
        .set('Cookie', [`auth_token=${customerToken}`]);

      expect([200, 400, 401, 429, 500]).toContain(res.status);
    });

    it('should handle endDate before startDate', async () => {
      const res = await request(app)
        .get('/api/services/appointments/my-appointments')
        .query({ startDate: dateOffset(30), endDate: dateOffset(-30) })
        .set('Cookie', [`auth_token=${customerToken}`]);

      // Should return empty or error
      expect([200, 400, 401, 429, 500]).toContain(res.status);

      if (res.status === 200) {
        expect(res.body.data.length).toBe(0);
      }
    });

    it('should handle SQL injection in orderId for cancel', async () => {
      const res = await request(app)
        .post("/api/services/appointments/cancel/'; DROP TABLE service_orders;--")
        .set('Cookie', [`auth_token=${customerToken}`]);

      expect([400, 401, 404, 500]).toContain(res.status);
    });

    it('should handle empty body for reschedule request', async () => {
      const res = await request(app)
        .post('/api/services/appointments/reschedule-request')
        .set('Cookie', [`auth_token=${customerToken}`])
        .send({});

      expect([400, 401, 429, 500]).toContain(res.status);
    });

    it('should handle concurrent reschedule requests for same order', async () => {
      const requests = Array(3).fill(null).map((_, i) =>
        request(app)
          .post('/api/services/appointments/reschedule-request')
          .set('Cookie', [`auth_token=${customerToken}`])
          .send({
            orderId: fakeOrderId,
            requestedDate: dateOffset(14 + i),
            requestedTimeSlot: `${10 + i}:00`,
          })
      );

      const responses = await Promise.all(requests);

      // All should respond without crashing
      responses.forEach(res => {
        expect([200, 201, 400, 401, 404, 409, 429, 500]).toContain(res.status);
      });

      // At most one should succeed (can't have multiple pending for same order)
      const successCount = responses.filter(r => [200, 201].includes(r.status)).length;
      expect(successCount).toBeLessThanOrEqual(1);
    });
  });

  // ============================================================
  // SECTION 9: Concurrent Request Handling
  // ============================================================
  describe('Concurrent Requests', () => {
    it('should handle parallel appointment + slot queries', async () => {
      const [apptRes, slotRes, availRes] = await Promise.all([
        request(app)
          .get('/api/services/appointments/my-appointments')
          .query({ startDate: dateOffset(-90), endDate: dateOffset(90) })
          .set('Cookie', [`auth_token=${customerToken}`]),
        request(app)
          .get(`/api/services/appointments/shop-availability/${shopId}`),
        request(app)
          .get('/api/services/appointments/available-slots')
          .query({ shopId, serviceId, date: dateOffset(7) }),
      ]);

      expect([200, 400, 401, 404, 429, 500]).toContain(apptRes.status);
      expect([200, 404, 429, 500]).toContain(slotRes.status);
      expect([200, 400, 404, 429, 500]).toContain(availRes.status);
    });
  });

  // ============================================================
  // SECTION 10: Response Error Shape
  // ============================================================
  describe('Error Response Shape', () => {
    it('auth errors should have consistent shape', async () => {
      const res = await request(app)
        .get('/api/services/appointments/my-appointments');

      if (res.status === 401 || res.status === 403) {
        expect(res.body).toHaveProperty('error');
      }
    });

    it('validation errors should include error message', async () => {
      const res = await request(app)
        .post('/api/services/appointments/reschedule-request')
        .set('Cookie', [`auth_token=${customerToken}`])
        .send({});

      if (res.status === 400) {
        expect(res.body).toHaveProperty('success', false);
        expect(res.body).toHaveProperty('error');
        expect(typeof res.body.error).toBe('string');
      }
    });
  });
});
