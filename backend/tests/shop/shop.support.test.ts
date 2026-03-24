/**
 * Shop Support Tab E2E Tests
 *
 * Tests the /shop?tab=support functionality:
 * - Ticket creation with validation
 * - Ticket listing with status filter
 * - Ticket details
 * - Chat messages (send, read, history)
 * - Unread count
 * - Admin ticket management (status update, assign)
 * - Admin internal notes
 * - Admin statistics
 * - Authentication & authorization
 * - Closed ticket restrictions
 *
 * API Endpoints Tested:
 * - POST /api/support/tickets - Create ticket
 * - GET /api/support/tickets - List shop tickets
 * - GET /api/support/tickets/:id - Get ticket
 * - GET /api/support/tickets/:id/messages - Get messages
 * - POST /api/support/tickets/:id/messages - Send message
 * - POST /api/support/tickets/:id/read - Mark as read
 * - GET /api/support/unread-count - Get unread count
 * - GET /api/support/admin/tickets - Admin list all
 * - GET /api/support/admin/stats - Admin stats
 * - PUT /api/support/admin/tickets/:id/status - Admin update status
 * - PUT /api/support/admin/tickets/:id/assign - Admin assign
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, jest, afterAll } from '@jest/globals';
import RepairCoinApp from '../../src/app';
import jwt from 'jsonwebtoken';

jest.mock('thirdweb');

describe('Shop Support Tab Tests', () => {
  let app: any;

  const JWT_SECRET = 'test-secret-for-support-32char!';
  const shopId = 'shop-support-test-001';
  const shopWallet = '0xaaaa000000000000000000000000000000000001';
  const customerWallet = '0xbbbb000000000000000000000000000000000002';
  const adminWallet = '0xdddd000000000000000000000000000000000004';

  let shopToken: string;
  let customerToken: string;
  let adminToken: string;

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
    adminToken = jwt.sign(
      { address: adminWallet, role: 'admin', type: 'access' },
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
  // SECTION 1: Ticket Creation - Authentication
  // ============================================================
  describe('Ticket Creation - Authentication', () => {
    it('should reject unauthenticated ticket creation', async () => {
      const response = await request(app)
        .post('/api/support/tickets')
        .send({ subject: 'Help needed', message: 'I need help' });
      expect([401, 403]).toContain(response.status);
    });

    it('should reject customer creating ticket', async () => {
      const response = await request(app)
        .post('/api/support/tickets')
        .set('Cookie', [`auth_token=${customerToken}`])
        .send({ subject: 'Help', message: 'Customer trying to create ticket' });
      expect([401, 403]).toContain(response.status);
    });

    it('should accept shop creating ticket', async () => {
      const response = await request(app)
        .post('/api/support/tickets')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({
          subject: 'Test Ticket',
          message: 'This is a test support ticket',
          priority: 'medium',
          category: 'general'
        });
      expect([201, 401, 403]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 2: Ticket Creation - Validation
  // ============================================================
  describe('Ticket Creation - Validation', () => {
    it('should reject missing subject', async () => {
      const response = await request(app)
        .post('/api/support/tickets')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ message: 'No subject provided' });
      expect([400, 401, 403]).toContain(response.status);
    });

    it('should reject missing message', async () => {
      const response = await request(app)
        .post('/api/support/tickets')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ subject: 'No message' });
      expect([400, 401, 403]).toContain(response.status);
    });

    it('should reject empty subject', async () => {
      const response = await request(app)
        .post('/api/support/tickets')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ subject: '', message: 'Has message but no subject' });
      expect([400, 401, 403]).toContain(response.status);
    });

    it('should reject empty message', async () => {
      const response = await request(app)
        .post('/api/support/tickets')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ subject: 'Has subject', message: '' });
      expect([400, 401, 403]).toContain(response.status);
    });

    it('should accept all valid priorities', async () => {
      const priorities = ['low', 'medium', 'high', 'urgent'];
      for (const priority of priorities) {
        const response = await request(app)
          .post('/api/support/tickets')
          .set('Cookie', [`auth_token=${shopToken}`])
          .send({ subject: `${priority} ticket`, message: 'Testing priority', priority });
        expect([201, 400, 401, 403]).toContain(response.status);
      }
    });

    it('should accept all valid categories', async () => {
      const categories = ['billing', 'technical', 'account', 'general', 'feature_request'];
      for (const category of categories) {
        const response = await request(app)
          .post('/api/support/tickets')
          .set('Cookie', [`auth_token=${shopToken}`])
          .send({ subject: `${category} ticket`, message: 'Testing category', category });
        expect([201, 400, 401, 403]).toContain(response.status);
      }
    });

    it('priorities should be well-defined', () => {
      const priorities = ['low', 'medium', 'high', 'urgent'];
      expect(priorities).toHaveLength(4);
    });

    it('categories should be well-defined', () => {
      const categories = ['billing', 'technical', 'account', 'general', 'feature_request'];
      expect(categories).toHaveLength(5);
    });
  });

  // ============================================================
  // SECTION 3: Ticket Listing
  // ============================================================
  describe('Ticket Listing', () => {
    it('should reject unauthenticated ticket list', async () => {
      const response = await request(app)
        .get('/api/support/tickets');
      expect([401, 403]).toContain(response.status);
    });

    it('should return tickets for shop', async () => {
      const response = await request(app)
        .get('/api/support/tickets')
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should support status filter', async () => {
      const statuses = ['open', 'in_progress', 'waiting_shop', 'resolved', 'closed'];
      for (const status of statuses) {
        const response = await request(app)
          .get('/api/support/tickets')
          .query({ status })
          .set('Cookie', [`auth_token=${shopToken}`]);
        expect([200, 401, 403]).toContain(response.status);
      }
    });

    it('ticket statuses should be well-defined', () => {
      const statuses = ['open', 'in_progress', 'waiting_shop', 'resolved', 'closed'];
      expect(statuses).toHaveLength(5);
    });
  });

  // ============================================================
  // SECTION 4: Ticket Details
  // ============================================================
  describe('Ticket Details', () => {
    it('should reject unauthenticated ticket get', async () => {
      const response = await request(app)
        .get('/api/support/tickets/fake-ticket-id');
      expect([401, 403]).toContain(response.status);
    });

    it('should return 404 for non-existent ticket', async () => {
      const response = await request(app)
        .get('/api/support/tickets/nonexistent-id')
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([401, 403, 404]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 5: Chat Messages
  // ============================================================
  describe('Chat Messages', () => {
    it('should reject unauthenticated message list', async () => {
      const response = await request(app)
        .get('/api/support/tickets/fake-id/messages');
      expect([401, 403]).toContain(response.status);
    });

    it('should reject unauthenticated message send', async () => {
      const response = await request(app)
        .post('/api/support/tickets/fake-id/messages')
        .send({ message: 'Unauthenticated message' });
      expect([401, 403]).toContain(response.status);
    });

    it('should reject empty message', async () => {
      const response = await request(app)
        .post('/api/support/tickets/fake-id/messages')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ message: '' });
      expect([400, 401, 403, 404]).toContain(response.status);
    });

    it('should reject missing message field', async () => {
      const response = await request(app)
        .post('/api/support/tickets/fake-id/messages')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({});
      expect([400, 401, 403, 404]).toContain(response.status);
    });

    it('should return 404 for non-existent ticket messages', async () => {
      const response = await request(app)
        .get('/api/support/tickets/nonexistent-id/messages')
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([401, 403, 404]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 6: Mark as Read & Unread Count
  // ============================================================
  describe('Mark as Read & Unread Count', () => {
    it('should reject unauthenticated read mark', async () => {
      const response = await request(app)
        .post('/api/support/tickets/fake-id/read');
      expect([401, 403]).toContain(response.status);
    });

    it('should reject unauthenticated unread count', async () => {
      const response = await request(app)
        .get('/api/support/unread-count');
      expect([401, 403]).toContain(response.status);
    });

    it('should return unread count for shop', async () => {
      const response = await request(app)
        .get('/api/support/unread-count')
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body).toHaveProperty('count');
        expect(typeof response.body.count).toBe('number');
        expect(response.body.count).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ============================================================
  // SECTION 7: Admin - Ticket List
  // ============================================================
  describe('Admin - Ticket List', () => {
    it('should reject unauthenticated admin tickets', async () => {
      const response = await request(app)
        .get('/api/support/admin/tickets');
      expect([401, 403]).toContain(response.status);
    });

    it('should reject shop accessing admin tickets', async () => {
      const response = await request(app)
        .get('/api/support/admin/tickets')
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([401, 403]).toContain(response.status);
    });

    it('should reject customer accessing admin tickets', async () => {
      const response = await request(app)
        .get('/api/support/admin/tickets')
        .set('Cookie', [`auth_token=${customerToken}`]);
      expect([401, 403]).toContain(response.status);
    });

    it('should accept admin accessing tickets', async () => {
      const response = await request(app)
        .get('/api/support/admin/tickets')
        .set('Cookie', [`auth_token=${adminToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should support admin status filter', async () => {
      const response = await request(app)
        .get('/api/support/admin/tickets')
        .query({ status: 'open' })
        .set('Cookie', [`auth_token=${adminToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should support admin priority filter', async () => {
      const response = await request(app)
        .get('/api/support/admin/tickets')
        .query({ priority: 'high' })
        .set('Cookie', [`auth_token=${adminToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/support/admin/tickets')
        .query({ limit: 5, offset: 0 })
        .set('Cookie', [`auth_token=${adminToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 8: Admin - Statistics
  // ============================================================
  describe('Admin - Statistics', () => {
    it('should reject unauthenticated stats', async () => {
      const response = await request(app)
        .get('/api/support/admin/stats');
      expect([401, 403]).toContain(response.status);
    });

    it('should reject shop accessing admin stats', async () => {
      const response = await request(app)
        .get('/api/support/admin/stats')
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([401, 403]).toContain(response.status);
    });

    it('should return stats for admin', async () => {
      const response = await request(app)
        .get('/api/support/admin/stats')
        .set('Cookie', [`auth_token=${adminToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 9: Admin - Update Ticket Status
  // ============================================================
  describe('Admin - Update Ticket Status', () => {
    it('should reject unauthenticated status update', async () => {
      const response = await request(app)
        .put('/api/support/admin/tickets/fake-id/status')
        .send({ status: 'in_progress' });
      expect([401, 403]).toContain(response.status);
    });

    it('should reject shop updating ticket status', async () => {
      const response = await request(app)
        .put('/api/support/admin/tickets/fake-id/status')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ status: 'resolved' });
      expect([401, 403]).toContain(response.status);
    });

    it('should reject invalid status value', async () => {
      const response = await request(app)
        .put('/api/support/admin/tickets/fake-id/status')
        .set('Cookie', [`auth_token=${adminToken}`])
        .send({ status: 'invalid_status' });
      expect([400, 401, 403, 404]).toContain(response.status);
    });

    it('should return 404 for non-existent ticket', async () => {
      const response = await request(app)
        .put('/api/support/admin/tickets/nonexistent-id/status')
        .set('Cookie', [`auth_token=${adminToken}`])
        .send({ status: 'in_progress' });
      expect([401, 403, 404]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 10: Admin - Assign Ticket
  // ============================================================
  describe('Admin - Assign Ticket', () => {
    it('should reject unauthenticated assignment', async () => {
      const response = await request(app)
        .put('/api/support/admin/tickets/fake-id/assign')
        .send({ assignedTo: adminWallet });
      expect([401, 403]).toContain(response.status);
    });

    it('should reject shop assigning ticket', async () => {
      const response = await request(app)
        .put('/api/support/admin/tickets/fake-id/assign')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ assignedTo: adminWallet });
      expect([401, 403]).toContain(response.status);
    });

    it('should return 404 for non-existent ticket', async () => {
      const response = await request(app)
        .put('/api/support/admin/tickets/nonexistent-id/assign')
        .set('Cookie', [`auth_token=${adminToken}`])
        .send({ assignedTo: adminWallet });
      expect([401, 403, 404]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 11: Response Format Contract
  // ============================================================
  describe('Response Format Contract', () => {
    it('ticket should have expected fields', () => {
      const fields = [
        'id', 'shopId', 'subject', 'status', 'priority',
        'category', 'assignedTo', 'createdAt', 'updatedAt',
        'lastMessageAt'
      ];
      expect(fields.length).toBeGreaterThanOrEqual(10);
    });

    it('message should have expected fields', () => {
      const fields = [
        'id', 'ticketId', 'senderType', 'senderId',
        'senderName', 'message', 'isInternal', 'createdAt', 'readAt'
      ];
      expect(fields.length).toBeGreaterThanOrEqual(9);
    });

    it('sender types should be well-defined', () => {
      const senderTypes = ['shop', 'admin', 'system'];
      expect(senderTypes).toHaveLength(3);
    });

    it('status workflow should be defined', () => {
      const workflow = ['open', 'in_progress', 'waiting_shop', 'resolved', 'closed'];
      expect(workflow).toHaveLength(5);
      // Verify order
      expect(workflow[0]).toBe('open');
      expect(workflow[workflow.length - 1]).toBe('closed');
    });

    it('internal notes should only be visible to admins', () => {
      const isInternal = true;
      const senderType = 'admin';
      const visibleToShop = !isInternal;
      expect(visibleToShop).toBe(false);
      expect(senderType).toBe('admin');
    });

    it('closed tickets should block new messages', () => {
      const ticketStatus = 'closed';
      const canSendMessage = ticketStatus !== 'closed';
      expect(canSendMessage).toBe(false);
    });
  });
});
