/**
 * End-to-end tests for "Send Message" button feature
 *
 * Tests the full flow:
 * 1. POST /api/messages/conversations/get-or-create (new endpoint)
 * 2. Integration with existing conversation system
 * 3. Edge cases and access control
 * 4. No regression on existing messaging endpoints
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import RepairCoinApp from '../../src/app';

// Mock external services
jest.mock('../../src/services/StripeService');
jest.mock('../../src/contracts/RCGTokenReader');
jest.mock('thirdweb');

// Mock the repositories used by auth middleware's validateUserInDatabase
const mockGetShop = jest.fn();
const mockGetCustomer = jest.fn();
jest.mock('../../src/repositories', () => {
  const actual = jest.requireActual('../../src/repositories') as any;
  return {
    ...actual,
    shopRepository: {
      ...actual.shopRepository,
      getShop: (...args: any[]) => mockGetShop(...args),
    },
    customerRepository: {
      ...actual.customerRepository,
      getCustomer: (...args: any[]) => mockGetCustomer(...args),
    },
  };
});

describe('Send Message Button - Get or Create Conversation', () => {
  let app: any;

  const adminAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f1234';

  // Test data
  const shopAddress = '0x1111111111111111111111111111111111111111';
  const shopId = 'test-shop-messaging';
  const customerAddress = '0x2222222222222222222222222222222222222222';
  const customer2Address = '0x3333333333333333333333333333333333333333';
  const otherShopId = 'other-shop-messaging';
  const otherShopAddress = '0x4444444444444444444444444444444444444444';

  // Token generators — use actual secret from env (set by setup.ts)
  const generateCustomerToken = (wallet: string) => {
    return jwt.sign(
      { address: wallet.toLowerCase(), role: 'customer' },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );
  };

  let shopToken: string;
  let otherShopToken: string;
  let customerToken: string;

  // Re-set mock implementations before each test (clearMocks: true in jest.config clears them)
  beforeEach(() => {
    mockGetShop.mockImplementation(async (sid: string) => {
      if ([shopId, otherShopId].includes(sid)) {
        return { shopId: sid, walletAddress: shopAddress, status: 'active' };
      }
      return null;
    });
    mockGetCustomer.mockImplementation(async (addr: string) => {
      return { address: addr.toLowerCase(), tier: 'BRONZE', isActive: true };
    });
  });

  beforeAll(async () => {
    process.env.ADMIN_ADDRESSES = adminAddress;
    process.env.NODE_ENV = 'test';
    process.env.FRONTEND_URL = 'http://localhost:3001';

    const repairCoinApp = new RepairCoinApp();
    await repairCoinApp.initialize();
    app = repairCoinApp.app;

    // Generate tokens with the actual JWT_SECRET (set by setup.ts)
    const secret = process.env.JWT_SECRET!;
    shopToken = jwt.sign(
      { address: shopAddress.toLowerCase(), role: 'shop', shopId },
      secret,
      { expiresIn: '1h' }
    );
    otherShopToken = jwt.sign(
      { address: otherShopAddress.toLowerCase(), role: 'shop', shopId: otherShopId },
      secret,
      { expiresIn: '1h' }
    );
    customerToken = jwt.sign(
      { address: customerAddress.toLowerCase(), role: 'customer' },
      secret,
      { expiresIn: '1h' }
    );
  });

  describe('POST /api/messages/conversations/get-or-create', () => {

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/messages/conversations/get-or-create')
        .send({ customerAddress });

      expect(res.status).toBe(401);
    });

    it('should reject customer role (shops only)', async () => {
      const res = await request(app)
        .post('/api/messages/conversations/get-or-create')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ customerAddress: shopAddress });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Only shops');
    });

    it('should require customerAddress in body', async () => {
      const res = await request(app)
        .post('/api/messages/conversations/get-or-create')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('customerAddress');
    });

    it('should create a new conversation when none exists', async () => {
      const res = await request(app)
        .post('/api/messages/conversations/get-or-create')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({ customerAddress });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.conversationId).toBeDefined();
      expect(res.body.data.conversationId).toMatch(/^conv_/);
      expect(res.body.data.customerAddress).toBe(customerAddress.toLowerCase());
      expect(res.body.data.shopId).toBe(shopId);
    });

    it('should return the same conversation on second call (idempotent)', async () => {
      // First call
      const res1 = await request(app)
        .post('/api/messages/conversations/get-or-create')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({ customerAddress });

      // Second call — same shop, same customer
      const res2 = await request(app)
        .post('/api/messages/conversations/get-or-create')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({ customerAddress });

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res1.body.data.conversationId).toBe(res2.body.data.conversationId);
    });

    it('should create separate conversations for different customers', async () => {
      const res1 = await request(app)
        .post('/api/messages/conversations/get-or-create')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({ customerAddress });

      const res2 = await request(app)
        .post('/api/messages/conversations/get-or-create')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({ customerAddress: customer2Address });

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res1.body.data.conversationId).not.toBe(res2.body.data.conversationId);
    });

    it('should create separate conversations for different shops (same customer)', async () => {
      const res1 = await request(app)
        .post('/api/messages/conversations/get-or-create')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({ customerAddress });

      const res2 = await request(app)
        .post('/api/messages/conversations/get-or-create')
        .set('Authorization', `Bearer ${otherShopToken}`)
        .send({ customerAddress });

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res1.body.data.conversationId).not.toBe(res2.body.data.conversationId);
    });

    it('should handle case-insensitive customer addresses', async () => {
      const res1 = await request(app)
        .post('/api/messages/conversations/get-or-create')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({ customerAddress: customerAddress.toLowerCase() });

      const res2 = await request(app)
        .post('/api/messages/conversations/get-or-create')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({ customerAddress: customerAddress.toUpperCase() });

      expect(res1.body.data.conversationId).toBe(res2.body.data.conversationId);
    });
  });

  describe('Integration with existing messaging endpoints', () => {

    it('created conversation should appear in GET /api/messages/conversations', async () => {
      // Create conversation via new endpoint
      const createRes = await request(app)
        .post('/api/messages/conversations/get-or-create')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({ customerAddress });

      const conversationId = createRes.body.data.conversationId;

      // List conversations for this shop
      const listRes = await request(app)
        .get('/api/messages/conversations')
        .set('Authorization', `Bearer ${shopToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.success).toBe(true);

      const conversations = listRes.body.data;
      const found = conversations.find((c: any) => c.conversationId === conversationId);
      expect(found).toBeDefined();
      expect(found.customerAddress).toBe(customerAddress.toLowerCase());
    });

    it('should be able to send a message in the created conversation', async () => {
      // Create conversation
      const createRes = await request(app)
        .post('/api/messages/conversations/get-or-create')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({ customerAddress });

      const conversationId = createRes.body.data.conversationId;

      // Send a message as shop
      const sendRes = await request(app)
        .post('/api/messages/send')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          conversationId,
          messageText: 'Hello! How can I help you?'
        });

      expect(sendRes.status).toBe(201);
      expect(sendRes.body.success).toBe(true);
      expect(sendRes.body.data.conversationId).toBe(conversationId);
      expect(sendRes.body.data.messageText).toBe('Hello! How can I help you?');
      expect(sendRes.body.data.senderType).toBe('shop');
    });

    it('customer should be able to reply in the conversation', async () => {
      // Create conversation via shop
      const createRes = await request(app)
        .post('/api/messages/conversations/get-or-create')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({ customerAddress });

      const conversationId = createRes.body.data.conversationId;

      // Customer sends a reply
      const sendRes = await request(app)
        .post('/api/messages/send')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          conversationId,
          messageText: 'Hi! I have a question about my booking.'
        });

      expect(sendRes.status).toBe(201);
      expect(sendRes.body.data.senderType).toBe('customer');
    });

    it('messages should be retrievable after sending', async () => {
      // Create conversation
      const createRes = await request(app)
        .post('/api/messages/conversations/get-or-create')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({ customerAddress: customer2Address });

      const conversationId = createRes.body.data.conversationId;

      // Send two messages
      await request(app)
        .post('/api/messages/send')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({ conversationId, messageText: 'Message 1 from shop' });

      const customer2Token = generateCustomerToken(customer2Address);
      await request(app)
        .post('/api/messages/send')
        .set('Authorization', `Bearer ${customer2Token}`)
        .send({ conversationId, messageText: 'Message 2 from customer' });

      // Retrieve messages
      const messagesRes = await request(app)
        .get(`/api/messages/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${shopToken}`);

      expect(messagesRes.status).toBe(200);
      expect(messagesRes.body.data.length).toBeGreaterThanOrEqual(2);

      const texts = messagesRes.body.data.map((m: any) => m.messageText);
      expect(texts).toContain('Message 1 from shop');
      expect(texts).toContain('Message 2 from customer');
    });

    it('mark as read should work on created conversation', async () => {
      // Create conversation and send a message
      const createRes = await request(app)
        .post('/api/messages/conversations/get-or-create')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({ customerAddress });

      const conversationId = createRes.body.data.conversationId;

      // Customer sends message (shop gets unread)
      await request(app)
        .post('/api/messages/send')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ conversationId, messageText: 'Please check this' });

      // Shop marks as read
      const readRes = await request(app)
        .post(`/api/messages/conversations/${conversationId}/read`)
        .set('Authorization', `Bearer ${shopToken}`);

      expect(readRes.status).toBe(200);
      expect(readRes.body.success).toBe(true);
    });
  });

  describe('No regression on existing send flow', () => {

    it('sendMessage with customerAddress+shopId should still work (original flow)', async () => {
      const newCustomer = '0x5555555555555555555555555555555555555555';

      // Original flow: send message with customerAddress+shopId (auto-creates conversation)
      const res = await request(app)
        .post('/api/messages/send')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          customerAddress: newCustomer,
          shopId,
          messageText: 'Welcome to our shop!'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.conversationId).toMatch(/^conv_/);
    });

    it('sendMessage with conversationId should still work', async () => {
      // First create conversation
      const createRes = await request(app)
        .post('/api/messages/conversations/get-or-create')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({ customerAddress });

      const conversationId = createRes.body.data.conversationId;

      // Then send using conversationId
      const res = await request(app)
        .post('/api/messages/send')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({ conversationId, messageText: 'Follow-up message' });

      expect(res.status).toBe(201);
      expect(res.body.data.conversationId).toBe(conversationId);
    });

    it('unread count endpoint should still work', async () => {
      const res = await request(app)
        .get('/api/messages/unread/count')
        .set('Authorization', `Bearer ${shopToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.count).toBe('number');
    });

    it('typing indicator endpoints should still work', async () => {
      const createRes = await request(app)
        .post('/api/messages/conversations/get-or-create')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({ customerAddress });

      const conversationId = createRes.body.data.conversationId;

      // Set typing
      const typingRes = await request(app)
        .post(`/api/messages/conversations/${conversationId}/typing`)
        .set('Authorization', `Bearer ${shopToken}`);

      expect(typingRes.status).toBe(200);

      // Get typing
      const getTypingRes = await request(app)
        .get(`/api/messages/conversations/${conversationId}/typing`)
        .set('Authorization', `Bearer ${shopToken}`);

      expect(getTypingRes.status).toBe(200);
    });
  });

  describe('Edge cases', () => {

    it('should reject invalid auth token', async () => {
      const res = await request(app)
        .post('/api/messages/conversations/get-or-create')
        .set('Authorization', 'Bearer invalid-token')
        .send({ customerAddress });

      expect(res.status).toBe(401);
    });

    it('should handle empty customerAddress gracefully', async () => {
      const res = await request(app)
        .post('/api/messages/conversations/get-or-create')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({ customerAddress: '' });

      expect(res.status).toBe(400);
    });

    it('should handle concurrent get-or-create calls gracefully', async () => {
      const newCustomer = '0x6666666666666666666666666666666666666666';

      // Fire 3 concurrent requests for the same customer
      const [res1, res2, res3] = await Promise.all([
        request(app)
          .post('/api/messages/conversations/get-or-create')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({ customerAddress: newCustomer }),
        request(app)
          .post('/api/messages/conversations/get-or-create')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({ customerAddress: newCustomer }),
        request(app)
          .post('/api/messages/conversations/get-or-create')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({ customerAddress: newCustomer }),
      ]);

      // All should succeed
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res3.status).toBe(200);

      // All should return the same conversation ID
      const ids = [
        res1.body.data.conversationId,
        res2.body.data.conversationId,
        res3.body.data.conversationId,
      ];
      expect(ids[0]).toBe(ids[1]);
      expect(ids[1]).toBe(ids[2]);
    });

    it('full user flow: get-or-create → send message → list → read → verify', async () => {
      const flowCustomer = '0x7777777777777777777777777777777777777777';
      const flowCustomerToken = generateCustomerToken(flowCustomer);

      // Step 1: Shop clicks "Send Message" on customer profile
      const createRes = await request(app)
        .post('/api/messages/conversations/get-or-create')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({ customerAddress: flowCustomer });

      expect(createRes.status).toBe(200);
      const conversationId = createRes.body.data.conversationId;

      // Step 2: Shop sends first message
      const sendRes = await request(app)
        .post('/api/messages/send')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({ conversationId, messageText: 'Hi there! Your repair is ready.' });

      expect(sendRes.status).toBe(201);

      // Step 3: Conversation appears in shop's list
      const shopListRes = await request(app)
        .get('/api/messages/conversations')
        .set('Authorization', `Bearer ${shopToken}`);

      const shopConvs = shopListRes.body.data;
      const shopConv = shopConvs.find((c: any) => c.conversationId === conversationId);
      expect(shopConv).toBeDefined();

      // Step 4: Conversation appears in customer's list too
      const custListRes = await request(app)
        .get('/api/messages/conversations')
        .set('Authorization', `Bearer ${flowCustomerToken}`);

      const custConvs = custListRes.body.data;
      const custConv = custConvs.find((c: any) => c.conversationId === conversationId);
      expect(custConv).toBeDefined();

      // Step 5: Customer replies
      const replyRes = await request(app)
        .post('/api/messages/send')
        .set('Authorization', `Bearer ${flowCustomerToken}`)
        .send({ conversationId, messageText: 'Great, I will pick it up today!' });

      expect(replyRes.status).toBe(201);

      // Step 6: Shop reads the conversation
      const readRes = await request(app)
        .post(`/api/messages/conversations/${conversationId}/read`)
        .set('Authorization', `Bearer ${shopToken}`);

      expect(readRes.status).toBe(200);

      // Step 7: Verify all messages in order
      const messagesRes = await request(app)
        .get(`/api/messages/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${shopToken}`);

      expect(messagesRes.status).toBe(200);
      const messages = messagesRes.body.data;
      expect(messages.length).toBeGreaterThanOrEqual(2);

      // Verify our messages exist (conversation may have messages from prior test runs)
      const shopMsg = messages.find((m: any) => m.messageText === 'Hi there! Your repair is ready.');
      const custMsg = messages.find((m: any) => m.messageText === 'Great, I will pick it up today!');
      expect(shopMsg).toBeDefined();
      expect(shopMsg.senderType).toBe('shop');
      expect(custMsg).toBeDefined();
      expect(custMsg.senderType).toBe('customer');
    });
  });
});
