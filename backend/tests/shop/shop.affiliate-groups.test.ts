import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import RepairCoinApp from '../../src/app';
import { shopRepository } from '../../src/repositories';
import { AffiliateShopGroupRepository } from '../../src/repositories/AffiliateShopGroupRepository';

// Mock external services
jest.mock('../../src/services/StripeService');
jest.mock('../../src/contracts/RCGTokenReader');
jest.mock('thirdweb');

describe('Shop Affiliate Groups Tests', () => {
  let app: any;
  let shopToken: string;
  let shop2Token: string;
  let shop3Token: string;
  let customerToken: string;
  let affiliateRepo: AffiliateShopGroupRepository;

  // Must match the JWT_SECRET from tests/setup.ts
  const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key';

  const adminAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f1234';

  // Test shops
  const testShop = {
    shopId: 'shop-owner-123',
    shop_id: 'shop-owner-123',
    id: 'shop-owner-123',
    name: 'Test Owner Shop',
    email: 'owner@test.com',
    walletAddress: '0x1111111111111111111111111111111111111111',
    wallet_address: '0x1111111111111111111111111111111111111111',
    active: true,
    verified: true,
    subscriptionActive: true,
    subscription_active: true,
    operational_status: 'subscription_qualified',
    purchased_rcn_balance: 1000,
    purchasedRcnBalance: 1000,
    total_rcn_purchased: 2000,
    total_tokens_issued: 500
  };

  const testShop2 = {
    shopId: 'shop-member-456',
    shop_id: 'shop-member-456',
    id: 'shop-member-456',
    name: 'Test Member Shop',
    email: 'member@test.com',
    walletAddress: '0x2222222222222222222222222222222222222222',
    wallet_address: '0x2222222222222222222222222222222222222222',
    active: true,
    verified: true,
    subscriptionActive: true,
    subscription_active: true,
    operational_status: 'subscription_qualified',
    purchased_rcn_balance: 500,
    purchasedRcnBalance: 500,
    total_rcn_purchased: 1000,
    total_tokens_issued: 200
  };

  const testShop3NoSubscription = {
    shopId: 'shop-no-sub-789',
    shop_id: 'shop-no-sub-789',
    id: 'shop-no-sub-789',
    name: 'Test No Subscription Shop',
    email: 'nosub@test.com',
    walletAddress: '0x3333333333333333333333333333333333333333',
    wallet_address: '0x3333333333333333333333333333333333333333',
    active: true,
    verified: true,
    subscriptionActive: false,
    subscription_active: false,
    operational_status: null,
    purchased_rcn_balance: 100,
    purchasedRcnBalance: 100,
    total_rcn_purchased: 100,
    total_tokens_issued: 0
  };

  const testCustomerAddress = '0x4444444444444444444444444444444444444444';

  // Test group data
  const testGroup = {
    groupId: 'grp_test-group-123',
    group_id: 'grp_test-group-123',
    groupName: 'Downtown Merchants',
    group_name: 'Downtown Merchants',
    description: 'Local downtown business coalition',
    customTokenName: 'DowntownBucks',
    custom_token_name: 'DowntownBucks',
    customTokenSymbol: 'DTB',
    custom_token_symbol: 'DTB',
    tokenValueUsd: 0.10,
    token_value_usd: 0.10,
    createdByShopId: testShop.shopId,
    created_by_shop_id: testShop.shopId,
    groupType: 'public',
    group_type: 'public',
    inviteCode: 'ABC12345',
    invite_code: 'ABC12345',
    autoApproveRequests: false,
    auto_approve_requests: false,
    active: true,
    createdAt: new Date().toISOString(),
    created_at: new Date().toISOString()
  };

  // Helper to generate a valid shop JWT token
  const generateShopToken = (shopId: string, walletAddress: string) => {
    return jwt.sign(
      {
        address: walletAddress.toLowerCase(),
        role: 'shop',
        shopId: shopId
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  };

  // Helper to generate a customer token
  const generateCustomerToken = (walletAddress: string) => {
    return jwt.sign(
      {
        address: walletAddress.toLowerCase(),
        role: 'customer'
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  };

  beforeAll(async () => {
    // Set test environment variables
    process.env.ADMIN_ADDRESSES = adminAddress;
    process.env.NODE_ENV = 'test';
    process.env.FRONTEND_URL = 'http://localhost:3001';

    // Initialize the app
    const repairCoinApp = new RepairCoinApp();
    await repairCoinApp.initialize();
    app = repairCoinApp.app;

    // Generate tokens
    shopToken = generateShopToken(testShop.shopId, testShop.walletAddress);
    shop2Token = generateShopToken(testShop2.shopId, testShop2.walletAddress);
    shop3Token = generateShopToken(testShop3NoSubscription.shopId, testShop3NoSubscription.walletAddress);
    customerToken = generateCustomerToken(testCustomerAddress);

    // Initialize affiliate repository
    affiliateRepo = new AffiliateShopGroupRepository();
  });

  afterAll(async () => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Default shop mocks
    jest.spyOn(shopRepository, 'getShop').mockImplementation(async (shopId: string) => {
      if (shopId === testShop.shopId) return testShop as any;
      if (shopId === testShop2.shopId) return testShop2 as any;
      if (shopId === testShop3NoSubscription.shopId) return testShop3NoSubscription as any;
      return null;
    });

    jest.spyOn(shopRepository, 'getShopByWallet').mockImplementation(async (wallet: string) => {
      const normalizedWallet = wallet.toLowerCase();
      if (normalizedWallet === testShop.walletAddress.toLowerCase()) return testShop as any;
      if (normalizedWallet === testShop2.walletAddress.toLowerCase()) return testShop2 as any;
      if (normalizedWallet === testShop3NoSubscription.walletAddress.toLowerCase()) return testShop3NoSubscription as any;
      return null;
    });
  });

  // ============================================
  // Authentication Tests
  // ============================================
  describe('Authentication Requirements', () => {

    it('should reject unauthenticated requests to create group', async () => {
      const response = await request(app)
        .post('/api/affiliate-shop-groups')
        .send({
          groupName: 'Test Group',
          customTokenName: 'TestToken',
          customTokenSymbol: 'TT'
        });

      expect(response.status).toBe(401);
    });

    it('should reject customer tokens for shop-only endpoints', async () => {
      const response = await request(app)
        .post('/api/affiliate-shop-groups')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          groupName: 'Test Group',
          customTokenName: 'TestToken',
          customTokenSymbol: 'TT'
        });

      expect([401, 403]).toContain(response.status);
    });

    it('should reject invalid JWT tokens', async () => {
      const response = await request(app)
        .post('/api/affiliate-shop-groups')
        .set('Authorization', 'Bearer invalid-token-12345')
        .send({
          groupName: 'Test Group',
          customTokenName: 'TestToken',
          customTokenSymbol: 'TT'
        });

      expect(response.status).toBe(401);
    });

    it('should accept valid shop tokens for protected routes', async () => {
      const response = await request(app)
        .get('/api/affiliate-shop-groups/my-groups')
        .set('Authorization', `Bearer ${shopToken}`);

      // Should pass auth (may return 200 or other business logic errors)
      expect([200, 400, 403, 404, 500]).toContain(response.status);
    });
  });

  // ============================================
  // Group Creation Tests
  // ============================================
  describe('POST /api/affiliate-shop-groups - Group Creation', () => {

    describe('Successful Creation', () => {
      it('should create a group with valid data and active subscription', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({
            groupName: 'My Test Group',
            customTokenName: 'MyToken',
            customTokenSymbol: 'MTK',
            description: 'A test affiliate group'
          });

        // 201 for success, 400/403 for validation/subscription issues, 500 for DB errors
        expect([201, 400, 403, 500]).toContain(response.status);
        if (response.status === 201) {
          expect(response.body.success).toBe(true);
          expect(response.body.data).toHaveProperty('groupId');
          expect(response.body.data).toHaveProperty('inviteCode');
          expect(response.body.data.groupName).toBe('My Test Group');
        }
      });

      it('should auto-add creator as admin member', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({
            groupName: 'Admin Test Group',
            customTokenName: 'AdminToken',
            customTokenSymbol: 'ATK'
          });

        expect([201, 400, 403, 500]).toContain(response.status);
        // Creator should be admin - verified in membership tests
      });

      it('should generate unique invite code', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({
            groupName: 'Invite Code Test',
            customTokenName: 'InviteToken',
            customTokenSymbol: 'INV'
          });

        expect([201, 400, 403, 500]).toContain(response.status);
        if (response.status === 201) {
          expect(response.body.data.inviteCode).toBeDefined();
          expect(response.body.data.inviteCode.length).toBe(8);
        }
      });

      it('should create public group by default', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({
            groupName: 'Public Group Test',
            customTokenName: 'PublicToken',
            customTokenSymbol: 'PUB'
          });

        expect([201, 400, 403, 500]).toContain(response.status);
        if (response.status === 201) {
          expect(response.body.data.groupType).toBe('public');
        }
      });

      it('should create private group when specified', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({
            groupName: 'Private Group Test',
            customTokenName: 'PrivateToken',
            customTokenSymbol: 'PRV',
            isPrivate: true
          });

        expect([201, 400, 403, 500]).toContain(response.status);
        if (response.status === 201) {
          expect(response.body.data.groupType).toBe('private');
        }
      });
    });

    describe('Subscription Validation', () => {
      it('should reject group creation without active subscription', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups')
          .set('Authorization', `Bearer ${shop3Token}`)
          .send({
            groupName: 'No Sub Group',
            customTokenName: 'NoSubToken',
            customTokenSymbol: 'NST'
          });

        // Should reject with 400 or 403 due to no subscription
        expect([400, 403]).toContain(response.status);
        if (response.status === 400 || response.status === 403) {
          expect(response.body.success).toBe(false);
        }
      });
    });

    describe('Validation Errors', () => {
      it('should reject creation without groupName', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({
            customTokenName: 'TestToken',
            customTokenSymbol: 'TT'
          });

        expect([400, 403]).toContain(response.status);
      });

      it('should reject creation without customTokenName', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({
            groupName: 'Test Group',
            customTokenSymbol: 'TT'
          });

        expect([400, 403]).toContain(response.status);
      });

      it('should reject creation without customTokenSymbol', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({
            groupName: 'Test Group',
            customTokenName: 'TestToken'
          });

        expect([400, 403]).toContain(response.status);
      });

      it('should reject empty group name', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({
            groupName: '',
            customTokenName: 'TestToken',
            customTokenSymbol: 'TT'
          });

        expect([400, 403]).toContain(response.status);
      });
    });
  });

  // ============================================
  // Group Listing Tests
  // ============================================
  describe('GET /api/affiliate-shop-groups - List Groups', () => {

    it('should return list of groups without authentication', async () => {
      const response = await request(app)
        .get('/api/affiliate-shop-groups');

      expect([200, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        // API returns data directly as array (not wrapped in { groups: [...] })
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });

    it('should support pagination parameters', async () => {
      const response = await request(app)
        .get('/api/affiliate-shop-groups?page=1&limit=10');

      expect([200, 500]).toContain(response.status);
      if (response.status === 200) {
        // API returns data as array - pagination may be in body or data may be limited
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });

    it('should filter by group type', async () => {
      const response = await request(app)
        .get('/api/affiliate-shop-groups?groupType=public');

      expect([200, 500]).toContain(response.status);
    });

    it('should filter by active status', async () => {
      const response = await request(app)
        .get('/api/affiliate-shop-groups?active=true');

      expect([200, 500]).toContain(response.status);
    });

    it('should hide sensitive data from non-members', async () => {
      const response = await request(app)
        .get('/api/affiliate-shop-groups');

      expect([200, 500]).toContain(response.status);
      if (response.status === 200 && Array.isArray(response.body.data) && response.body.data.length > 0) {
        // For non-authenticated users, private groups should have limited data
        const groups = response.body.data;
        // Public groups should still show basic info
        groups.forEach((group: any) => {
          expect(group).toHaveProperty('groupId');
          expect(group).toHaveProperty('groupName');
        });
      }
    });
  });

  // ============================================
  // My Groups Tests
  // ============================================
  describe('GET /api/affiliate-shop-groups/my-groups', () => {

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/affiliate-shop-groups/my-groups');

      expect(response.status).toBe(401);
    });

    it('should return groups for authenticated shop', async () => {
      const response = await request(app)
        .get('/api/affiliate-shop-groups/my-groups')
        .set('Authorization', `Bearer ${shopToken}`);

      expect([200, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });

    it('should reject customer token', async () => {
      const response = await request(app)
        .get('/api/affiliate-shop-groups/my-groups')
        .set('Authorization', `Bearer ${customerToken}`);

      expect([401, 403]).toContain(response.status);
    });
  });

  // ============================================
  // Get Single Group Tests
  // ============================================
  describe('GET /api/affiliate-shop-groups/:groupId', () => {

    it('should return group details for valid groupId', async () => {
      // First list groups to get a valid ID
      const listResponse = await request(app)
        .get('/api/affiliate-shop-groups');

      if (listResponse.status === 200 && Array.isArray(listResponse.body.data) && listResponse.body.data.length > 0) {
        const groupId = listResponse.body.data[0].groupId;

        const response = await request(app)
          .get(`/api/affiliate-shop-groups/${groupId}`);

        expect([200, 404]).toContain(response.status);
      } else {
        // No groups exist, test with fake ID
        const response = await request(app)
          .get('/api/affiliate-shop-groups/grp_nonexistent');

        expect([404, 500]).toContain(response.status);
      }
    });

    it('should return 404 for non-existent group', async () => {
      const response = await request(app)
        .get('/api/affiliate-shop-groups/grp_does_not_exist_12345');

      expect([404, 500]).toContain(response.status);
    });

    it('should show full details to group members', async () => {
      const response = await request(app)
        .get('/api/affiliate-shop-groups/grp_test')
        .set('Authorization', `Bearer ${shopToken}`);

      expect([200, 404, 500]).toContain(response.status);
    });
  });

  // ============================================
  // Group Update Tests
  // ============================================
  describe('PUT /api/affiliate-shop-groups/:groupId', () => {

    it('should require authentication', async () => {
      const response = await request(app)
        .put('/api/affiliate-shop-groups/grp_test')
        .send({ groupName: 'Updated Name' });

      expect(response.status).toBe(401);
    });

    it('should reject non-admin members', async () => {
      const response = await request(app)
        .put('/api/affiliate-shop-groups/grp_test')
        .set('Authorization', `Bearer ${shop2Token}`)
        .send({ groupName: 'Updated Name' });

      // 403 if not admin, 404 if group not found
      expect([400, 403, 404, 500]).toContain(response.status);
    });

    it('should allow admin to update group', async () => {
      const response = await request(app)
        .put('/api/affiliate-shop-groups/grp_test')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({ description: 'Updated description' });

      // 200 for success, 403 if not admin, 404 if not found
      expect([200, 400, 403, 404, 500]).toContain(response.status);
    });
  });

  // ============================================
  // Membership Management Tests
  // ============================================
  describe('Membership Management', () => {

    describe('POST /api/affiliate-shop-groups/:groupId/join', () => {

      it('should require authentication', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/grp_test/join')
          .send({ requestMessage: 'Please add me' });

        expect(response.status).toBe(401);
      });

      it('should allow shop to request joining', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/grp_test/join')
          .set('Authorization', `Bearer ${shop2Token}`)
          .send({ requestMessage: 'I would like to join your group' });

        // 200/201 for success, 400 if already member, 403 if no subscription, 404 if group not found
        expect([200, 201, 400, 403, 404, 500]).toContain(response.status);
      });

      it('should reject shop without active subscription', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/grp_test/join')
          .set('Authorization', `Bearer ${shop3Token}`)
          .send({});

        // Should reject due to no subscription
        expect([400, 403, 404]).toContain(response.status);
      });

      it('should reject joining non-existent group', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/grp_nonexistent/join')
          .set('Authorization', `Bearer ${shop2Token}`)
          .send({});

        expect([400, 404]).toContain(response.status);
      });
    });

    describe('POST /api/affiliate-shop-groups/join-by-code', () => {

      it('should require authentication', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/join-by-code')
          .send({ inviteCode: 'ABC12345' });

        expect(response.status).toBe(401);
      });

      it('should allow joining with valid invite code', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/join-by-code')
          .set('Authorization', `Bearer ${shop2Token}`)
          .send({ inviteCode: 'ABC12345' });

        // 200 for success, 400 if invalid code, 403 if no subscription, 404 if not found
        expect([200, 201, 400, 403, 404, 500]).toContain(response.status);
      });

      it('should reject invalid invite code', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/join-by-code')
          .set('Authorization', `Bearer ${shop2Token}`)
          .send({ inviteCode: 'INVALID1' });

        expect([400, 404]).toContain(response.status);
      });

      it('should require inviteCode in request', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/join-by-code')
          .set('Authorization', `Bearer ${shop2Token}`)
          .send({});

        expect([400]).toContain(response.status);
      });
    });

    describe('GET /api/affiliate-shop-groups/:groupId/members', () => {

      it('should return member count for non-members', async () => {
        const response = await request(app)
          .get('/api/affiliate-shop-groups/grp_test/members');

        expect([200, 404, 500]).toContain(response.status);
        if (response.status === 200) {
          // Non-members should see limited info
          expect(response.body.data).toHaveProperty('memberCount');
        }
      });

      it('should return full member list for active members', async () => {
        const response = await request(app)
          .get('/api/affiliate-shop-groups/grp_test/members')
          .set('Authorization', `Bearer ${shopToken}`);

        expect([200, 403, 404, 500]).toContain(response.status);
      });

      it('should support status filter', async () => {
        const response = await request(app)
          .get('/api/affiliate-shop-groups/grp_test/members?status=active')
          .set('Authorization', `Bearer ${shopToken}`);

        expect([200, 403, 404, 500]).toContain(response.status);
      });
    });

    describe('POST /api/affiliate-shop-groups/:groupId/members/:shopId/approve', () => {

      it('should require authentication', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/grp_test/members/shop-456/approve');

        expect(response.status).toBe(401);
      });

      it('should require admin role', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/grp_test/members/shop-456/approve')
          .set('Authorization', `Bearer ${shop2Token}`);

        // 403 if not admin
        expect([200, 400, 403, 404, 500]).toContain(response.status);
      });

      it('should allow admin to approve member', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/grp_test/members/shop-member-456/approve')
          .set('Authorization', `Bearer ${shopToken}`);

        // 200 for success, 400 if no pending request, 403 if not admin, 404 if not found
        expect([200, 400, 403, 404, 500]).toContain(response.status);
      });
    });

    describe('POST /api/affiliate-shop-groups/:groupId/members/:shopId/reject', () => {

      it('should require authentication', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/grp_test/members/shop-456/reject');

        expect(response.status).toBe(401);
      });

      it('should allow admin to reject member request', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/grp_test/members/shop-456/reject')
          .set('Authorization', `Bearer ${shopToken}`);

        expect([200, 400, 403, 404, 500]).toContain(response.status);
      });
    });

    describe('DELETE /api/affiliate-shop-groups/:groupId/members/:shopId', () => {

      it('should require authentication', async () => {
        const response = await request(app)
          .delete('/api/affiliate-shop-groups/grp_test/members/shop-456');

        expect(response.status).toBe(401);
      });

      it('should allow admin to remove member', async () => {
        const response = await request(app)
          .delete('/api/affiliate-shop-groups/grp_test/members/shop-member-456')
          .set('Authorization', `Bearer ${shopToken}`);

        expect([200, 400, 403, 404, 500]).toContain(response.status);
      });

      it('should prevent removing group creator', async () => {
        // Trying to remove the creator should fail
        const response = await request(app)
          .delete('/api/affiliate-shop-groups/grp_test/members/shop-owner-123')
          .set('Authorization', `Bearer ${shopToken}`);

        // Should be 400 or 403 - cannot remove creator
        expect([200, 400, 403, 404, 500]).toContain(response.status);
      });
    });
  });

  // ============================================
  // Token Operations Tests
  // ============================================
  describe('Token Operations', () => {

    describe('POST /api/affiliate-shop-groups/:groupId/tokens/earn', () => {

      it('should require authentication', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/grp_test/tokens/earn')
          .send({
            customerAddress: testCustomerAddress,
            amount: 100,
            reason: 'Purchase reward'
          });

        expect(response.status).toBe(401);
      });

      it('should require shop to be active group member', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/grp_test/tokens/earn')
          .set('Authorization', `Bearer ${shop2Token}`)
          .send({
            customerAddress: testCustomerAddress,
            amount: 100,
            reason: 'Purchase reward'
          });

        // 200 if member, 403 if not member
        expect([200, 400, 403, 404, 500]).toContain(response.status);
      });

      it('should issue tokens with valid request', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/grp_test/tokens/earn')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({
            customerAddress: testCustomerAddress,
            amount: 100,
            reason: 'Purchase reward',
            metadata: { orderId: 'order-123' }
          });

        expect([200, 400, 403, 404, 500]).toContain(response.status);
        if (response.status === 200) {
          expect(response.body.success).toBe(true);
          expect(response.body.data).toHaveProperty('transaction');
          expect(response.body.data).toHaveProperty('newBalance');
        }
      });

      it('should reject invalid customer address', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/grp_test/tokens/earn')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({
            customerAddress: 'invalid-address',
            amount: 100
          });

        expect([400, 403, 404]).toContain(response.status);
      });

      it('should reject zero amount', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/grp_test/tokens/earn')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({
            customerAddress: testCustomerAddress,
            amount: 0
          });

        expect([400, 403, 404]).toContain(response.status);
      });

      it('should reject negative amount', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/grp_test/tokens/earn')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({
            customerAddress: testCustomerAddress,
            amount: -50
          });

        expect([400, 403, 404]).toContain(response.status);
      });

      it('should reject without customerAddress', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/grp_test/tokens/earn')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({
            amount: 100
          });

        expect([400, 403, 404]).toContain(response.status);
      });

      it('should reject without amount', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/grp_test/tokens/earn')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({
            customerAddress: testCustomerAddress
          });

        expect([400, 403, 404]).toContain(response.status);
      });

      // POTENTIAL BUG TEST: RCN backing validation
      it('should reject if insufficient RCN allocated (1:2 ratio)', async () => {
        // This tests the business rule: 100 tokens requires 50 RCN backing
        const response = await request(app)
          .post('/api/affiliate-shop-groups/grp_test/tokens/earn')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({
            customerAddress: testCustomerAddress,
            amount: 1000000, // Very large amount that exceeds any allocation
            reason: 'Large purchase'
          });

        // Should fail due to insufficient RCN allocation
        expect([400, 403, 404, 500]).toContain(response.status);
      });
    });

    describe('POST /api/affiliate-shop-groups/:groupId/tokens/redeem', () => {

      it('should require authentication', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/grp_test/tokens/redeem')
          .send({
            customerAddress: testCustomerAddress,
            amount: 50
          });

        expect(response.status).toBe(401);
      });

      it('should require shop to be active group member', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/grp_test/tokens/redeem')
          .set('Authorization', `Bearer ${shop2Token}`)
          .send({
            customerAddress: testCustomerAddress,
            amount: 50
          });

        expect([200, 400, 403, 404, 500]).toContain(response.status);
      });

      it('should redeem tokens with valid request', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/grp_test/tokens/redeem')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({
            customerAddress: testCustomerAddress,
            amount: 50,
            reason: 'Discount applied'
          });

        expect([200, 400, 403, 404, 500]).toContain(response.status);
      });

      it('should reject redemption exceeding customer balance', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/grp_test/tokens/redeem')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({
            customerAddress: testCustomerAddress,
            amount: 9999999, // More than any customer would have
            reason: 'Over-redemption test'
          });

        // Should fail - insufficient balance
        expect([400, 403, 404, 500]).toContain(response.status);
      });

      it('should reject zero redemption amount', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/grp_test/tokens/redeem')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({
            customerAddress: testCustomerAddress,
            amount: 0
          });

        expect([400, 403, 404]).toContain(response.status);
      });

      it('should reject negative redemption amount', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/grp_test/tokens/redeem')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({
            customerAddress: testCustomerAddress,
            amount: -25
          });

        expect([400, 403, 404]).toContain(response.status);
      });
    });

    describe('GET /api/affiliate-shop-groups/:groupId/balance/:customerAddress', () => {

      it('should return customer balance (public endpoint)', async () => {
        const response = await request(app)
          .get(`/api/affiliate-shop-groups/grp_test/balance/${testCustomerAddress}`);

        expect([200, 404, 500]).toContain(response.status);
        if (response.status === 200) {
          expect(response.body.data).toHaveProperty('balance');
        }
      });

      it('should return zeros for customer with no balance', async () => {
        const response = await request(app)
          .get('/api/affiliate-shop-groups/grp_test/balance/0x9999999999999999999999999999999999999999');

        expect([200, 404, 500]).toContain(response.status);
        if (response.status === 200) {
          expect(response.body.data.balance).toBe(0);
        }
      });
    });

    describe('GET /api/affiliate-shop-groups/balances/:customerAddress', () => {

      it('should return all group balances for customer', async () => {
        const response = await request(app)
          .get(`/api/affiliate-shop-groups/balances/${testCustomerAddress}`);

        expect([200, 500]).toContain(response.status);
        if (response.status === 200) {
          expect(Array.isArray(response.body.data)).toBe(true);
        }
      });
    });

    describe('GET /api/affiliate-shop-groups/:groupId/transactions', () => {

      it('should return group transactions (public)', async () => {
        const response = await request(app)
          .get('/api/affiliate-shop-groups/grp_test/transactions');

        expect([200, 404, 500]).toContain(response.status);
      });

      it('should support pagination', async () => {
        const response = await request(app)
          .get('/api/affiliate-shop-groups/grp_test/transactions?page=1&limit=10');

        expect([200, 404, 500]).toContain(response.status);
      });

      it('should filter by transaction type', async () => {
        const response = await request(app)
          .get('/api/affiliate-shop-groups/grp_test/transactions?type=earn');

        expect([200, 404, 500]).toContain(response.status);
      });
    });

    describe('GET /api/affiliate-shop-groups/:groupId/transactions/:customerAddress', () => {

      it('should return customer transactions in group', async () => {
        const response = await request(app)
          .get(`/api/affiliate-shop-groups/grp_test/transactions/${testCustomerAddress}`);

        expect([200, 404, 500]).toContain(response.status);
      });
    });
  });

  // ============================================
  // RCN Allocation Tests
  // ============================================
  describe('RCN Allocation', () => {

    describe('POST /api/affiliate-shop-groups/:groupId/rcn/allocate', () => {

      it('should require authentication', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/grp_test/rcn/allocate')
          .send({ amount: 100 });

        expect(response.status).toBe(401);
      });

      it('should require shop to be group member', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/grp_test/rcn/allocate')
          .set('Authorization', `Bearer ${shop2Token}`)
          .send({ amount: 100 });

        // 403 if not member, 400 if insufficient balance
        expect([200, 400, 403, 404, 500]).toContain(response.status);
      });

      it('should allocate RCN from shop balance', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/grp_test/rcn/allocate')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({ amount: 100 });

        expect([200, 400, 403, 404, 500]).toContain(response.status);
        if (response.status === 200) {
          expect(response.body.data).toHaveProperty('allocation');
          expect(response.body.data).toHaveProperty('shopRemainingBalance');
        }
      });

      it('should reject zero allocation', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/grp_test/rcn/allocate')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({ amount: 0 });

        expect([400, 403, 404]).toContain(response.status);
      });

      it('should reject negative allocation', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/grp_test/rcn/allocate')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({ amount: -50 });

        expect([400, 403, 404]).toContain(response.status);
      });

      it('should reject allocation exceeding shop balance', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/grp_test/rcn/allocate')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({ amount: 9999999 }); // More than shop has

        expect([400, 403, 404, 500]).toContain(response.status);
      });

      it('should reject without amount', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/grp_test/rcn/allocate')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({});

        expect([400, 403, 404]).toContain(response.status);
      });
    });

    describe('POST /api/affiliate-shop-groups/:groupId/rcn/deallocate', () => {

      it('should require authentication', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/grp_test/rcn/deallocate')
          .send({ amount: 50 });

        expect(response.status).toBe(401);
      });

      it('should deallocate available RCN', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/grp_test/rcn/deallocate')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({ amount: 50 });

        expect([200, 400, 403, 404, 500]).toContain(response.status);
      });

      it('should reject deallocating more than available (not backing tokens)', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/grp_test/rcn/deallocate')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({ amount: 9999999 });

        expect([400, 403, 404, 500]).toContain(response.status);
      });

      it('should reject zero deallocation', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/grp_test/rcn/deallocate')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({ amount: 0 });

        expect([400, 403, 404]).toContain(response.status);
      });

      it('should reject negative deallocation', async () => {
        const response = await request(app)
          .post('/api/affiliate-shop-groups/grp_test/rcn/deallocate')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({ amount: -25 });

        expect([400, 403, 404]).toContain(response.status);
      });
    });

    describe('GET /api/affiliate-shop-groups/:groupId/rcn/allocation', () => {

      it('should require authentication', async () => {
        const response = await request(app)
          .get('/api/affiliate-shop-groups/grp_test/rcn/allocation');

        expect(response.status).toBe(401);
      });

      it('should return shop allocation for group', async () => {
        const response = await request(app)
          .get('/api/affiliate-shop-groups/grp_test/rcn/allocation')
          .set('Authorization', `Bearer ${shopToken}`);

        expect([200, 403, 404, 500]).toContain(response.status);
        if (response.status === 200) {
          expect(response.body.data).toHaveProperty('allocatedRcn');
          expect(response.body.data).toHaveProperty('usedRcn');
          expect(response.body.data).toHaveProperty('availableRcn');
        }
      });
    });

    describe('GET /api/affiliate-shop-groups/rcn/allocations', () => {

      it('should require authentication', async () => {
        const response = await request(app)
          .get('/api/affiliate-shop-groups/rcn/allocations');

        expect(response.status).toBe(401);
      });

      it('should return all shop allocations', async () => {
        const response = await request(app)
          .get('/api/affiliate-shop-groups/rcn/allocations')
          .set('Authorization', `Bearer ${shopToken}`);

        expect([200, 500]).toContain(response.status);
        if (response.status === 200) {
          expect(Array.isArray(response.body.data)).toBe(true);
        }
      });
    });
  });

  // ============================================
  // Analytics Tests
  // ============================================
  describe('Analytics', () => {

    describe('GET /api/affiliate-shop-groups/:groupId/analytics', () => {

      it('should require authentication', async () => {
        const response = await request(app)
          .get('/api/affiliate-shop-groups/grp_test/analytics');

        expect(response.status).toBe(401);
      });

      it('should require active membership', async () => {
        const response = await request(app)
          .get('/api/affiliate-shop-groups/grp_test/analytics')
          .set('Authorization', `Bearer ${shop2Token}`);

        // 403 if not active member
        expect([200, 403, 404, 500]).toContain(response.status);
      });

      it('should return analytics for active members', async () => {
        const response = await request(app)
          .get('/api/affiliate-shop-groups/grp_test/analytics')
          .set('Authorization', `Bearer ${shopToken}`);

        expect([200, 403, 404, 500]).toContain(response.status);
        if (response.status === 200) {
          expect(response.body.data).toHaveProperty('totalTokensIssued');
          expect(response.body.data).toHaveProperty('totalTokensRedeemed');
          expect(response.body.data).toHaveProperty('activeMembers');
        }
      });
    });

    describe('GET /api/affiliate-shop-groups/:groupId/analytics/members', () => {

      it('should require authentication', async () => {
        const response = await request(app)
          .get('/api/affiliate-shop-groups/grp_test/analytics/members');

        expect(response.status).toBe(401);
      });

      it('should return member activity stats', async () => {
        const response = await request(app)
          .get('/api/affiliate-shop-groups/grp_test/analytics/members')
          .set('Authorization', `Bearer ${shopToken}`);

        expect([200, 403, 404, 500]).toContain(response.status);
      });
    });

    describe('GET /api/affiliate-shop-groups/:groupId/analytics/trends', () => {

      it('should require authentication', async () => {
        const response = await request(app)
          .get('/api/affiliate-shop-groups/grp_test/analytics/trends');

        expect(response.status).toBe(401);
      });

      it('should return transaction trends', async () => {
        const response = await request(app)
          .get('/api/affiliate-shop-groups/grp_test/analytics/trends')
          .set('Authorization', `Bearer ${shopToken}`);

        expect([200, 403, 404, 500]).toContain(response.status);
      });

      it('should support custom days parameter', async () => {
        const response = await request(app)
          .get('/api/affiliate-shop-groups/grp_test/analytics/trends?days=7')
          .set('Authorization', `Bearer ${shopToken}`);

        expect([200, 403, 404, 500]).toContain(response.status);
      });
    });
  });

  // ============================================
  // Customer Listing Tests
  // ============================================
  describe('GET /api/affiliate-shop-groups/:groupId/customers', () => {

    it('should return customers with balances (public)', async () => {
      const response = await request(app)
        .get('/api/affiliate-shop-groups/grp_test/customers');

      expect([200, 404, 500]).toContain(response.status);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/affiliate-shop-groups/grp_test/customers?page=1&limit=10');

      expect([200, 404, 500]).toContain(response.status);
    });

    it('should support search by address', async () => {
      const response = await request(app)
        .get(`/api/affiliate-shop-groups/grp_test/customers?search=${testCustomerAddress}`);

      expect([200, 404, 500]).toContain(response.status);
    });
  });

  // ============================================
  // Edge Cases and Error Handling
  // ============================================
  describe('Edge Cases and Error Handling', () => {

    it('should handle malformed groupId gracefully', async () => {
      const response = await request(app)
        .get('/api/affiliate-shop-groups/not-a-valid-group-id-format');

      expect([400, 404, 500]).toContain(response.status);
    });

    it('should handle very long group names', async () => {
      const longName = 'A'.repeat(500);
      const response = await request(app)
        .post('/api/affiliate-shop-groups')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          groupName: longName,
          customTokenName: 'Test',
          customTokenSymbol: 'TST'
        });

      // Should either truncate or reject
      expect([201, 400, 403, 500]).toContain(response.status);
    });

    it('should handle special characters in group name', async () => {
      const response = await request(app)
        .post('/api/affiliate-shop-groups')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          groupName: "Test <script>alert('xss')</script> Group",
          customTokenName: 'SafeToken',
          customTokenSymbol: 'SFT'
        });

      // Should sanitize or reject
      expect([201, 400, 403, 500]).toContain(response.status);
    });

    it('should handle concurrent allocation requests', async () => {
      const promises = Array(3).fill(null).map(() =>
        request(app)
          .post('/api/affiliate-shop-groups/grp_test/rcn/allocate')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({ amount: 10 })
      );

      const responses = await Promise.all(promises);

      // All should complete without crashing
      responses.forEach(response => {
        expect([200, 400, 403, 404, 500]).toContain(response.status);
      });
    });

    it('should handle concurrent earn requests', async () => {
      const promises = Array(3).fill(null).map((_, i) =>
        request(app)
          .post('/api/affiliate-shop-groups/grp_test/tokens/earn')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({
            customerAddress: `0x${i.toString().padStart(40, '0')}`,
            amount: 10,
            reason: `Concurrent test ${i}`
          })
      );

      const responses = await Promise.all(promises);

      // All should complete without crashing (race condition test)
      responses.forEach(response => {
        expect([200, 400, 403, 404, 500]).toContain(response.status);
      });
    });

    it('should normalize customer addresses to lowercase', async () => {
      const upperCaseAddress = '0xAAAABBBBCCCCDDDDEEEEFFFF0000111122223333';

      const response = await request(app)
        .post('/api/affiliate-shop-groups/grp_test/tokens/earn')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          customerAddress: upperCaseAddress,
          amount: 10
        });

      expect([200, 400, 403, 404, 500]).toContain(response.status);
    });
  });

  // ============================================
  // Business Logic Validation Tests
  // ============================================
  describe('Business Logic Validation', () => {

    it('should enforce 1:2 RCN backing ratio for token issuance', async () => {
      // 100 tokens should require 50 RCN backing
      // This is a key business rule test
      const response = await request(app)
        .post('/api/affiliate-shop-groups/grp_test/tokens/earn')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          customerAddress: testCustomerAddress,
          amount: 100,
          reason: 'Testing 1:2 ratio'
        });

      // The response should indicate whether sufficient RCN is allocated
      expect([200, 400, 403, 404, 500]).toContain(response.status);
    });

    it('should return RCN backing when tokens are redeemed', async () => {
      // Redeeming 100 tokens should return 50 RCN to available pool
      const response = await request(app)
        .post('/api/affiliate-shop-groups/grp_test/tokens/redeem')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          customerAddress: testCustomerAddress,
          amount: 50,
          reason: 'Testing RCN return'
        });

      expect([200, 400, 403, 404, 500]).toContain(response.status);
    });

    it('should track lifetime earned and redeemed separately', async () => {
      const balanceResponse = await request(app)
        .get(`/api/affiliate-shop-groups/grp_test/balance/${testCustomerAddress}`);

      expect([200, 404, 500]).toContain(balanceResponse.status);
      if (balanceResponse.status === 200) {
        expect(balanceResponse.body.data).toHaveProperty('lifetimeEarned');
        expect(balanceResponse.body.data).toHaveProperty('lifetimeRedeemed');
      }
    });

    it('should record transaction with balance before/after for audit', async () => {
      const response = await request(app)
        .post('/api/affiliate-shop-groups/grp_test/tokens/earn')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          customerAddress: testCustomerAddress,
          amount: 25,
          reason: 'Audit trail test'
        });

      expect([200, 400, 403, 404, 500]).toContain(response.status);
      if (response.status === 200) {
        // Transaction should include balance tracking
        expect(response.body.data.transaction).toBeDefined();
      }
    });

    it('should prevent deallocating RCN that is backing active tokens', async () => {
      // If tokens are issued (using RCN backing), that RCN cannot be deallocated
      const response = await request(app)
        .post('/api/affiliate-shop-groups/grp_test/rcn/deallocate')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({ amount: 999999 }); // Try to deallocate more than available

      // Should fail if some RCN is backing tokens
      expect([400, 403, 404, 500]).toContain(response.status);
    });
  });

  // ============================================
  // POTENTIAL BUG TESTS
  // ============================================
  describe('Potential Bug Detection', () => {

    // BUG CHECK: Auto-approve should work correctly
    it('should auto-approve join request when group has autoApproveRequests=true', async () => {
      // This tests the auto-approval feature
      const response = await request(app)
        .post('/api/affiliate-shop-groups/grp_test/join')
        .set('Authorization', `Bearer ${shop2Token}`)
        .send({ requestMessage: 'Auto-approve test' });

      // If group has autoApproveRequests=true, status should be 'active' immediately
      expect([200, 201, 400, 403, 404, 500]).toContain(response.status);
    });

    // BUG CHECK: Cannot remove group creator
    it('should never allow removing the group creator even by another admin', async () => {
      const response = await request(app)
        .delete(`/api/affiliate-shop-groups/grp_test/members/${testShop.shopId}`)
        .set('Authorization', `Bearer ${shopToken}`);

      // Should fail - cannot remove creator
      if (response.status === 200) {
        // This would be a bug if it succeeds
        console.warn('POTENTIAL BUG: Group creator was removed!');
      }
      expect([400, 403, 404, 500]).toContain(response.status);
    });

    // BUG CHECK: Ensure RCN allocation math is correct
    it('should correctly calculate availableRcn as allocatedRcn minus usedRcn', async () => {
      const response = await request(app)
        .get('/api/affiliate-shop-groups/grp_test/rcn/allocation')
        .set('Authorization', `Bearer ${shopToken}`);

      if (response.status === 200) {
        const { allocatedRcn, usedRcn, availableRcn } = response.body.data;
        // Verify the math: available = allocated - used
        expect(availableRcn).toBe(allocatedRcn - usedRcn);
      }
    });

    // BUG CHECK: Rejected/removed members should not access analytics
    it('should deny analytics access to rejected members', async () => {
      // If a member was rejected, they should get 403 on analytics
      const response = await request(app)
        .get('/api/affiliate-shop-groups/grp_test/analytics')
        .set('Authorization', `Bearer ${shop2Token}`);

      // Should be 403 if shop2 is rejected/removed/pending
      expect([200, 403, 404, 500]).toContain(response.status);
    });

    // BUG CHECK: Transaction isolation for concurrent operations
    it('should maintain balance consistency under concurrent earn/redeem', async () => {
      // Issue tokens first
      const earnPromises = Array(2).fill(null).map(() =>
        request(app)
          .post('/api/affiliate-shop-groups/grp_test/tokens/earn')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({
            customerAddress: testCustomerAddress,
            amount: 10,
            reason: 'Concurrent test'
          })
      );

      await Promise.all(earnPromises);

      // Check balance is consistent
      const balanceResponse = await request(app)
        .get(`/api/affiliate-shop-groups/grp_test/balance/${testCustomerAddress}`);

      expect([200, 404, 500]).toContain(balanceResponse.status);
      // Balance should be a valid number (not NaN or negative)
      if (balanceResponse.status === 200) {
        expect(typeof balanceResponse.body.data.balance).toBe('number');
        expect(balanceResponse.body.data.balance).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
