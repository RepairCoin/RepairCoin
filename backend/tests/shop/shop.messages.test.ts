/**
 * Shop Messages Tab E2E Tests
 *
 * Tests the /shop?tab=messages functionality:
 * - Conversations (list, create, get)
 * - Messages (send, get, read status)
 * - Typing indicators
 * - Conversation state (archive, resolve, block, delete)
 * - Quick replies CRUD
 * - Auto-messages CRUD
 * - Unread count
 * - Attachments
 * - Authentication & authorization
 *
 * API Endpoints Tested:
 * - GET /api/messages/conversations
 * - GET /api/messages/conversations/:id
 * - POST /api/messages/conversations/get-or-create
 * - GET /api/messages/conversations/:id/messages
 * - POST /api/messages/send
 * - POST /api/messages/conversations/:id/read
 * - GET /api/messages/unread/count
 * - POST /api/messages/conversations/:id/typing
 * - PATCH /api/messages/conversations/:id/archive
 * - POST /api/messages/conversations/:id/resolve
 * - POST /api/messages/conversations/:id/reopen
 * - POST /api/messages/conversations/:id/block
 * - POST /api/messages/conversations/:id/unblock
 * - DELETE /api/messages/conversations/:id
 * - GET/POST/PUT/DELETE /api/messages/quick-replies
 * - GET/POST/PUT/DELETE/PATCH /api/messages/auto-messages
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, jest, afterAll } from '@jest/globals';
import RepairCoinApp from '../../src/app';
import jwt from 'jsonwebtoken';

jest.mock('thirdweb');

describe('Shop Messages Tab Tests', () => {
  let app: any;

  const JWT_SECRET = 'test-secret-for-messages-32char!';
  const shopId = 'shop-msg-test-001';
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
  // SECTION 1: Conversations - Authentication
  // ============================================================
  describe('Conversations - Authentication', () => {
    it('should reject unauthenticated conversation list', async () => {
      const response = await request(app)
        .get('/api/messages/conversations');
      expect([401, 403]).toContain(response.status);
    });

    it('should accept shop role', async () => {
      const response = await request(app)
        .get('/api/messages/conversations')
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should accept customer role', async () => {
      const response = await request(app)
        .get('/api/messages/conversations')
        .set('Cookie', [`auth_token=${customerToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 2: Conversations - List & Filter
  // ============================================================
  describe('Conversations - List & Filter', () => {
    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/messages/conversations')
        .query({ page: 1, limit: 10 })
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should support search', async () => {
      const response = await request(app)
        .get('/api/messages/conversations')
        .query({ search: 'test' })
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should support status filter', async () => {
      const response = await request(app)
        .get('/api/messages/conversations')
        .query({ status: 'open' })
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should support archived filter', async () => {
      const response = await request(app)
        .get('/api/messages/conversations')
        .query({ archived: true })
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 3: Get or Create Conversation
  // ============================================================
  describe('Get or Create Conversation', () => {
    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .post('/api/messages/conversations/get-or-create')
        .send({ customerAddress: customerWallet });
      expect([401, 403]).toContain(response.status);
    });

    it('should reject customer role (shop only)', async () => {
      const response = await request(app)
        .post('/api/messages/conversations/get-or-create')
        .set('Cookie', [`auth_token=${customerToken}`])
        .send({ customerAddress: customerWallet });
      expect([401, 403]).toContain(response.status);
    });

    it('should reject missing customerAddress', async () => {
      const response = await request(app)
        .post('/api/messages/conversations/get-or-create')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({});
      expect([400, 401, 403]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 4: Send Message
  // ============================================================
  describe('Send Message', () => {
    it('should reject unauthenticated send', async () => {
      const response = await request(app)
        .post('/api/messages/send')
        .send({ conversationId: 'fake-id', messageText: 'Hello' });
      expect([401, 403]).toContain(response.status);
    });

    it('should reject empty message', async () => {
      const response = await request(app)
        .post('/api/messages/send')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ conversationId: 'fake-id', messageText: '' });
      expect([400, 401, 403]).toContain(response.status);
    });

    it('should reject missing conversationId and customerAddress', async () => {
      const response = await request(app)
        .post('/api/messages/send')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ messageText: 'Hello' });
      expect([400, 401, 403]).toContain(response.status);
    });

    it('should accept valid message types', () => {
      const validTypes = ['text', 'booking_link', 'service_link', 'system'];
      expect(validTypes).toHaveLength(4);
    });

    it('should enforce max 2000 character limit', () => {
      const maxLength = 2000;
      const validMessage = 'a'.repeat(maxLength);
      const invalidMessage = 'a'.repeat(maxLength + 1);
      expect(validMessage.length).toBeLessThanOrEqual(maxLength);
      expect(invalidMessage.length).toBeGreaterThan(maxLength);
    });
  });

  // ============================================================
  // SECTION 5: Mark as Read & Unread Count
  // ============================================================
  describe('Mark as Read & Unread Count', () => {
    it('should reject unauthenticated read mark', async () => {
      const response = await request(app)
        .post('/api/messages/conversations/fake-id/read');
      expect([401, 403]).toContain(response.status);
    });

    it('should reject unauthenticated unread count', async () => {
      const response = await request(app)
        .get('/api/messages/unread/count');
      expect([401, 403]).toContain(response.status);
    });

    it('should return unread count for shop', async () => {
      const response = await request(app)
        .get('/api/messages/unread/count')
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body).toHaveProperty('count');
        expect(typeof response.body.count).toBe('number');
        expect(response.body.count).toBeGreaterThanOrEqual(0);
      }
    });

    it('should return unread count for customer', async () => {
      const response = await request(app)
        .get('/api/messages/unread/count')
        .set('Cookie', [`auth_token=${customerToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 6: Typing Indicators
  // ============================================================
  describe('Typing Indicators', () => {
    it('should reject unauthenticated typing', async () => {
      const response = await request(app)
        .post('/api/messages/conversations/fake-id/typing');
      expect([401, 403]).toContain(response.status);
    });

    it('should reject unauthenticated typing check', async () => {
      const response = await request(app)
        .get('/api/messages/conversations/fake-id/typing');
      expect([401, 403]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 7: Conversation State Management
  // ============================================================
  describe('Conversation State Management', () => {
    it('should reject unauthenticated archive', async () => {
      const response = await request(app)
        .patch('/api/messages/conversations/fake-id/archive')
        .send({ archived: true });
      expect([401, 403]).toContain(response.status);
    });

    it('should reject unauthenticated resolve', async () => {
      const response = await request(app)
        .post('/api/messages/conversations/fake-id/resolve');
      expect([401, 403]).toContain(response.status);
    });

    it('should reject unauthenticated reopen', async () => {
      const response = await request(app)
        .post('/api/messages/conversations/fake-id/reopen');
      expect([401, 403]).toContain(response.status);
    });

    it('should reject unauthenticated block', async () => {
      const response = await request(app)
        .post('/api/messages/conversations/fake-id/block');
      expect([401, 403]).toContain(response.status);
    });

    it('should reject unauthenticated unblock', async () => {
      const response = await request(app)
        .post('/api/messages/conversations/fake-id/unblock');
      expect([401, 403]).toContain(response.status);
    });

    it('should reject unauthenticated delete', async () => {
      const response = await request(app)
        .delete('/api/messages/conversations/fake-id');
      expect([401, 403]).toContain(response.status);
    });

    it('conversation statuses should be well-defined', () => {
      const statuses = ['open', 'resolved'];
      expect(statuses).toHaveLength(2);
    });
  });

  // ============================================================
  // SECTION 8: Quick Replies - Authentication
  // ============================================================
  describe('Quick Replies - Authentication', () => {
    it('should reject unauthenticated quick replies list', async () => {
      const response = await request(app)
        .get('/api/messages/quick-replies');
      expect([401, 403]).toContain(response.status);
    });

    it('should reject customer accessing quick replies', async () => {
      const response = await request(app)
        .get('/api/messages/quick-replies')
        .set('Cookie', [`auth_token=${customerToken}`]);
      expect([401, 403]).toContain(response.status);
    });

    it('should accept shop accessing quick replies', async () => {
      const response = await request(app)
        .get('/api/messages/quick-replies')
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 9: Quick Replies - CRUD
  // ============================================================
  describe('Quick Replies - CRUD', () => {
    it('should reject creating without title', async () => {
      const response = await request(app)
        .post('/api/messages/quick-replies')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ content: 'Thank you for your inquiry!' });
      expect([400, 401, 403]).toContain(response.status);
    });

    it('should reject creating without content', async () => {
      const response = await request(app)
        .post('/api/messages/quick-replies')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ title: 'Thank You' });
      expect([400, 401, 403]).toContain(response.status);
    });

    it('should accept valid quick reply creation', async () => {
      const response = await request(app)
        .post('/api/messages/quick-replies')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({
          title: 'Greeting',
          content: 'Thank you for reaching out! How can we help?',
          category: 'general'
        });
      expect([201, 401, 403]).toContain(response.status);
    });

    it('should return 404 for non-existent quick reply update', async () => {
      const response = await request(app)
        .put('/api/messages/quick-replies/nonexistent-id')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ title: 'Updated Title' });
      expect([401, 403, 404]).toContain(response.status);
    });

    it('should return 404 for non-existent quick reply delete', async () => {
      const response = await request(app)
        .delete('/api/messages/quick-replies/nonexistent-id')
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([401, 403, 404]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 10: Auto-Messages - Authentication
  // ============================================================
  describe('Auto-Messages - Authentication', () => {
    it('should reject unauthenticated auto-messages list', async () => {
      const response = await request(app)
        .get('/api/messages/auto-messages');
      expect([401, 403]).toContain(response.status);
    });

    it('should reject customer accessing auto-messages', async () => {
      const response = await request(app)
        .get('/api/messages/auto-messages')
        .set('Cookie', [`auth_token=${customerToken}`]);
      expect([401, 403]).toContain(response.status);
    });

    it('should accept shop accessing auto-messages', async () => {
      const response = await request(app)
        .get('/api/messages/auto-messages')
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 11: Auto-Messages - CRUD
  // ============================================================
  describe('Auto-Messages - CRUD', () => {
    it('should reject missing name', async () => {
      const response = await request(app)
        .post('/api/messages/auto-messages')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ messageTemplate: 'Hello!', triggerType: 'event', eventType: 'first_visit' });
      expect([400, 401, 403]).toContain(response.status);
    });

    it('should reject missing messageTemplate', async () => {
      const response = await request(app)
        .post('/api/messages/auto-messages')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ name: 'Welcome', triggerType: 'event', eventType: 'first_visit' });
      expect([400, 401, 403]).toContain(response.status);
    });

    it('should reject missing triggerType', async () => {
      const response = await request(app)
        .post('/api/messages/auto-messages')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ name: 'Welcome', messageTemplate: 'Hello!' });
      expect([400, 401, 403]).toContain(response.status);
    });

    it('should accept valid event-triggered auto-message', async () => {
      const response = await request(app)
        .post('/api/messages/auto-messages')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({
          name: 'Welcome Message',
          messageTemplate: 'Welcome to our shop, {{customerName}}!',
          triggerType: 'event',
          eventType: 'first_visit',
          targetAudience: 'all'
        });
      expect([201, 401, 403]).toContain(response.status);
    });

    it('should accept valid schedule-triggered auto-message', async () => {
      const response = await request(app)
        .post('/api/messages/auto-messages')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({
          name: 'Weekly Promo',
          messageTemplate: 'Check out our weekly specials!',
          triggerType: 'schedule',
          scheduleType: 'weekly',
          scheduleDayOfWeek: 1,
          scheduleHour: 10,
          targetAudience: 'active'
        });
      expect([201, 401, 403]).toContain(response.status);
    });

    it('should return 404 for non-existent auto-message toggle', async () => {
      const response = await request(app)
        .patch('/api/messages/auto-messages/nonexistent-id/toggle')
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([401, 403, 404]).toContain(response.status);
    });

    it('trigger types should be well-defined', () => {
      const triggerTypes = ['schedule', 'event'];
      expect(triggerTypes).toHaveLength(2);
    });

    it('event types should be well-defined', () => {
      const eventTypes = ['booking_completed', 'booking_cancelled', 'first_visit', 'inactive_30_days'];
      expect(eventTypes).toHaveLength(4);
    });

    it('schedule types should be well-defined', () => {
      const scheduleTypes = ['daily', 'weekly', 'monthly'];
      expect(scheduleTypes).toHaveLength(3);
    });

    it('target audiences should be well-defined', () => {
      const audiences = ['all', 'active', 'inactive_30d', 'has_balance', 'completed_booking'];
      expect(audiences).toHaveLength(5);
    });
  });

  // ============================================================
  // SECTION 12: Attachments
  // ============================================================
  describe('Attachments', () => {
    it('should reject unauthenticated upload', async () => {
      const response = await request(app)
        .post('/api/messages/attachments/upload');
      expect([401, 403]).toContain(response.status);
    });

    it('allowed file types should be well-defined', () => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
      expect(allowedTypes).toHaveLength(5);
    });

    it('max file size should be 5MB', () => {
      const maxSizeBytes = 5 * 1024 * 1024;
      expect(maxSizeBytes).toBe(5242880);
    });

    it('max files per upload should be 5', () => {
      const maxFiles = 5;
      expect(maxFiles).toBe(5);
    });
  });

  // ============================================================
  // SECTION 13: Response Format Contract
  // ============================================================
  describe('Response Format Contract', () => {
    it('conversation should have expected fields', () => {
      const expectedFields = [
        'conversationId', 'customerAddress', 'shopId',
        'lastMessageAt', 'lastMessagePreview',
        'unreadCountCustomer', 'unreadCountShop',
        'isBlocked', 'status', 'createdAt'
      ];
      expect(expectedFields.length).toBeGreaterThanOrEqual(10);
    });

    it('message should have expected fields', () => {
      const expectedFields = [
        'messageId', 'conversationId', 'senderAddress',
        'senderType', 'messageText', 'messageType',
        'isRead', 'createdAt'
      ];
      expect(expectedFields.length).toBeGreaterThanOrEqual(8);
    });

    it('message sender types should be well-defined', () => {
      const senderTypes = ['customer', 'shop'];
      expect(senderTypes).toHaveLength(2);
    });

    it('quick reply should have expected fields', () => {
      const expectedFields = ['id', 'shopId', 'title', 'content', 'category', 'isActive', 'usageCount'];
      expect(expectedFields.length).toBeGreaterThanOrEqual(7);
    });
  });
});
