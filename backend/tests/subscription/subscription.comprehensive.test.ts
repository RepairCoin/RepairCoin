import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import RepairCoinApp from '../../src/app';
import { ShopRepository } from '../../src/repositories/ShopRepository';
import { CustomerRepository } from '../../src/repositories/CustomerRepository';
import { SubscriptionService } from '../../src/services/SubscriptionService';
import { DatabaseService } from '../../src/services/DatabaseService';
import { EmailService } from '../../src/services/EmailService';

jest.mock('../../src/repositories/ShopRepository');
jest.mock('../../src/repositories/CustomerRepository');
jest.mock('../../src/services/SubscriptionService');
jest.mock('../../src/services/EmailService');

/**
 * Comprehensive Subscription Tests
 * Additional tests for Admin, Shop, and Customer interactions
 */
describe('Subscription Comprehensive Interaction Tests', () => {
  let app: any;
  let adminToken: string;
  let shopToken: string;
  let customerToken: string;
  const adminId = 'test-admin';
  const shopId = 'test-shop-comprehensive';
  const customerId = 'test-customer';
  const subscriptionId = 'test-sub-123';
  const stripeSubscriptionId = 'sub_test123';

  const mockShop = {
    shop_id: shopId,
    name: 'Comprehensive Test Shop',
    email: 'comprehensive@example.com',
    wallet_address: '0x1234567890123456789012345678901234567890',
    is_verified: true,
    is_active: true
  };

  const mockCustomer = {
    address: '0x9876543210987654321098765432109876543210',
    email: 'customer@example.com',
    lifetimeEarnings: 500,
    tier: 'GOLD'
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.NODE_ENV = 'test';
    
    const repairCoinApp = new RepairCoinApp();
    await repairCoinApp.initialize();
    app = repairCoinApp.app;

    // Mock authentication for all user types
    const adminAuthResponse = await request(app)
      .post('/api/auth/admin')
      .send({ email: 'admin@repaircoin.com', password: 'admin123' });
    adminToken = adminAuthResponse.body.token;

    const shopAuthResponse = await request(app)
      .post('/api/auth/shop')
      .send({ shopId, walletAddress: mockShop.wallet_address });
    shopToken = shopAuthResponse.body.token;

    const customerAuthResponse = await request(app)
      .post('/api/auth/customer')
      .send({ address: mockCustomer.address });
    customerToken = customerAuthResponse.body.token;
  });

  /**
   * Admin Role Tests
   */
  describe('Admin Subscription Management', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should allow admin to view all subscriptions across all shops', async () => {
      const mockDbQuery = jest.fn()
        .mockResolvedValue({
          rows: [
            { id: '1', shop_id: 'shop1', status: 'active', shop_name: 'Shop 1' },
            { id: '2', shop_id: 'shop2', status: 'paused', shop_name: 'Shop 2' },
            { id: '3', shop_id: 'shop3', status: 'cancelled', shop_name: 'Shop 3' }
          ]
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      const response = await request(app)
        .get('/api/admin/subscriptions')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThanOrEqual(3);
    });

    it('should allow admin to filter subscriptions by status', async () => {
      const mockDbQuery = jest.fn()
        .mockResolvedValue({
          rows: [
            { id: '1', status: 'paused', shop_name: 'Shop 1' },
            { id: '2', status: 'paused', shop_name: 'Shop 2' }
          ]
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      const response = await request(app)
        .get('/api/admin/subscriptions?status=paused')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.every((sub: any) => sub.status === 'paused')).toBe(true);
    });

    it('should allow admin to view subscription history and audit trail', async () => {
      const mockDbQuery = jest.fn()
        .mockResolvedValue({
          rows: [
            {
              id: subscriptionId,
              action: 'paused',
              performed_by: adminId,
              timestamp: new Date(),
              reason: 'Payment issue'
            },
            {
              id: subscriptionId,
              action: 'resumed',
              performed_by: adminId,
              timestamp: new Date(),
              reason: 'Payment resolved'
            }
          ]
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      const response = await request(app)
        .get(`/api/admin/subscriptions/${subscriptionId}/history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toHaveProperty('action');
      expect(response.body.data[0]).toHaveProperty('performed_by');
    });

    it('should allow admin to add notes to subscription', async () => {
      const note = 'Customer requested temporary pause due to renovation';
      const mockDbQuery = jest.fn()
        .mockResolvedValue({
          rows: [{
            id: subscriptionId,
            notes: note
          }],
          rowCount: 1
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      const response = await request(app)
        .post(`/api/admin/subscriptions/${subscriptionId}/notes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ note });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should allow admin to manually sync subscription with Stripe', async () => {
      const mockSubscriptionService = SubscriptionService as jest.MockedClass<typeof SubscriptionService>;
      mockSubscriptionService.prototype.syncSubscriptionFromStripe = jest.fn().mockResolvedValue({
        id: subscriptionId,
        stripeSubscriptionId,
        status: 'active'
      });

      const response = await request(app)
        .post(`/api/admin/subscriptions/${subscriptionId}/sync`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockSubscriptionService.prototype.syncSubscriptionFromStripe).toHaveBeenCalled();
    });

    it('should prevent non-admin users from accessing admin subscription routes', async () => {
      const response = await request(app)
        .get('/api/admin/subscriptions')
        .set('Authorization', `Bearer ${shopToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/forbidden|unauthorized|admin/i);
    });

    it('should allow admin to export subscription data', async () => {
      const mockDbQuery = jest.fn()
        .mockResolvedValue({
          rows: [
            { id: '1', shop_name: 'Shop 1', status: 'active', monthly_amount: 500 },
            { id: '2', shop_name: 'Shop 2', status: 'paused', monthly_amount: 500 }
          ]
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      const response = await request(app)
        .get('/api/admin/subscriptions/export')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ format: 'csv' });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/csv|application\/octet-stream/i);
    });
  });

  /**
   * Shop Self-Service Tests
   */
  describe('Shop Self-Service Subscription Management', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should allow shop to view their own subscription status', async () => {
      const mockSubscriptionService = SubscriptionService as jest.MockedClass<typeof SubscriptionService>;
      mockSubscriptionService.prototype.getActiveSubscription = jest.fn().mockResolvedValue({
        id: subscriptionId,
        stripeSubscriptionId,
        status: 'active',
        shopId,
        monthlyAmount: 500
      });

      const response = await request(app)
        .get('/api/shops/subscription/status')
        .set('Authorization', `Bearer ${shopToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.currentSubscription).toBeDefined();
      expect(response.body.data.hasActiveSubscription).toBe(true);
    });

    it('should allow shop to view their subscription history', async () => {
      const mockDbQuery = jest.fn()
        .mockResolvedValue({
          rows: [
            {
              id: subscriptionId,
              status: 'active',
              enrolled_at: new Date(),
              payments_made: 5,
              total_paid: 2500
            }
          ]
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      const response = await request(app)
        .get('/api/shops/subscription/history')
        .set('Authorization', `Bearer ${shopToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(response.body.data).toHaveProperty('paymentsMade');
    });

    it('should allow shop to update payment method', async () => {
      const newPaymentMethod = 'pm_new_test123';
      const mockSubscriptionService = SubscriptionService as jest.MockedClass<typeof SubscriptionService>;
      mockSubscriptionService.prototype.updatePaymentMethod = jest.fn().mockResolvedValue({
        success: true,
        message: 'Payment method updated'
      });

      const response = await request(app)
        .post('/api/shops/subscription/payment-method')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({ paymentMethodId: newPaymentMethod });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should allow shop to cancel their own subscription', async () => {
      const mockDbQuery = jest.fn()
        .mockResolvedValue({
          rows: [{
            id: subscriptionId,
            billing_reference: stripeSubscriptionId,
            status: 'active'
          }],
          rowCount: 1
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      const response = await request(app)
        .post('/api/shops/subscription/cancel')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({ reason: 'Business closing' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should not allow shop to view other shops subscriptions', async () => {
      const otherShopId = 'other-shop-id';
      const response = await request(app)
        .get(`/api/shops/${otherShopId}/subscription/status`)
        .set('Authorization', `Bearer ${shopToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/forbidden|unauthorized|access denied/i);
    });

    it('should show shop their billing invoices', async () => {
      const mockDbQuery = jest.fn()
        .mockResolvedValue({
          rows: [
            {
              id: 'inv_1',
              amount: 500,
              status: 'paid',
              date: new Date(),
              invoice_url: 'https://stripe.com/invoice/1'
            },
            {
              id: 'inv_2',
              amount: 500,
              status: 'paid',
              date: new Date(),
              invoice_url: 'https://stripe.com/invoice/2'
            }
          ]
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      const response = await request(app)
        .get('/api/shops/subscription/invoices')
        .set('Authorization', `Bearer ${shopToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toHaveProperty('invoice_url');
    });

    it('should notify shop when subscription is about to expire', async () => {
      const expiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      const notifications: any[] = [];
      
      const mockDbQuery = jest.fn()
        .mockImplementation((query, params) => {
          if (query.includes('notifications')) {
            notifications.push({ query, params });
          }
          return Promise.resolve({
            rows: [{
              id: subscriptionId,
              current_period_end: expiryDate,
              shop_id: shopId
            }],
            rowCount: 1
          });
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      // Simulate cron job checking for expiring subscriptions
      const response = await request(app)
        .post('/api/internal/subscriptions/check-expiring')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(notifications.length).toBeGreaterThan(0);
    });
  });

  /**
   * Customer Impact Tests
   */
  describe('Customer Experience During Subscription Changes', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should inform customer when shop subscription is paused', async () => {
      const mockSubscriptionService = SubscriptionService as jest.MockedClass<typeof SubscriptionService>;
      mockSubscriptionService.prototype.getActiveSubscription = jest.fn().mockResolvedValue({
        id: subscriptionId,
        status: 'paused',
        shopId
      });

      // Customer attempts to earn rewards at this shop
      const response = await request(app)
        .post(`/api/customers/check-shop-status/${shopId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.shopAvailable).toBe(false);
      expect(response.body.data.reason).toMatch(/subscription|temporarily unavailable/i);
    });

    it('should not affect customer existing balance when shop subscription changes', async () => {
      const initialBalance = 1000;
      const mockDbQuery = jest.fn()
        .mockResolvedValue({
          rows: [{ address: mockCustomer.address, balance: initialBalance }]
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      // Admin pauses shop subscription
      await request(app)
        .post(`/api/admin/subscriptions/${subscriptionId}/pause`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Check customer balance remains unchanged
      const balanceResponse = await request(app)
        .get('/api/customers/balance')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(balanceResponse.body.data.balance).toBe(initialBalance);
    });

    it('should allow customer to redeem tokens at other shops with active subscriptions', async () => {
      const activeShopId = 'active-shop';
      const mockSubscriptionService = SubscriptionService as jest.MockedClass<typeof SubscriptionService>;
      
      // Shop 1 is paused
      mockSubscriptionService.prototype.getActiveSubscription
        .mockResolvedValueOnce({
          id: subscriptionId,
          status: 'paused',
          shopId
        })
        // Shop 2 is active
        .mockResolvedValueOnce({
          id: 'sub-active',
          status: 'active',
          shopId: activeShopId
        });

      // Try at paused shop
      const pausedShopResponse = await request(app)
        .post(`/api/shops/${shopId}/redemption/start`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ amount: 50 });

      expect(pausedShopResponse.status).toBe(402);

      // Try at active shop
      const activeShopResponse = await request(app)
        .post(`/api/shops/${activeShopId}/redemption/start`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ amount: 50 });

      expect(activeShopResponse.status).toBe(200);
    });

    it('should preserve customer tier and history across shop subscription changes', async () => {
      const mockCustomerRepo = CustomerRepository as jest.MockedClass<typeof CustomerRepository>;
      mockCustomerRepo.prototype.getCustomerByAddress = jest.fn().mockResolvedValue({
        address: mockCustomer.address,
        tier: 'GOLD',
        lifetimeEarnings: 500,
        referralCount: 5
      });

      // Shop subscription changes
      await request(app)
        .post(`/api/admin/subscriptions/${subscriptionId}/pause`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Customer data should remain intact
      const customerResponse = await request(app)
        .get('/api/customers/profile')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(customerResponse.body.data.tier).toBe('GOLD');
      expect(customerResponse.body.data.lifetimeEarnings).toBe(500);
    });
  });

  /**
   * Notification and Communication Tests
   */
  describe('Subscription Notifications', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should send email to shop when admin pauses their subscription', async () => {
      const mockEmailService = EmailService as jest.MockedClass<typeof EmailService>;
      mockEmailService.prototype.sendEmail = jest.fn().mockResolvedValue({ success: true });

      const mockDbQuery = jest.fn()
        .mockResolvedValue({
          rows: [{
            id: subscriptionId,
            billing_reference: stripeSubscriptionId,
            shop_id: shopId,
            status: 'active'
          }],
          rowCount: 1
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      await request(app)
        .post(`/api/admin/subscriptions/${subscriptionId}/pause`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Payment issue investigation' });

      expect(mockEmailService.prototype.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: expect.stringContaining(mockShop.email),
          subject: expect.stringMatching(/subscription|paused/i)
        })
      );
    });

    it('should send email to shop when payment is about to fail', async () => {
      const mockEmailService = EmailService as jest.MockedClass<typeof EmailService>;
      mockEmailService.prototype.sendEmail = jest.fn().mockResolvedValue({ success: true });

      await request(app)
        .post('/api/webhooks/stripe')
        .send({
          type: 'invoice.payment_action_required',
          data: {
            object: {
              subscription: stripeSubscriptionId,
              customer_email: mockShop.email
            }
          }
        });

      expect(mockEmailService.prototype.sendEmail).toHaveBeenCalled();
    });

    it('should notify shop when subscription is successfully resumed', async () => {
      const mockEmailService = EmailService as jest.MockedClass<typeof EmailService>;
      mockEmailService.prototype.sendEmail = jest.fn().mockResolvedValue({ success: true });

      const mockDbQuery = jest.fn()
        .mockResolvedValue({
          rows: [{
            id: subscriptionId,
            billing_reference: stripeSubscriptionId,
            status: 'paused',
            shop_id: shopId
          }],
          rowCount: 1
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      await request(app)
        .post(`/api/admin/subscriptions/${subscriptionId}/resume`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(mockEmailService.prototype.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: expect.stringContaining(mockShop.email),
          subject: expect.stringMatching(/subscription|resumed|reactivated/i)
        })
      );
    });

    it('should create in-app notification for shop on subscription status change', async () => {
      const notifications: any[] = [];
      const mockDbQuery = jest.fn()
        .mockImplementation((query, params) => {
          if (query.includes('INSERT') && query.includes('notifications')) {
            notifications.push({ query, params });
          }
          return Promise.resolve({
            rows: [{
              id: subscriptionId,
              shop_id: shopId,
              status: 'paused'
            }],
            rowCount: 1
          });
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      await request(app)
        .post(`/api/admin/subscriptions/${subscriptionId}/pause`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications[0].params).toEqual(
        expect.arrayContaining([
          expect.stringContaining(shopId),
          expect.stringMatching(/subscription|paused/i)
        ])
      );
    });
  });

  /**
   * Subscription Lifecycle Tests
   */
  describe('Complete Subscription Lifecycle', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should handle complete lifecycle: create -> active -> pause -> resume -> cancel', async () => {
      const lifecycle = [];
      const mockDbQuery = jest.fn()
        .mockImplementation((query, params) => {
          if (query.includes('UPDATE') && query.includes('status')) {
            lifecycle.push(params);
          }
          return Promise.resolve({
            rows: [{
              id: subscriptionId,
              status: params?.[0] || 'active'
            }],
            rowCount: 1
          });
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      // Create (handled by Stripe webhook typically)
      await request(app)
        .post('/api/webhooks/stripe')
        .send({
          type: 'customer.subscription.created',
          data: { object: { id: stripeSubscriptionId, status: 'active' } }
        });

      // Pause
      await request(app)
        .post(`/api/admin/subscriptions/${subscriptionId}/pause`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Resume
      await request(app)
        .post(`/api/admin/subscriptions/${subscriptionId}/resume`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Cancel
      await request(app)
        .post(`/api/admin/subscriptions/${subscriptionId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ immediately: true });

      expect(lifecycle.length).toBeGreaterThan(0);
    });

    it('should maintain data integrity throughout lifecycle', async () => {
      const mockDbQuery = jest.fn()
        .mockResolvedValue({
          rows: [{
            id: subscriptionId,
            shop_id: shopId,
            enrolled_at: new Date(),
            payments_made: 3,
            total_paid: 1500
          }],
          rowCount: 1
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      // Verify data consistency at each stage
      const initialStatus = await request(app)
        .get(`/api/admin/subscriptions/${subscriptionId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(initialStatus.body.data.subscription).toHaveProperty('paymentsMade');
      expect(initialStatus.body.data.subscription).toHaveProperty('totalPaid');
    });
  });

  afterAll(async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
  });
});
