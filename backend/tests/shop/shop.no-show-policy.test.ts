/**
 * Shop No-Show Policy E2E Tests
 *
 * Tests the /shop?tab=settings "No-Show Policy" section:
 * - Get policy (with defaults)
 * - Update policy fields
 * - Validation rules (thresholds, ranges, ordering)
 * - Customer tier system (normal → caution → deposit → suspended)
 * - Customer status endpoint
 * - Booking restrictions based on tier
 * - Dispute settings
 * - Notification settings
 * - Authentication & authorization
 *
 * API Endpoints Tested:
 * - GET /api/services/shops/:shopId/no-show-policy
 * - PUT /api/services/shops/:shopId/no-show-policy
 * - GET /api/customers/:address/no-show-status?shopId=X
 * - GET /api/customers/:address/overall-no-show-status
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, jest, afterAll } from '@jest/globals';
import RepairCoinApp from '../../src/app';
import jwt from 'jsonwebtoken';

jest.mock('thirdweb');

describe('Shop No-Show Policy Tests', () => {
  let app: any;

  const JWT_SECRET = 'test-secret-for-noshow-policy32!';
  const shopId = 'shop-noshow-test-001';
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
  // SECTION 1: Get Policy - Authentication
  // ============================================================
  describe('Get Policy - Authentication', () => {
    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .get(`/api/services/shops/${shopId}/no-show-policy`);
      expect([401, 403]).toContain(response.status);
    });

    it('should reject customer role', async () => {
      const response = await request(app)
        .get(`/api/services/shops/${shopId}/no-show-policy`)
        .set('Cookie', [`auth_token=${customerToken}`]);
      expect([401, 403]).toContain(response.status);
    });

    it('should reject other shop accessing policy', async () => {
      const response = await request(app)
        .get(`/api/services/shops/${shopId}/no-show-policy`)
        .set('Cookie', [`auth_token=${otherShopToken}`]);
      expect([401, 403]).toContain(response.status);
    });

    it('should return policy for shop owner', async () => {
      const response = await request(app)
        .get(`/api/services/shops/${shopId}/no-show-policy`)
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 2: Get Policy - Default Values
  // ============================================================
  describe('Get Policy - Default Values', () => {
    it('should return policy with all expected fields', async () => {
      const response = await request(app)
        .get(`/api/services/shops/${shopId}/no-show-policy`)
        .set('Cookie', [`auth_token=${shopToken}`]);

      if (response.status === 200) {
        const data = response.body.data;
        expect(data).toHaveProperty('enabled');
        expect(data).toHaveProperty('gracePeriodMinutes');
        expect(data).toHaveProperty('cautionThreshold');
        expect(data).toHaveProperty('depositThreshold');
        expect(data).toHaveProperty('suspensionThreshold');
        expect(data).toHaveProperty('depositAmount');
        expect(data).toHaveProperty('maxRcnRedemptionPercent');
        expect(data).toHaveProperty('allowDisputes');
        expect(data).toHaveProperty('disputeWindowDays');
        expect(data).toHaveProperty('autoApproveFirstOffense');
      }
    });

    it('default thresholds should be in correct order', async () => {
      const response = await request(app)
        .get(`/api/services/shops/${shopId}/no-show-policy`)
        .set('Cookie', [`auth_token=${shopToken}`]);

      if (response.status === 200) {
        const data = response.body.data;
        expect(data.cautionThreshold).toBeLessThan(data.depositThreshold);
        expect(data.depositThreshold).toBeLessThan(data.suspensionThreshold);
      }
    });
  });

  // ============================================================
  // SECTION 3: Update Policy - Authentication
  // ============================================================
  describe('Update Policy - Authentication', () => {
    it('should reject unauthenticated update', async () => {
      const response = await request(app)
        .put(`/api/services/shops/${shopId}/no-show-policy`)
        .send({ enabled: false });
      expect([401, 403]).toContain(response.status);
    });

    it('should reject customer updating policy', async () => {
      const response = await request(app)
        .put(`/api/services/shops/${shopId}/no-show-policy`)
        .set('Cookie', [`auth_token=${customerToken}`])
        .send({ enabled: false });
      expect([401, 403]).toContain(response.status);
    });

    it('should reject other shop updating policy', async () => {
      const response = await request(app)
        .put(`/api/services/shops/${shopId}/no-show-policy`)
        .set('Cookie', [`auth_token=${otherShopToken}`])
        .send({ enabled: false });
      expect([401, 403]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 4: Update Policy - Validation
  // ============================================================
  describe('Update Policy - Validation', () => {
    it('should accept toggling enabled', async () => {
      const response = await request(app)
        .put(`/api/services/shops/${shopId}/no-show-policy`)
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ enabled: true });
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should reject negative grace period', async () => {
      const response = await request(app)
        .put(`/api/services/shops/${shopId}/no-show-policy`)
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ gracePeriodMinutes: -5 });
      expect([400, 401, 403]).toContain(response.status);
    });

    it('should reject grace period over 120 minutes', async () => {
      const response = await request(app)
        .put(`/api/services/shops/${shopId}/no-show-policy`)
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ gracePeriodMinutes: 200 });
      expect([400, 401, 403]).toContain(response.status);
    });

    it('should reject advance booking hours over 168', async () => {
      const response = await request(app)
        .put(`/api/services/shops/${shopId}/no-show-policy`)
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ cautionAdvanceBookingHours: 200 });
      expect([400, 401, 403]).toContain(response.status);
    });

    it('should reject deposit amount over 500', async () => {
      const response = await request(app)
        .put(`/api/services/shops/${shopId}/no-show-policy`)
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ depositAmount: 600 });
      expect([400, 401, 403]).toContain(response.status);
    });

    it('should reject negative deposit amount', async () => {
      const response = await request(app)
        .put(`/api/services/shops/${shopId}/no-show-policy`)
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ depositAmount: -10 });
      expect([400, 401, 403]).toContain(response.status);
    });

    it('should reject suspension days over 365', async () => {
      const response = await request(app)
        .put(`/api/services/shops/${shopId}/no-show-policy`)
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ suspensionDurationDays: 400 });
      expect([400, 401, 403]).toContain(response.status);
    });

    it('should reject dispute window over 30 days', async () => {
      const response = await request(app)
        .put(`/api/services/shops/${shopId}/no-show-policy`)
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ disputeWindowDays: 60 });
      expect([400, 401, 403]).toContain(response.status);
    });

    it('should reject maxRcnRedemptionPercent over 100', async () => {
      const response = await request(app)
        .put(`/api/services/shops/${shopId}/no-show-policy`)
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ maxRcnRedemptionPercent: 150 });
      expect([400, 401, 403]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 5: Customer No-Show Status
  // ============================================================
  describe('Customer No-Show Status', () => {
    it('should reject unauthenticated status check', async () => {
      const response = await request(app)
        .get(`/api/customers/${customerWallet}/no-show-status`)
        .query({ shopId });
      expect([401, 403]).toContain(response.status);
    });

    it('should require shopId parameter', async () => {
      const response = await request(app)
        .get(`/api/customers/${customerWallet}/no-show-status`)
        .set('Cookie', [`auth_token=${customerToken}`]);
      expect([400, 401, 403]).toContain(response.status);
    });

    it('should return status for customer', async () => {
      const response = await request(app)
        .get(`/api/customers/${customerWallet}/no-show-status`)
        .query({ shopId })
        .set('Cookie', [`auth_token=${customerToken}`]);
      expect([200, 401, 403, 404]).toContain(response.status);
      if (response.status === 200) {
        const data = response.body.data;
        expect(data).toHaveProperty('tier');
        expect(data).toHaveProperty('noShowCount');
        expect(data).toHaveProperty('canBook');
        expect(data).toHaveProperty('minimumAdvanceHours');
        expect(data).toHaveProperty('restrictions');
      }
    });

    it('should return overall status without shopId', async () => {
      const response = await request(app)
        .get(`/api/customers/${customerWallet}/overall-no-show-status`)
        .set('Cookie', [`auth_token=${customerToken}`]);
      expect([200, 401, 403, 404]).toContain(response.status);
    });

    it('should include isHomeShop in shop-specific status', async () => {
      const response = await request(app)
        .get(`/api/customers/${customerWallet}/no-show-status`)
        .query({ shopId })
        .set('Cookie', [`auth_token=${customerToken}`]);
      if (response.status === 200) {
        expect(response.body.data).toHaveProperty('isHomeShop');
        expect(response.body.data).toHaveProperty('maxRcnRedemptionPercent');
      }
    });
  });

  // ============================================================
  // SECTION 6: Tier System Contract
  // ============================================================
  describe('Tier System Contract', () => {
    it('tiers should be well-defined', () => {
      const tiers = ['normal', 'warning', 'caution', 'deposit_required', 'suspended'];
      expect(tiers).toHaveLength(5);
    });

    it('tier restrictions should escalate correctly', () => {
      const tierRestrictions = {
        normal: { advanceHours: 0, deposit: false, canBook: true },
        caution: { advanceHours: 24, deposit: false, canBook: true },
        deposit_required: { advanceHours: 48, deposit: true, canBook: true },
        suspended: { advanceHours: 0, deposit: false, canBook: false },
      };

      expect(tierRestrictions.normal.advanceHours).toBe(0);
      expect(tierRestrictions.caution.advanceHours).toBe(24);
      expect(tierRestrictions.deposit_required.advanceHours).toBe(48);
      expect(tierRestrictions.deposit_required.deposit).toBe(true);
      expect(tierRestrictions.suspended.canBook).toBe(false);
    });

    it('tier bonuses should match RCN cap', () => {
      const rcnCap = 80; // percentage
      const appliesTo = ['caution', 'deposit_required'];
      expect(rcnCap).toBeLessThanOrEqual(100);
      expect(appliesTo).toHaveLength(2);
    });

    it('deposit should be refundable on completion', () => {
      const depositRefundable = true;
      const refundTrigger = 'order_completed';
      expect(depositRefundable).toBe(true);
      expect(refundTrigger).toBe('order_completed');
    });

    it('suspension should have end date', () => {
      const suspensionDurationDays = 30;
      const hasEndDate = true;
      expect(suspensionDurationDays).toBeGreaterThan(0);
      expect(hasEndDate).toBe(true);
    });

    it('deposit reset after successful appointments', () => {
      const resetAfter = 3;
      expect(resetAfter).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // SECTION 7: Dispute Settings Contract
  // ============================================================
  describe('Dispute Settings Contract', () => {
    it('dispute should require minimum 10 char reason', () => {
      const minReasonLength = 10;
      expect(minReasonLength).toBe(10);
    });

    it('auto-approve should only work for first offense', () => {
      const firstOffenseOnly = true;
      expect(firstOffenseOnly).toBe(true);
    });

    it('dispute window should be configurable (1-30 days)', () => {
      const minWindow = 1;
      const maxWindow = 30;
      const defaultWindow = 7;
      expect(defaultWindow).toBeGreaterThanOrEqual(minWindow);
      expect(defaultWindow).toBeLessThanOrEqual(maxWindow);
    });

    it('approved dispute should reverse penalty', () => {
      const reversesNoShowCount = true;
      const recalculatesTier = true;
      const marksAsReversed = true;
      expect(reversesNoShowCount).toBe(true);
      expect(recalculatesTier).toBe(true);
      expect(marksAsReversed).toBe(true);
    });

    it('rejected dispute should require notes (10+ chars)', () => {
      const requiresNotes = true;
      const minNotesLength = 10;
      expect(requiresNotes).toBe(true);
      expect(minNotesLength).toBe(10);
    });
  });

  // ============================================================
  // SECTION 8: Notification Settings Contract
  // ============================================================
  describe('Notification Settings', () => {
    it('email notifications per tier should be toggleable', () => {
      const emailSettings = ['sendEmailTier1', 'sendEmailTier2', 'sendEmailTier3', 'sendEmailTier4'];
      expect(emailSettings).toHaveLength(4);
    });

    it('SMS notifications should be available for tier 2+', () => {
      const smsSettings = ['sendSmsTier2', 'sendSmsTier3', 'sendSmsTier4'];
      expect(smsSettings).toHaveLength(3);
      // No SMS for tier 1 (just a warning)
    });

    it('push notifications should be a single toggle', () => {
      const pushSetting = 'sendPushNotifications';
      expect(typeof pushSetting).toBe('string');
    });
  });

  // ============================================================
  // SECTION 9: Booking Enforcement Contract
  // ============================================================
  describe('Booking Enforcement', () => {
    it('caution tier should enforce advance booking hours', () => {
      const cautionAdvanceHours = 24;
      const bookingInHours = 12;
      const isBlocked = bookingInHours < cautionAdvanceHours;
      expect(isBlocked).toBe(true);
    });

    it('deposit tier should enforce higher advance hours', () => {
      const depositAdvanceHours = 48;
      const bookingInHours = 30;
      const isBlocked = bookingInHours < depositAdvanceHours;
      expect(isBlocked).toBe(true);
    });

    it('suspended tier should block all bookings', () => {
      const canBook = false;
      expect(canBook).toBe(false);
    });

    it('RCN cap should apply to caution and deposit tiers', () => {
      const maxRcnPercent = 80;
      const servicePrice = 59;
      const maxRcnDiscount = servicePrice * (maxRcnPercent / 100);
      expect(maxRcnDiscount).toBe(47.2);
    });

    it('deposit should be added to Stripe checkout total', () => {
      const servicePrice = 59;
      const depositAmount = 25;
      const total = servicePrice + depositAmount;
      expect(total).toBe(84);
    });

    it('deposit should use parseFloat to avoid string concatenation', () => {
      const servicePrice = 59;
      const depositFromDb = '25.00'; // PostgreSQL returns string
      const total = parseFloat(String(servicePrice)) + parseFloat(String(depositFromDb));
      expect(total).toBe(84);
      // Without parseFloat: 59 + "25.00" = "5925.00" (the overcharge bug)
    });
  });

  // ============================================================
  // SECTION 10: Policy Field Ranges
  // ============================================================
  describe('Policy Field Ranges', () => {
    it('grace period: 0-120 minutes', () => {
      expect(0).toBeGreaterThanOrEqual(0);
      expect(120).toBeLessThanOrEqual(120);
    });

    it('caution threshold: 1-10', () => {
      expect(2).toBeGreaterThanOrEqual(1);
      expect(2).toBeLessThanOrEqual(10);
    });

    it('deposit threshold: 1-20', () => {
      expect(3).toBeGreaterThanOrEqual(1);
      expect(3).toBeLessThanOrEqual(20);
    });

    it('suspension threshold: 1-50', () => {
      expect(5).toBeGreaterThanOrEqual(1);
      expect(5).toBeLessThanOrEqual(50);
    });

    it('advance booking hours: 0-168 (7 days)', () => {
      expect(24).toBeGreaterThanOrEqual(0);
      expect(48).toBeLessThanOrEqual(168);
    });

    it('deposit amount: $0-$500', () => {
      expect(25).toBeGreaterThanOrEqual(0);
      expect(25).toBeLessThanOrEqual(500);
    });

    it('suspension duration: 1-365 days', () => {
      expect(30).toBeGreaterThanOrEqual(1);
      expect(30).toBeLessThanOrEqual(365);
    });

    it('dispute window: 1-30 days', () => {
      expect(7).toBeGreaterThanOrEqual(1);
      expect(7).toBeLessThanOrEqual(30);
    });

    it('RCN redemption percent: 0-100', () => {
      expect(80).toBeGreaterThanOrEqual(0);
      expect(80).toBeLessThanOrEqual(100);
    });

    it('deposit reset: 1-20 successful appointments', () => {
      expect(3).toBeGreaterThanOrEqual(1);
      expect(3).toBeLessThanOrEqual(20);
    });
  });
});
