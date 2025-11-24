import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import RepairCoinApp from '../../src/app';
import { ShopRepository } from '../../src/repositories/ShopRepository';
import { SubscriptionService } from '../../src/services/SubscriptionService';
import { WebhookService } from '../../src/domains/webhook/services/WebhookService';
import { DatabaseService } from '../../src/services/DatabaseService';
import crypto from 'crypto';

jest.mock('../../src/repositories/ShopRepository');
jest.mock('../../src/services/SubscriptionService');
jest.mock('../../src/domains/webhook/services/WebhookService');

/**
 * Subscription Negative Tests
 * Tests various failure scenarios and security concerns
 */
describe('Subscription Negative Tests', () => {
  let app: any;
  let adminToken: string;
  let shopToken: string;
  const adminId = 'test-admin';
  const shopId = 'test-shop-paused';
  const subscriptionId = 'test-subscription-id';
  const stripeSubscriptionId = 'sub_test123';

  const mockShop = {
    shop_id: shopId,
    name: 'Test Shop',
    email: 'shop@example.com',
    wallet_address: '0x1234567890123456789012345678901234567890',
    is_verified: true,
    is_active: true
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.NODE_ENV = 'test';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
    
    const repairCoinApp = new RepairCoinApp();
    await repairCoinApp.initialize();
    app = repairCoinApp.app;

    // Mock admin authentication
    const adminAuthResponse = await request(app)
      .post('/api/auth/admin')
      .send({ email: 'admin@repaircoin.com', password: 'admin123' });
    adminToken = adminAuthResponse.body.token;

    // Mock shop authentication
    const shopAuthResponse = await request(app)
      .post('/api/auth/shop')
      .send({ shopId, walletAddress: mockShop.wallet_address });
    shopToken = shopAuthResponse.body.token;
  });

  /**
   * TC-NEG-001: Shop Self-Resume Paused Subscription
   * Priority: High
   */
  describe('TC-NEG-001: Shop Self-Resume Paused Subscription', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should not provide resume option in shop UI', async () => {
      const mockSubscriptionService = SubscriptionService as jest.MockedClass<typeof SubscriptionService>;
      mockSubscriptionService.prototype.getActiveSubscription = jest.fn().mockResolvedValue({
        id: subscriptionId,
        stripeSubscriptionId,
        status: 'paused',
        shopId
      });

      const response = await request(app)
        .get('/api/shops/subscription/status')
        .set('Authorization', `Bearer ${shopToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.currentSubscription.status).toBe('paused');
      
      // Shop endpoint should not expose resume capability
      expect(response.body.data.canResume).toBeUndefined();
    });

    it('should return 403 Forbidden when shop attempts to resume via API', async () => {
      const mockDbQuery = jest.fn().mockResolvedValue({
        rows: [{
          id: subscriptionId,
          billing_reference: stripeSubscriptionId,
          shop_id: shopId,
          status: 'paused'
        }]
      });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      // Shop attempts to resume their own subscription
      const response = await request(app)
        .post(`/api/shops/${shopId}/subscription/resume`)
        .set('Authorization', `Bearer ${shopToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/only admins|forbidden|not authorized/i);
    });

    it('should display appropriate error message', async () => {
      const response = await request(app)
        .post(`/api/shops/${shopId}/subscription/resume`)
        .set('Authorization', `Bearer ${shopToken}`);

      expect(response.body.error).toBe('Only admins can resume paused subscriptions');
    });

    it('should keep status as paused after unauthorized attempt', async () => {
      const mockDbQuery = jest.fn().mockResolvedValue({
        rows: [{
          id: subscriptionId,
          billing_reference: stripeSubscriptionId,
          shop_id: shopId,
          status: 'paused',
          paused_at: new Date().toISOString()
        }]
      });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      // Attempt unauthorized resume
      await request(app)
        .post(`/api/shops/${shopId}/subscription/resume`)
        .set('Authorization', `Bearer ${shopToken}`);

      // Verify status remains paused
      const statusResponse = await request(app)
        .get('/api/shops/subscription/status')
        .set('Authorization', `Bearer ${shopToken}`);

      expect(statusResponse.body.data.currentSubscription.status).toBe('paused');
    });

    it('should log unauthorized access attempt', async () => {
      const securityLogs: any[] = [];
      const mockDbQuery = jest.fn()
        .mockImplementation((query, params) => {
          if (query.includes('INSERT') && query.includes('security_log')) {
            securityLogs.push({ query, params });
          }
          return Promise.resolve({
            rows: [{
              id: subscriptionId,
              status: 'paused'
            }],
            rowCount: 1
          });
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      await request(app)
        .post(`/api/shops/${shopId}/subscription/resume`)
        .set('Authorization', `Bearer ${shopToken}`);

      // Verify security log was created
      expect(securityLogs.length).toBeGreaterThan(0);
    });
  });

  /**
   * TC-NEG-002: Invalid Stripe Webhook Signature
   * Priority: High
   */
  describe('TC-NEG-002: Invalid Stripe Webhook Signature', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should reject webhook with invalid signature', async () => {
      const payload = JSON.stringify({
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            subscription: stripeSubscriptionId
          }
        }
      });

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'invalid_signature')
        .send(payload);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should not make any database changes on invalid signature', async () => {
      const mockDbQuery = jest.fn();
      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      const payload = JSON.stringify({
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: stripeSubscriptionId
          }
        }
      });

      await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'invalid_signature')
        .send(payload);

      // Verify no database queries were made
      expect(mockDbQuery).not.toHaveBeenCalled();
    });

    it('should create security log entry for invalid signature', async () => {
      const securityLogs: any[] = [];
      const mockDbQuery = jest.fn()
        .mockImplementation((query) => {
          if (query.includes('security_log') || query.includes('webhook_log')) {
            securityLogs.push(query);
          }
          return Promise.resolve({ rows: [], rowCount: 0 });
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      const payload = JSON.stringify({
        type: 'invoice.payment_succeeded',
        data: { object: { subscription: stripeSubscriptionId } }
      });

      await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'invalid_signature')
        .send(payload);

      expect(securityLogs.length).toBeGreaterThan(0);
    });

    it('should return HTTP 401 response', async () => {
      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'invalid_signature')
        .send({
          type: 'customer.subscription.updated',
          data: { object: { id: stripeSubscriptionId } }
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/signature|verification/i);
    });
  });

  /**
   * TC-NEG-003: Expired Payment Method
   * Priority: Medium
   */
  describe('TC-NEG-003: Expired Payment Method', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should mark subscription as overdue when payment fails', async () => {
      const mockDbQuery = jest.fn()
        .mockResolvedValueOnce({
          rows: [{
            id: subscriptionId,
            stripe_subscription_id: stripeSubscriptionId,
            shop_id: shopId,
            status: 'active'
          }]
        })
        .mockResolvedValueOnce({
          rowCount: 1
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      // Simulate payment failure webhook
      const response = await request(app)
        .post('/api/webhooks/stripe')
        .send({
          type: 'invoice.payment_failed',
          data: {
            object: {
              subscription: stripeSubscriptionId,
              payment_intent: {
                last_payment_error: {
                  code: 'card_declined',
                  message: 'Your card has expired'
                }
              }
            }
          }
        });

      expect(response.status).toBe(200);

      // Verify status updated to overdue
      const updateCall = mockDbQuery.mock.calls.find(call => 
        call[0]?.includes('UPDATE') && 
        (call[1]?.includes('past_due') || call[1]?.includes('overdue'))
      );
      expect(updateCall).toBeDefined();
    });

    it('should send notification to shop owner', async () => {
      const notifications: any[] = [];
      const mockDbQuery = jest.fn()
        .mockImplementation((query, params) => {
          if (query.includes('INSERT') && query.includes('notifications')) {
            notifications.push({ query, params });
          }
          return Promise.resolve({
            rows: [{
              id: subscriptionId,
              stripe_subscription_id: stripeSubscriptionId,
              shop_id: shopId
            }],
            rowCount: 1
          });
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      // Simulate expired card payment failure
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

    it('should apply grace period if configured', async () => {
      const mockDbQuery = jest.fn()
        .mockResolvedValue({
          rows: [{
            id: subscriptionId,
            stripe_subscription_id: stripeSubscriptionId,
            shop_id: shopId,
            status: 'past_due',
            grace_period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          }],
          rowCount: 1
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      // Payment failed, but grace period should be active
      const statusResponse = await request(app)
        .get('/api/shops/subscription/status')
        .set('Authorization', `Bearer ${shopToken}`);

      expect(statusResponse.body.data.currentSubscription.gracePeriodEnd).toBeDefined();
      expect(new Date(statusResponse.body.data.currentSubscription.gracePeriodEnd))
        .toBeInstanceOf(Date);
    });

    it('should restrict features after grace period expires', async () => {
      const mockSubscriptionService = SubscriptionService as jest.MockedClass<typeof SubscriptionService>;
      mockSubscriptionService.prototype.getActiveSubscription = jest.fn().mockResolvedValue({
        id: subscriptionId,
        stripeSubscriptionId,
        status: 'past_due',
        shopId,
        gracePeriodEnd: new Date(Date.now() - 1000).toISOString() // Expired
      });

      // Attempt to issue rewards after grace period
      const response = await request(app)
        .post(`/api/shops/${shopId}/issue-reward`)
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          customerAddress: '0x1234567890123456789012345678901234567890',
          repairAmount: 100
        });

      expect(response.status).toBe(402);
      expect(response.body.error).toMatch(/subscription|payment|expired/i);
    });
  });

  /**
   * TC-NEG-004: Database Connection Lost During Status Change
   * Priority: Medium
   */
  describe('TC-NEG-004: Database Connection Lost During Status Change', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should rollback transaction on database failure', async () => {
      let rollbackCalled = false;
      const mockDbQuery = jest.fn()
        .mockImplementationOnce(() => Promise.resolve({ rows: [{ id: subscriptionId }] })) // SELECT
        .mockImplementationOnce(() => Promise.resolve({ rows: [] })) // BEGIN
        .mockImplementationOnce(() => Promise.reject(new Error('Database connection lost'))) // UPDATE
        .mockImplementationOnce(() => {
          rollbackCalled = true;
          return Promise.resolve({ rows: [] });
        }); // ROLLBACK

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      const response = await request(app)
        .post(`/api/admin/subscriptions/${subscriptionId}/pause`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(500);
      expect(rollbackCalled).toBe(true);
    });

    it('should display error message to admin', async () => {
      const mockDbQuery = jest.fn()
        .mockImplementationOnce(() => Promise.resolve({ rows: [{ id: subscriptionId }] }))
        .mockImplementationOnce(() => Promise.reject(new Error('Connection timeout')));

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      const response = await request(app)
        .post(`/api/admin/subscriptions/${subscriptionId}/pause`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/database|connection|failed/i);
    });

    it('should leave status unchanged on failure', async () => {
      const originalStatus = 'active';
      const mockDbQuery = jest.fn()
        .mockResolvedValueOnce({
          rows: [{
            id: subscriptionId,
            billing_reference: stripeSubscriptionId,
            shop_id: shopId,
            status: originalStatus
          }]
        })
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce({
          rows: [{
            id: subscriptionId,
            status: originalStatus // Status unchanged
          }]
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      // Attempt to pause
      await request(app)
        .post(`/api/admin/subscriptions/${subscriptionId}/pause`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Verify status remains unchanged
      const statusResponse = await request(app)
        .get(`/api/admin/subscriptions/${subscriptionId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(statusResponse.body.data.subscription.status).toBe(originalStatus);
    });

    it('should not create partial updates', async () => {
      const updates: any[] = [];
      const mockDbQuery = jest.fn()
        .mockImplementation((query, params) => {
          if (query.includes('UPDATE')) {
            updates.push({ query, params });
            throw new Error('Connection lost during update');
          }
          return Promise.resolve({ rows: [{ id: subscriptionId, status: 'active' }] });
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      await request(app)
        .post(`/api/admin/subscriptions/${subscriptionId}/pause`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Verify only one update attempt was made before rollback
      expect(updates.length).toBe(1);
    });

    it('should recover gracefully and allow retry', async () => {
      let attemptCount = 0;
      const mockDbQuery = jest.fn()
        .mockImplementation(() => {
          attemptCount++;
          if (attemptCount === 1) {
            return Promise.reject(new Error('Database timeout'));
          }
          return Promise.resolve({
            rows: [{
              id: subscriptionId,
              billing_reference: stripeSubscriptionId,
              status: 'active'
            }],
            rowCount: 1
          });
        });

      const db = DatabaseService.getInstance();
      jest.spyOn(db, 'query').mockImplementation(mockDbQuery);

      // First attempt fails
      const firstResponse = await request(app)
        .post(`/api/admin/subscriptions/${subscriptionId}/pause`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(firstResponse.status).toBe(500);

      // Second attempt succeeds
      const secondResponse = await request(app)
        .post(`/api/admin/subscriptions/${subscriptionId}/pause`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(secondResponse.status).toBe(200);
      expect(secondResponse.body.success).toBe(true);
    });
  });

  afterAll(async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
  });
});
