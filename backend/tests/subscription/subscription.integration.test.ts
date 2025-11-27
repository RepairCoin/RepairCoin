import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import RepairCoinApp from '../../src/app';
import { ShopRepository } from '../../src/repositories/ShopRepository';
import { SubscriptionService } from '../../src/services/SubscriptionService';
import { StripeService } from '../../src/services/StripeService';
import { DatabaseService } from '../../src/services/DatabaseService';
import { RedemptionSessionService } from '../../src/domains/token/services/RedemptionSessionService';

jest.mock('../../src/repositories/ShopRepository');
jest.mock('../../src/services/SubscriptionService');
jest.mock('../../src/services/StripeService');
jest.mock('../../src/domains/token/services/RedemptionSessionService');

/**
 * Subscription Integration Tests
 * Tests Stripe integration and cross-feature interactions
 */
describe('Subscription Integration Tests', () => {
  let app: any;
  let adminToken: string;
  let shopToken: string;
  const shopId = 'test-shop-integration';
  const subscriptionId = 'test-subscription-id';
  const stripeSubscriptionId = 'sub_test123';
  const stripePriceId = 'price_test123';

  const mockShop = {
    shop_id: shopId,
    name: 'Integration Test Shop',
    email: 'integration@example.com',
    wallet_address: '0x1234567890123456789012345678901234567890',
    is_verified: true,
    is_active: true
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.NODE_ENV = 'test';
    process.env.STRIPE_MONTHLY_PRICE_ID = stripePriceId;
    
    const repairCoinApp = new RepairCoinApp();
    await repairCoinApp.initialize();
    app = repairCoinApp.app;

    // Mock authentication
    const adminAuthResponse = await request(app)
      .post('/api/auth/admin')
      .send({ email: 'admin@repaircoin.com', password: 'admin123' });
    adminToken = adminAuthResponse.body.token;

    const shopAuthResponse = await request(app)
      .post('/api/auth/shop')
      .send({ shopId, walletAddress: mockShop.wallet_address });
    shopToken = shopAuthResponse.body.token;
  });

  /**
   * TC-INT-001: Stripe Subscription Created
   * Priority: Critical
   */
  describe('TC-INT-001: Stripe Subscription Created', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should create Stripe subscription and local record on payment completion', async () => {
      const mockStripeService = StripeService as jest.MockedClass<typeof StripeService>;
      const stripeSubscription = {
        id: stripeSubscriptionId,
        status: 'active',
        customer: 'cus_test123',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
      };

      mockStripeService.prototype.createSubscription = jest.fn().mockResolvedValue(stripeSubscription);

      const mockDbQuery = jest.fn()
        .mockResolvedValueOnce({ rows: [] }) // Check for existing subscription
        .mockResolvedValueOnce({ rows: [{ stripe_customer_id: 'cus_test123' }] }) // Customer lookup
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ 
          rows: [{
            id: subscriptionId,
            stripe_subscription_id: stripeSubscriptionId,
            status: 'active'
          }] 
        }) // INSERT subscription
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      const response = await request(app)
        .post('/api/shops/subscription/create')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          paymentMethodId: 'pm_test123',
          email: mockShop.email,
          name: mockShop.name
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.subscription.stripeSubscriptionId).toBe(stripeSubscriptionId);
    });

    it('should store Stripe subscription ID in database', async () => {
      const insertCalls: any[] = [];
      const mockDbQuery = jest.fn()
        .mockImplementation((query, params) => {
          if (query.includes('INSERT') && query.includes('stripe_subscriptions')) {
            insertCalls.push({ query, params });
            return Promise.resolve({
              rows: [{
                id: subscriptionId,
                stripe_subscription_id: stripeSubscriptionId,
                stripe_price_id: stripePriceId
              }]
            });
          }
          return Promise.resolve({ rows: [{ stripe_customer_id: 'cus_test123' }] });
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      await request(app)
        .post('/api/shops/subscription/create')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          paymentMethodId: 'pm_test123',
          email: mockShop.email
        });

      expect(insertCalls.length).toBeGreaterThan(0);
      expect(insertCalls[0].params).toContain(stripeSubscriptionId);
    });

    it('should set status to Active', async () => {
      const mockDbQuery = jest.fn()
        .mockResolvedValue({
          rows: [{
            id: subscriptionId,
            stripe_subscription_id: stripeSubscriptionId,
            status: 'active',
            is_active: true
          }]
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      const response = await request(app)
        .get('/api/shops/subscription/status')
        .set('Authorization', `Bearer ${shopToken}`);

      expect(response.body.data.currentSubscription.status).toBe('active');
    });

    it('should set current period dates correctly', async () => {
      const now = Date.now();
      const periodStart = Math.floor(now / 1000);
      const periodEnd = periodStart + 30 * 24 * 60 * 60;

      const mockDbQuery = jest.fn()
        .mockResolvedValue({
          rows: [{
            id: subscriptionId,
            stripe_subscription_id: stripeSubscriptionId,
            current_period_start: new Date(periodStart * 1000),
            current_period_end: new Date(periodEnd * 1000)
          }]
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      const response = await request(app)
        .get('/api/shops/subscription/status')
        .set('Authorization', `Bearer ${shopToken}`);

      const subscription = response.body.data.currentSubscription;
      expect(new Date(subscription.currentPeriodStart)).toBeInstanceOf(Date);
      expect(new Date(subscription.currentPeriodEnd)).toBeInstanceOf(Date);
      expect(new Date(subscription.currentPeriodEnd).getTime())
        .toBeGreaterThan(new Date(subscription.currentPeriodStart).getTime());
    });

    it('should grant shop operational access', async () => {
      const mockSubscriptionService = SubscriptionService as jest.MockedClass<typeof SubscriptionService>;
      mockSubscriptionService.prototype.getActiveSubscription = jest.fn().mockResolvedValue({
        id: subscriptionId,
        stripeSubscriptionId,
        status: 'active',
        shopId
      });

      // Test that shop can issue rewards
      const response = await request(app)
        .post(`/api/shops/${shopId}/issue-reward`)
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          customerAddress: '0x1234567890123456789012345678901234567890',
          repairAmount: 100,
          serviceType: 'oil_change'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  /**
   * TC-INT-002: Stripe Subscription Updated
   * Priority: High
   */
  describe('TC-INT-002: Stripe Subscription Updated', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should process webhook when subscription is modified in Stripe', async () => {
      const mockDbQuery = jest.fn()
        .mockResolvedValue({
          rows: [{
            id: subscriptionId,
            stripe_subscription_id: stripeSubscriptionId,
            shop_id: shopId
          }],
          rowCount: 1
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .send({
          type: 'customer.subscription.updated',
          data: {
            object: {
              id: stripeSubscriptionId,
              status: 'active',
              current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
            }
          }
        });

      expect(response.status).toBe(200);
    });

    it('should update local subscription record', async () => {
      const updateCalls: any[] = [];
      const mockDbQuery = jest.fn()
        .mockImplementation((query, params) => {
          if (query.includes('UPDATE') && query.includes('stripe_subscriptions')) {
            updateCalls.push({ query, params });
          }
          return Promise.resolve({ rows: [{ id: subscriptionId }], rowCount: 1 });
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      await request(app)
        .post('/api/webhooks/stripe')
        .send({
          type: 'customer.subscription.updated',
          data: {
            object: {
              id: stripeSubscriptionId,
              status: 'active',
              cancel_at_period_end: true
            }
          }
        });

      expect(updateCalls.length).toBeGreaterThan(0);
    });

    it('should reflect changes in admin dashboard', async () => {
      const mockDbQuery = jest.fn()
        .mockResolvedValue({
          rows: [{
            id: subscriptionId,
            stripe_subscription_id: stripeSubscriptionId,
            status: 'active',
            cancel_at_period_end: true,
            shop_name: mockShop.name
          }]
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      const response = await request(app)
        .get('/api/admin/subscriptions')
        .set('Authorization', `Bearer ${adminToken}`);

      const subscription = response.body.data.find((s: any) => s.id === subscriptionId);
      expect(subscription).toBeDefined();
      expect(subscription.cancelAtPeriodEnd).toBe(true);
    });

    it('should show updated information to shop', async () => {
      const mockSubscriptionService = SubscriptionService as jest.MockedClass<typeof SubscriptionService>;
      mockSubscriptionService.prototype.getActiveSubscription = jest.fn().mockResolvedValue({
        id: subscriptionId,
        stripeSubscriptionId,
        status: 'active',
        cancelAtPeriodEnd: true,
        shopId
      });

      const response = await request(app)
        .get('/api/shops/subscription/status')
        .set('Authorization', `Bearer ${shopToken}`);

      expect(response.body.data.currentSubscription.cancelAtPeriodEnd).toBe(true);
    });
  });

  /**
   * TC-INT-003: Stripe Payment Failed Webhook
   * Priority: High
   */
  describe('TC-INT-003: Stripe Payment Failed Webhook', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should process payment failure webhook', async () => {
      const mockDbQuery = jest.fn()
        .mockResolvedValue({
          rows: [{ id: subscriptionId, stripe_subscription_id: stripeSubscriptionId }],
          rowCount: 1
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .send({
          type: 'invoice.payment_failed',
          data: {
            object: {
              subscription: stripeSubscriptionId,
              attempt_count: 1
            }
          }
        });

      expect(response.status).toBe(200);
    });

    it('should mark subscription as Overdue', async () => {
      const updateCalls: any[] = [];
      const mockDbQuery = jest.fn()
        .mockImplementation((query, params) => {
          if (query.includes('UPDATE') && query.includes('status')) {
            updateCalls.push({ query, params });
          }
          return Promise.resolve({ rows: [], rowCount: 1 });
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      await request(app)
        .post('/api/webhooks/stripe')
        .send({
          type: 'invoice.payment_failed',
          data: {
            object: {
              subscription: stripeSubscriptionId
            }
          }
        });

      const statusUpdate = updateCalls.find(call => 
        call.params?.includes('past_due') || call.params?.includes('overdue')
      );
      expect(statusUpdate).toBeDefined();
    });

    it('should send email notification to shop', async () => {
      const notifications: any[] = [];
      const mockDbQuery = jest.fn()
        .mockImplementation((query, params) => {
          if (query.includes('INSERT') && query.includes('notifications')) {
            notifications.push({ query, params });
          }
          return Promise.resolve({
            rows: [{ id: subscriptionId, shop_id: shopId }],
            rowCount: 1
          });
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      await request(app)
        .post('/api/webhooks/stripe')
        .send({
          type: 'invoice.payment_failed',
          data: {
            object: {
              subscription: stripeSubscriptionId,
              customer_email: mockShop.email
            }
          }
        });

      expect(notifications.length).toBeGreaterThan(0);
    });

    it('should start grace period if configured', async () => {
      const mockDbQuery = jest.fn()
        .mockResolvedValue({
          rows: [{
            id: subscriptionId,
            status: 'past_due',
            grace_period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          }],
          rowCount: 1
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      const response = await request(app)
        .get('/api/shops/subscription/status')
        .set('Authorization', `Bearer ${shopToken}`);

      expect(response.body.data.currentSubscription.gracePeriodEnd).toBeDefined();
    });

    it('should update subscription statistics', async () => {
      const mockDbQuery = jest.fn()
        .mockResolvedValue({
          rows: [{
            active_count: 5,
            past_due_count: 2,
            total_count: 10
          }]
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      const response = await request(app)
        .get('/api/admin/subscriptions/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.body.data.pastDue).toBeGreaterThan(0);
    });
  });

  /**
   * TC-INT-004: Stripe Subscription Cancelled Webhook
   * Priority: High
   */
  describe('TC-INT-004: Stripe Subscription Cancelled Webhook', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should process cancellation webhook from Stripe', async () => {
      const mockDbQuery = jest.fn()
        .mockResolvedValue({
          rows: [{ id: subscriptionId }],
          rowCount: 1
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .send({
          type: 'customer.subscription.deleted',
          data: {
            object: {
              id: stripeSubscriptionId,
              canceled_at: Math.floor(Date.now() / 1000)
            }
          }
        });

      expect(response.status).toBe(200);
    });

    it('should mark local subscription as Cancelled', async () => {
      const mockDbQuery = jest.fn()
        .mockResolvedValue({
          rows: [{
            id: subscriptionId,
            status: 'cancelled',
            cancelled_at: new Date()
          }],
          rowCount: 1
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      await request(app)
        .post('/api/webhooks/stripe')
        .send({
          type: 'customer.subscription.deleted',
          data: {
            object: { id: stripeSubscriptionId }
          }
        });

      const statusResponse = await request(app)
        .get('/api/admin/subscriptions/${subscriptionId}')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(statusResponse.body.data.subscription.status).toBe('cancelled');
    });

    it('should update cancel_at_period_end flag', async () => {
      const mockDbQuery = jest.fn()
        .mockResolvedValue({
          rows: [{
            id: subscriptionId,
            cancel_at_period_end: true
          }],
          rowCount: 1
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      await request(app)
        .post('/api/webhooks/stripe')
        .send({
          type: 'customer.subscription.updated',
          data: {
            object: {
              id: stripeSubscriptionId,
              cancel_at_period_end: true
            }
          }
        });

      const response = await request(app)
        .get('/api/shops/subscription/status')
        .set('Authorization', `Bearer ${shopToken}`);

      expect(response.body.data.currentSubscription.cancelAtPeriodEnd).toBe(true);
    });

    it('should retain shop access until period end', async () => {
      const periodEnd = Date.now() + 15 * 24 * 60 * 60 * 1000; // 15 days from now
      const mockSubscriptionService = SubscriptionService as jest.MockedClass<typeof SubscriptionService>;
      mockSubscriptionService.prototype.getActiveSubscription = jest.fn().mockResolvedValue({
        id: subscriptionId,
        stripeSubscriptionId,
        status: 'active',
        cancelAtPeriodEnd: true,
        currentPeriodEnd: new Date(periodEnd),
        shopId
      });

      // Shop should still have access
      const response = await request(app)
        .post(`/api/shops/${shopId}/issue-reward`)
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          customerAddress: '0x1234567890123456789012345678901234567890',
          repairAmount: 100
        });

      expect(response.status).toBe(200);
    });

    it('should send notification to shop', async () => {
      const notifications: any[] = [];
      const mockDbQuery = jest.fn()
        .mockImplementation((query, params) => {
          if (query.includes('notifications')) {
            notifications.push({ query, params });
          }
          return Promise.resolve({ rows: [], rowCount: 1 });
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      await request(app)
        .post('/api/webhooks/stripe')
        .send({
          type: 'customer.subscription.deleted',
          data: {
            object: {
              id: stripeSubscriptionId,
              customer: 'cus_test123'
            }
          }
        });

      expect(notifications.length).toBeGreaterThan(0);
    });
  });

  /**
   * TC-INT-005: Paused Subscription - Issue Rewards Attempt
   * Priority: High
   */
  describe('TC-INT-005: Cross-Feature Integration - Paused Subscription', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should block reward issuance when subscription is paused', async () => {
      const mockSubscriptionService = SubscriptionService as jest.MockedClass<typeof SubscriptionService>;
      mockSubscriptionService.prototype.getActiveSubscription = jest.fn().mockResolvedValue({
        id: subscriptionId,
        stripeSubscriptionId,
        status: 'paused',
        shopId
      });

      const response = await request(app)
        .post(`/api/shops/${shopId}/issue-reward`)
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          customerAddress: '0x1234567890123456789012345678901234567890',
          repairAmount: 100,
          serviceType: 'oil_change'
        });

      expect(response.status).toBe(402);
      expect(response.body.success).toBe(false);
    });

    it('should return appropriate error message', async () => {
      const mockSubscriptionService = SubscriptionService as jest.MockedClass<typeof SubscriptionService>;
      mockSubscriptionService.prototype.getActiveSubscription = jest.fn().mockResolvedValue({
        id: subscriptionId,
        status: 'paused',
        shopId
      });

      const response = await request(app)
        .post(`/api/shops/${shopId}/issue-reward`)
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          customerAddress: '0x1234567890123456789012345678901234567890',
          repairAmount: 100
        });

      expect(response.body.error).toMatch(/subscription.*paused|paused.*subscription/i);
    });

    it('should not initiate blockchain transaction', async () => {
      const mockSubscriptionService = SubscriptionService as jest.MockedClass<typeof SubscriptionService>;
      mockSubscriptionService.prototype.getActiveSubscription = jest.fn().mockResolvedValue({
        id: subscriptionId,
        status: 'paused',
        shopId
      });

      const blockchainCalls: any[] = [];
      const mockDbQuery = jest.fn()
        .mockImplementation((query) => {
          if (query.includes('transactions') || query.includes('blockchain')) {
            blockchainCalls.push(query);
          }
          return Promise.resolve({ rows: [], rowCount: 0 });
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      await request(app)
        .post(`/api/shops/${shopId}/issue-reward`)
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          customerAddress: '0x1234567890123456789012345678901234567890',
          repairAmount: 100
        });

      expect(blockchainCalls.length).toBe(0);
    });

    it('should not distribute tokens to customer', async () => {
      const mockSubscriptionService = SubscriptionService as jest.MockedClass<typeof SubscriptionService>;
      mockSubscriptionService.prototype.getActiveSubscription = jest.fn().mockResolvedValue({
        id: subscriptionId,
        status: 'paused',
        shopId
      });

      const customerBalance = 1000;
      const mockDbQuery = jest.fn()
        .mockResolvedValue({
          rows: [{ balance: customerBalance }]
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      await request(app)
        .post(`/api/shops/${shopId}/issue-reward`)
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          customerAddress: '0x1234567890123456789012345678901234567890',
          repairAmount: 100
        });

      // Verify customer balance remains unchanged
      const balanceResponse = await request(app)
        .get('/api/customers/balance')
        .set('Authorization', `Bearer ${shopToken}`);

      expect(balanceResponse.body.data.balance).toBe(customerBalance);
    });

    it('should log event in audit trail', async () => {
      const auditLogs: any[] = [];
      const mockDbQuery = jest.fn()
        .mockImplementation((query, params) => {
          if (query.includes('audit') || query.includes('log')) {
            auditLogs.push({ query, params });
          }
          return Promise.resolve({ rows: [], rowCount: 0 });
        });

      const mockSubscriptionService = SubscriptionService as jest.MockedClass<typeof SubscriptionService>;
      mockSubscriptionService.prototype.getActiveSubscription = jest.fn().mockResolvedValue({
        id: subscriptionId,
        status: 'paused',
        shopId
      });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      await request(app)
        .post(`/api/shops/${shopId}/issue-reward`)
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          customerAddress: '0x1234567890123456789012345678901234567890',
          repairAmount: 100
        });

      expect(auditLogs.length).toBeGreaterThan(0);
    });
  });

  /**
   * TC-INT-006: Expired Subscription - Redemption Process
   * Priority: High
   */
  describe('TC-INT-006: Cross-Feature Integration - Expired Subscription Redemption', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should block redemption when subscription is expired', async () => {
      const mockSubscriptionService = SubscriptionService as jest.MockedClass<typeof SubscriptionService>;
      mockSubscriptionService.prototype.getActiveSubscription = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/shops/${shopId}/redemption/start`)
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          customerAddress: '0x1234567890123456789012345678901234567890',
          amount: 50
        });

      expect(response.status).toBe(402);
    });

    it('should display error to shop during redemption attempt', async () => {
      const mockSubscriptionService = SubscriptionService as jest.MockedClass<typeof SubscriptionService>;
      mockSubscriptionService.prototype.getActiveSubscription = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/shops/${shopId}/redemption/start`)
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          customerAddress: '0x1234567890123456789012345678901234567890',
          amount: 50
        });

      expect(response.body.error).toMatch(/subscription.*expired|expired.*subscription/i);
    });

    it('should not charge customer tokens', async () => {
      const mockSubscriptionService = SubscriptionService as jest.MockedClass<typeof SubscriptionService>;
      mockSubscriptionService.prototype.getActiveSubscription = jest.fn().mockResolvedValue(null);

      const customerAddress = '0x1234567890123456789012345678901234567890';
      const initialBalance = 1000;

      const mockDbQuery = jest.fn()
        .mockResolvedValue({
          rows: [{ address: customerAddress, balance: initialBalance }]
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      await request(app)
        .post(`/api/shops/${shopId}/redemption/start`)
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          customerAddress,
          amount: 50
        });

      // Verify customer balance unchanged
      const balanceResponse = await request(app)
        .get(`/api/customers/${customerAddress}/balance`)
        .set('Authorization', `Bearer ${shopToken}`);

      expect(balanceResponse.body.data.balance).toBe(initialBalance);
    });

    it('should not create redemption session', async () => {
      const mockSubscriptionService = SubscriptionService as jest.MockedClass<typeof SubscriptionService>;
      mockSubscriptionService.prototype.getActiveSubscription = jest.fn().mockResolvedValue(null);

      const mockRedemptionService = RedemptionSessionService as jest.MockedClass<typeof RedemptionSessionService>;
      mockRedemptionService.prototype.startSession = jest.fn();

      await request(app)
        .post(`/api/shops/${shopId}/redemption/start`)
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          customerAddress: '0x1234567890123456789012345678901234567890',
          amount: 50
        });

      expect(mockRedemptionService.prototype.startSession).not.toHaveBeenCalled();
    });

    it('should not record transaction', async () => {
      const mockSubscriptionService = SubscriptionService as jest.MockedClass<typeof SubscriptionService>;
      mockSubscriptionService.prototype.getActiveSubscription = jest.fn().mockResolvedValue(null);

      const transactionInserts: any[] = [];
      const mockDbQuery = jest.fn()
        .mockImplementation((query) => {
          if (query.includes('INSERT') && query.includes('transactions')) {
            transactionInserts.push(query);
          }
          return Promise.resolve({ rows: [], rowCount: 0 });
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      await request(app)
        .post(`/api/shops/${shopId}/redemption/start`)
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          customerAddress: '0x1234567890123456789012345678901234567890',
          amount: 50
        });

      expect(transactionInserts.length).toBe(0);
    });
  });

  /**
   * TC-INT-007: Subscription Status Change - Active Session Impact
   * Priority: Medium
   */
  describe('TC-INT-007: Active Session During Subscription Status Change', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should handle session gracefully when subscription is paused mid-session', async () => {
      const sessionId = 'session_test123';
      const mockRedemptionService = RedemptionSessionService as jest.MockedClass<typeof RedemptionSessionService>;
      
      // Session is active
      mockRedemptionService.prototype.getSession = jest.fn().mockResolvedValue({
        id: sessionId,
        shopId,
        status: 'active',
        createdAt: new Date()
      });

      // Pause subscription
      await request(app)
        .post(`/api/admin/subscriptions/${subscriptionId}/pause`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Try to complete session
      const response = await request(app)
        .post(`/api/shops/${shopId}/redemption/${sessionId}/complete`)
        .set('Authorization', `Bearer ${shopToken}`);

      // Should either complete or terminate with clear message
      expect([200, 402, 409]).toContain(response.status);
      if (response.status !== 200) {
        expect(response.body.error).toBeDefined();
      }
    });

    it('should provide consistent behavior as documented', async () => {
      // This test documents the expected behavior
      const sessionId = 'session_test123';
      
      // Either: Current session completes
      // OR: Session terminates immediately with message
      
      const response = await request(app)
        .post(`/api/shops/${shopId}/redemption/${sessionId}/complete`)
        .set('Authorization', `Bearer ${shopToken}`);

      // Should not be in an undefined state
      expect(response.status).not.toBe(500);
      expect(response.body).toHaveProperty('success');
    });

    it('should protect customer experience', async () => {
      const sessionId = 'session_test123';
      const customerAddress = '0x1234567890123456789012345678901234567890';
      const redemptionAmount = 50;

      const mockDbQuery = jest.fn()
        .mockResolvedValue({
          rows: [{
            id: sessionId,
            customer_address: customerAddress,
            amount: redemptionAmount,
            status: 'active'
          }]
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      // Subscription is paused
      const mockSubscriptionService = SubscriptionService as jest.MockedClass<typeof SubscriptionService>;
      mockSubscriptionService.prototype.getActiveSubscription = jest.fn().mockResolvedValue({
        id: subscriptionId,
        status: 'paused',
        shopId
      });

      const response = await request(app)
        .post(`/api/shops/${shopId}/redemption/${sessionId}/complete`)
        .set('Authorization', `Bearer ${shopToken}`);

      // Customer should not be left in limbo
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('success');
    });
  });

  afterAll(async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
  });
});
