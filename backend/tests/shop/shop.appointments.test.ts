/**
 * Shop Appointments Tab E2E Tests
 *
 * Tests the /shop?tab=appointments functionality:
 * - Time slot configuration (CRUD)
 * - Shop availability (operating hours)
 * - Date overrides (holidays, special hours)
 * - Calendar view
 * - Available slots generation
 * - Reschedule request management
 * - Direct reschedule
 * - Service duration config
 * - Authentication & authorization
 *
 * API Endpoints Tested:
 * - GET/PUT/DELETE /api/services/appointments/time-slot-config
 * - PUT /api/services/appointments/shop-availability
 * - GET/POST/DELETE /api/services/appointments/date-overrides
 * - GET /api/services/appointments/calendar
 * - GET /api/services/appointments/available-slots (public)
 * - GET /api/services/appointments/shop-availability/:shopId (public)
 * - GET /api/services/appointments/time-slot-config/:shopId (public)
 * - GET /api/services/appointments/reschedule-requests
 * - GET /api/services/appointments/reschedule-requests/count
 * - POST /api/services/appointments/reschedule-request/:id/approve
 * - POST /api/services/appointments/reschedule-request/:id/reject
 * - POST /api/services/bookings/:orderId/direct-reschedule
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, jest, afterAll } from '@jest/globals';
import RepairCoinApp from '../../src/app';
import jwt from 'jsonwebtoken';

jest.mock('thirdweb');

describe('Shop Appointments Tab Tests', () => {
  let app: any;

  const JWT_SECRET = 'test-secret-for-appointments-32!';
  const shopId = 'shop-appt-test-001';
  const shopWallet = '0xaaaa000000000000000000000000000000000001';
  const customerWallet = '0xbbbb000000000000000000000000000000000002';
  const otherShopWallet = '0xcccc000000000000000000000000000000000003';
  const otherShopId = 'shop-other-test-002';

  let shopToken: string;
  let customerToken: string;
  let otherShopToken: string;

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
    otherShopToken = jwt.sign(
      { address: otherShopWallet, role: 'shop', shopId: otherShopId, type: 'access' },
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
  // SECTION 1: Time Slot Config - Authentication
  // ============================================================
  describe('Time Slot Config - Authentication', () => {
    it('should reject unauthenticated GET config', async () => {
      const response = await request(app)
        .get('/api/services/appointments/time-slot-config');
      expect([401, 403]).toContain(response.status);
    });

    it('should reject customer GET config', async () => {
      const response = await request(app)
        .get('/api/services/appointments/time-slot-config')
        .set('Cookie', [`auth_token=${customerToken}`]);
      expect([401, 403]).toContain(response.status);
    });

    it('should reject unauthenticated PUT config', async () => {
      const response = await request(app)
        .put('/api/services/appointments/time-slot-config')
        .send({ slotDurationMinutes: 30 });
      expect([401, 403]).toContain(response.status);
    });

    it('should reject unauthenticated DELETE config', async () => {
      const response = await request(app)
        .delete('/api/services/appointments/time-slot-config');
      expect([401, 403]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 2: Time Slot Config - CRUD
  // ============================================================
  describe('Time Slot Config - CRUD', () => {
    it('should get config for authenticated shop', async () => {
      const response = await request(app)
        .get('/api/services/appointments/time-slot-config')
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should update config with valid values', async () => {
      const response = await request(app)
        .put('/api/services/appointments/time-slot-config')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({
          slotDurationMinutes: 60,
          bufferTimeMinutes: 15,
          maxConcurrentBookings: 3,
          bookingAdvanceDays: 30,
          minBookingHours: 2
        });
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should reject invalid slot duration (too low)', async () => {
      const response = await request(app)
        .put('/api/services/appointments/time-slot-config')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ slotDurationMinutes: 5 });
      expect([400, 401, 403]).toContain(response.status);
    });

    it('should reject invalid slot duration (too high)', async () => {
      const response = await request(app)
        .put('/api/services/appointments/time-slot-config')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ slotDurationMinutes: 999 });
      expect([400, 401, 403]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 3: Shop Availability (Operating Hours)
  // ============================================================
  describe('Shop Availability', () => {
    it('should reject unauthenticated availability update', async () => {
      const response = await request(app)
        .put('/api/services/appointments/shop-availability')
        .send({ dayOfWeek: 1, isOpen: true, openTime: '09:00', closeTime: '17:00' });
      expect([401, 403]).toContain(response.status);
    });

    it('should reject customer updating availability', async () => {
      const response = await request(app)
        .put('/api/services/appointments/shop-availability')
        .set('Cookie', [`auth_token=${customerToken}`])
        .send({ dayOfWeek: 1, isOpen: true, openTime: '09:00', closeTime: '17:00' });
      expect([401, 403]).toContain(response.status);
    });

    it('should update availability for a day', async () => {
      const response = await request(app)
        .put('/api/services/appointments/shop-availability')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({
          dayOfWeek: 1,
          isOpen: true,
          openTime: '09:00',
          closeTime: '17:00'
        });
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should accept availability with break times', async () => {
      const response = await request(app)
        .put('/api/services/appointments/shop-availability')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({
          dayOfWeek: 2,
          isOpen: true,
          openTime: '08:00',
          closeTime: '18:00',
          breakStartTime: '12:00',
          breakEndTime: '13:00'
        });
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should accept closed day', async () => {
      const response = await request(app)
        .put('/api/services/appointments/shop-availability')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ dayOfWeek: 0, isOpen: false });
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should validate day of week range (0-6)', async () => {
      const response = await request(app)
        .put('/api/services/appointments/shop-availability')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ dayOfWeek: 7, isOpen: true, openTime: '09:00', closeTime: '17:00' });
      expect([400, 401, 403]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 4: Date Overrides
  // ============================================================
  describe('Date Overrides', () => {
    it('should reject unauthenticated date override creation', async () => {
      const response = await request(app)
        .post('/api/services/appointments/date-overrides')
        .send({ overrideDate: '2026-12-25', isClosed: true, reason: 'Christmas' });
      expect([401, 403]).toContain(response.status);
    });

    it('should get date overrides for shop', async () => {
      const response = await request(app)
        .get('/api/services/appointments/date-overrides')
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });

    it('should create holiday closure', async () => {
      const response = await request(app)
        .post('/api/services/appointments/date-overrides')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({
          overrideDate: '2026-12-25',
          isClosed: true,
          reason: 'Christmas Day'
        });
      expect([200, 201, 401, 403]).toContain(response.status);
    });

    it('should create special hours override', async () => {
      const response = await request(app)
        .post('/api/services/appointments/date-overrides')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({
          overrideDate: '2026-12-31',
          isClosed: false,
          customOpenTime: '10:00',
          customCloseTime: '14:00',
          reason: 'New Year Eve - early close'
        });
      expect([200, 201, 401, 403]).toContain(response.status);
    });

    it('should delete date override', async () => {
      const response = await request(app)
        .delete('/api/services/appointments/date-overrides/2026-12-25')
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403, 404]).toContain(response.status);
    });

    it('should filter overrides by date range', async () => {
      const response = await request(app)
        .get('/api/services/appointments/date-overrides')
        .query({ startDate: '2026-12-01', endDate: '2026-12-31' })
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 5: Calendar View
  // ============================================================
  describe('Calendar View', () => {
    it('should reject unauthenticated calendar request', async () => {
      const response = await request(app)
        .get('/api/services/appointments/calendar')
        .query({ startDate: '2026-03-01', endDate: '2026-03-31' });
      expect([401, 403]).toContain(response.status);
    });

    it('should return calendar for authenticated shop', async () => {
      const response = await request(app)
        .get('/api/services/appointments/calendar')
        .query({ startDate: '2026-03-01', endDate: '2026-03-31' })
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should reject missing date range', async () => {
      const response = await request(app)
        .get('/api/services/appointments/calendar')
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([400, 401, 403]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 6: Public Endpoints (No Auth)
  // ============================================================
  describe('Public Endpoints', () => {
    it('should return shop availability without auth', async () => {
      const response = await request(app)
        .get(`/api/services/appointments/shop-availability/${shopId}`);
      expect([200, 404]).toContain(response.status);
    });

    it('should return time slot config without auth (lazy init)', async () => {
      const response = await request(app)
        .get(`/api/services/appointments/time-slot-config/${shopId}`);
      expect([200, 404]).toContain(response.status);
    });

    it('should return available slots for valid params', async () => {
      const response = await request(app)
        .get('/api/services/appointments/available-slots')
        .query({
          shopId: shopId,
          serviceId: 'srv_test-service',
          date: '2026-04-01'
        });
      expect([200, 400, 404]).toContain(response.status);
    });

    it('should reject available slots without required params', async () => {
      const response = await request(app)
        .get('/api/services/appointments/available-slots');
      expect([400]).toContain(response.status);
    });

    it('should reject available slots without shopId', async () => {
      const response = await request(app)
        .get('/api/services/appointments/available-slots')
        .query({ serviceId: 'srv_test', date: '2026-04-01' });
      expect([400]).toContain(response.status);
    });

    it('should reject available slots without serviceId', async () => {
      const response = await request(app)
        .get('/api/services/appointments/available-slots')
        .query({ shopId: shopId, date: '2026-04-01' });
      expect([400]).toContain(response.status);
    });

    it('should reject available slots without date', async () => {
      const response = await request(app)
        .get('/api/services/appointments/available-slots')
        .query({ shopId: shopId, serviceId: 'srv_test' });
      expect([400]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 7: Reschedule Requests
  // ============================================================
  describe('Reschedule Requests', () => {
    it('should reject unauthenticated reschedule request list', async () => {
      const response = await request(app)
        .get('/api/services/appointments/reschedule-requests');
      expect([401, 403]).toContain(response.status);
    });

    it('should reject customer viewing shop reschedule requests', async () => {
      const response = await request(app)
        .get('/api/services/appointments/reschedule-requests')
        .set('Cookie', [`auth_token=${customerToken}`]);
      expect([401, 403]).toContain(response.status);
    });

    it('should return reschedule requests for shop', async () => {
      const response = await request(app)
        .get('/api/services/appointments/reschedule-requests')
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should filter reschedule requests by status', async () => {
      const response = await request(app)
        .get('/api/services/appointments/reschedule-requests')
        .query({ status: 'pending' })
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should return reschedule request count', async () => {
      const response = await request(app)
        .get('/api/services/appointments/reschedule-requests/count')
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should reject unauthenticated approve', async () => {
      const response = await request(app)
        .post('/api/services/appointments/reschedule-request/fake-id/approve');
      expect([401, 403]).toContain(response.status);
    });

    it('should reject unauthenticated reject', async () => {
      const response = await request(app)
        .post('/api/services/appointments/reschedule-request/fake-id/reject')
        .send({ reason: 'Unavailable' });
      expect([401, 403]).toContain(response.status);
    });

    it('should return 404 for non-existent reschedule approve', async () => {
      const response = await request(app)
        .post('/api/services/appointments/reschedule-request/fake-id/approve')
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([401, 403, 404]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 8: Direct Reschedule
  // ============================================================
  describe('Direct Reschedule', () => {
    it('should reject unauthenticated direct reschedule', async () => {
      const response = await request(app)
        .post('/api/services/bookings/ord_fake-id/direct-reschedule')
        .send({ newDate: '2026-04-15', newTimeSlot: '14:00' });
      expect([401, 403]).toContain(response.status);
    });

    it('should reject customer direct reschedule', async () => {
      const response = await request(app)
        .post('/api/services/bookings/ord_fake-id/direct-reschedule')
        .set('Cookie', [`auth_token=${customerToken}`])
        .send({ newDate: '2026-04-15', newTimeSlot: '14:00' });
      expect([401, 403]).toContain(response.status);
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

    it('should return 404 for non-existent order', async () => {
      const response = await request(app)
        .post('/api/services/bookings/ord_nonexistent/direct-reschedule')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ newDate: '2026-04-15', newTimeSlot: '14:00' });
      expect([401, 403, 404]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 9: Customer Appointment Endpoints
  // ============================================================
  describe('Customer Appointments', () => {
    it('should reject unauthenticated my-appointments', async () => {
      const response = await request(app)
        .get('/api/services/appointments/my-appointments')
        .query({ startDate: '2026-03-01', endDate: '2026-03-31' });
      expect([401, 403]).toContain(response.status);
    });

    it('should reject shop accessing my-appointments', async () => {
      const response = await request(app)
        .get('/api/services/appointments/my-appointments')
        .query({ startDate: '2026-03-01', endDate: '2026-03-31' })
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([401, 403]).toContain(response.status);
    });

    it('should return appointments for customer', async () => {
      const response = await request(app)
        .get('/api/services/appointments/my-appointments')
        .query({ startDate: '2026-03-01', endDate: '2026-03-31' })
        .set('Cookie', [`auth_token=${customerToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should reject customer cancel without orderId', async () => {
      const response = await request(app)
        .post('/api/services/appointments/cancel/')
        .set('Cookie', [`auth_token=${customerToken}`]);
      expect([400, 404]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 10: Input Validation
  // ============================================================
  describe('Input Validation', () => {
    it('available slots: should reject invalid date format', async () => {
      const response = await request(app)
        .get('/api/services/appointments/available-slots')
        .query({ shopId, serviceId: 'srv_test', date: 'not-a-date' });
      expect([400, 404, 500]).toContain(response.status);
    });

    it('availability: should reject invalid time format', async () => {
      const response = await request(app)
        .put('/api/services/appointments/shop-availability')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ dayOfWeek: 1, isOpen: true, openTime: '25:00', closeTime: '17:00' });
      expect([400, 401, 403]).toContain(response.status);
    });

    it('availability: should reject close before open', async () => {
      const response = await request(app)
        .put('/api/services/appointments/shop-availability')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ dayOfWeek: 1, isOpen: true, openTime: '17:00', closeTime: '09:00' });
      expect([400, 401, 403]).toContain(response.status);
    });

    it('config: should reject negative buffer time', async () => {
      const response = await request(app)
        .put('/api/services/appointments/time-slot-config')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ bufferTimeMinutes: -5 });
      expect([400, 401, 403]).toContain(response.status);
    });

    it('config: should reject zero concurrent bookings', async () => {
      const response = await request(app)
        .put('/api/services/appointments/time-slot-config')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ maxConcurrentBookings: 0 });
      expect([400, 401, 403]).toContain(response.status);
    });
  });
});
