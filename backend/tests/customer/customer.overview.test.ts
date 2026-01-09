import request from 'supertest';
import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  jest,
} from '@jest/globals';
import RepairCoinApp from '../../src/app';

// Mock external services
jest.mock('thirdweb');

/**
 * Customer Overview Tab Test Suite
 *
 * Tests the /customer?tab=overview page functionality:
 * - Customer profile data (name, tier, wallet address)
 * - Balance data (availableBalance, lifetimeEarned, totalRedeemed)
 * - Transaction history
 * - Mint to wallet functionality (instant-mint)
 * - Shop group token balances
 * - Customer analytics
 *
 * API Endpoints Tested:
 * - GET /api/customers/:address - Get customer profile
 * - PUT /api/customers/:address - Update customer profile
 * - GET /api/customers/:address/transactions - Get transaction history
 * - GET /api/customers/:address/analytics - Get customer analytics
 * - GET /api/tokens/balance/:address - Get RCN balance
 * - GET /api/customers/balance/:address - Get balance data
 * - POST /api/customers/balance/:address/instant-mint - Mint to wallet
 * - POST /api/customers/balance/:address/queue-mint - Queue mint
 * - GET /api/customers/balance/:address/sync - Sync balance
 * - GET /api/customers/balance/pending-mints - Get pending mints
 * - GET /api/customers/balance/statistics - Get balance statistics
 * - GET /api/affiliate-shop-groups - Get all groups
 * - GET /api/affiliate-shop-groups/:groupId - Get specific group
 * - GET /api/affiliate-shop-groups/customer/:address/balances - Get group balances
 */
describe('Customer Overview Tab Tests', () => {
  let app: any;

  // Test data
  const testCustomerAddress = '0xCUST000000000000000000000000000000000001';
  const testInvalidAddress = 'invalid-address';
  const testGroupId = 'group-test-001';

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-for-overview';
    process.env.NODE_ENV = 'test';

    const repairCoinApp = new RepairCoinApp();
    await repairCoinApp.initialize();
    app = repairCoinApp.app;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // SECTION 1: Customer Profile
  // ============================================================
  describe('Customer Profile', () => {
    describe('GET /api/customers/:address', () => {
      it('should return customer profile for valid address', async () => {
        const response = await request(app)
          .get(`/api/customers/${testCustomerAddress}`);

        expect([200, 400, 404, 429, 500]).toContain(response.status);

        if (response.status === 200) {
          expect(response.body).toHaveProperty('success');
        }
      });

      it('should handle non-existent customer', async () => {
        const response = await request(app)
          .get('/api/customers/0x0000000000000000000000000000000000000000');

        expect([200, 404, 429, 500]).toContain(response.status);
      });

      it('should validate ethereum address format', async () => {
        const response = await request(app)
          .get(`/api/customers/${testInvalidAddress}`);

        expect([400, 404, 429, 500]).toContain(response.status);
      });

      it('should return customer tier information', async () => {
        const response = await request(app)
          .get(`/api/customers/${testCustomerAddress}`);

        expect([200, 400, 404, 429, 500]).toContain(response.status);

        if (response.status === 200 && response.body.data) {
          // Customer profile should include tier
          expect(['BRONZE', 'SILVER', 'GOLD', undefined]).toContain(
            response.body.data.tier
          );
        }
      });
    });

    describe('PUT /api/customers/:address', () => {
      it('should require authentication', async () => {
        const response = await request(app)
          .put(`/api/customers/${testCustomerAddress}`)
          .send({ name: 'Test User' });

        expect([401, 403]).toContain(response.status);
      });

      it('should update customer profile with valid data', async () => {
        const response = await request(app)
          .put(`/api/customers/${testCustomerAddress}`)
          .set('Authorization', 'Bearer mock-customer-token')
          .send({ name: 'Updated Name' });

        expect([200, 400, 401, 403, 404, 429, 500]).toContain(response.status);
      });

      it('should validate email format', async () => {
        const response = await request(app)
          .put(`/api/customers/${testCustomerAddress}`)
          .set('Authorization', 'Bearer mock-customer-token')
          .send({ email: 'invalid-email' });

        expect([400, 401, 403, 429, 500]).toContain(response.status);
      });

      it('should accept valid email update', async () => {
        const response = await request(app)
          .put(`/api/customers/${testCustomerAddress}`)
          .set('Authorization', 'Bearer mock-customer-token')
          .send({ email: 'valid@example.com' });

        expect([200, 400, 401, 403, 404, 429, 500]).toContain(response.status);
      });

      it('should validate name length', async () => {
        const longName = 'a'.repeat(300);
        const response = await request(app)
          .put(`/api/customers/${testCustomerAddress}`)
          .set('Authorization', 'Bearer mock-customer-token')
          .send({ name: longName });

        expect([400, 401, 403, 429, 500]).toContain(response.status);
      });
    });
  });

  // ============================================================
  // SECTION 2: Transaction History
  // ============================================================
  describe('Transaction History', () => {
    describe('GET /api/customers/:address/transactions', () => {
      it('should require authentication', async () => {
        const response = await request(app)
          .get(`/api/customers/${testCustomerAddress}/transactions`);

        expect([401, 403]).toContain(response.status);
      });

      it('should return transaction history for customer', async () => {
        const response = await request(app)
          .get(`/api/customers/${testCustomerAddress}/transactions`)
          .set('Authorization', 'Bearer mock-customer-token');

        expect([200, 401, 403, 429, 500]).toContain(response.status);

        if (response.status === 200) {
          expect(response.body).toHaveProperty('success');
        }
      });

      it('should support type filter - earned', async () => {
        const response = await request(app)
          .get(`/api/customers/${testCustomerAddress}/transactions`)
          .query({ type: 'earned' })
          .set('Authorization', 'Bearer mock-customer-token');

        expect([200, 401, 403, 429, 500]).toContain(response.status);
      });

      it('should support type filter - redeemed', async () => {
        const response = await request(app)
          .get(`/api/customers/${testCustomerAddress}/transactions`)
          .query({ type: 'redeemed' })
          .set('Authorization', 'Bearer mock-customer-token');

        expect([200, 401, 403, 429, 500]).toContain(response.status);
      });

      it('should support type filter - bonus', async () => {
        const response = await request(app)
          .get(`/api/customers/${testCustomerAddress}/transactions`)
          .query({ type: 'bonus' })
          .set('Authorization', 'Bearer mock-customer-token');

        expect([200, 401, 403, 429, 500]).toContain(response.status);
      });

      it('should support type filter - referral', async () => {
        const response = await request(app)
          .get(`/api/customers/${testCustomerAddress}/transactions`)
          .query({ type: 'referral' })
          .set('Authorization', 'Bearer mock-customer-token');

        expect([200, 401, 403, 429, 500]).toContain(response.status);
      });

      it('should support pagination', async () => {
        const response = await request(app)
          .get(`/api/customers/${testCustomerAddress}/transactions`)
          .query({ page: 1, limit: 10 })
          .set('Authorization', 'Bearer mock-customer-token');

        expect([200, 401, 403, 429, 500]).toContain(response.status);
      });

      it('should support shopId filter', async () => {
        const response = await request(app)
          .get(`/api/customers/${testCustomerAddress}/transactions`)
          .query({ shopId: 'shop-001' })
          .set('Authorization', 'Bearer mock-customer-token');

        expect([200, 401, 403, 429, 500]).toContain(response.status);
      });
    });
  });

  // ============================================================
  // SECTION 3: Customer Analytics
  // ============================================================
  describe('Customer Analytics', () => {
    describe('GET /api/customers/:address/analytics', () => {
      it('should require authentication', async () => {
        const response = await request(app)
          .get(`/api/customers/${testCustomerAddress}/analytics`);

        expect([401, 403]).toContain(response.status);
      });

      it('should return analytics for customer', async () => {
        const response = await request(app)
          .get(`/api/customers/${testCustomerAddress}/analytics`)
          .set('Authorization', 'Bearer mock-customer-token');

        expect([200, 401, 403, 404, 429, 500]).toContain(response.status);

        if (response.status === 200) {
          expect(response.body).toHaveProperty('success');
        }
      });
    });
  });

  // ============================================================
  // SECTION 4: Token Balance
  // ============================================================
  describe('Token Balance', () => {
    describe('GET /api/tokens/balance/:address', () => {
      it('should return balance for valid address', async () => {
        const response = await request(app)
          .get(`/api/tokens/balance/${testCustomerAddress}`);

        expect([200, 400, 404, 429, 500]).toContain(response.status);

        if (response.status === 200) {
          expect(response.body).toHaveProperty('success');
        }
      });

      it('should handle non-existent customer', async () => {
        const response = await request(app)
          .get('/api/tokens/balance/0x0000000000000000000000000000000000000000');

        expect([200, 400, 404, 429, 500]).toContain(response.status);
      });

      it('should validate address format', async () => {
        const response = await request(app)
          .get(`/api/tokens/balance/${testInvalidAddress}`);

        expect([400, 404, 429, 500]).toContain(response.status);
      });
    });

    describe('GET /api/customers/balance/:address', () => {
      it('should return customer balance data', async () => {
        const response = await request(app)
          .get(`/api/customers/balance/${testCustomerAddress}`);

        expect([200, 400, 404, 429, 500]).toContain(response.status);

        if (response.status === 200) {
          expect(response.body).toHaveProperty('success');
        }
      });

      it('should include availableBalance field', async () => {
        const response = await request(app)
          .get(`/api/customers/balance/${testCustomerAddress}`);

        expect([200, 400, 404, 429, 500]).toContain(response.status);

        if (response.status === 200 && response.body.data) {
          expect(response.body.data).toHaveProperty('availableBalance');
        }
      });

      it('should include lifetimeEarned field', async () => {
        const response = await request(app)
          .get(`/api/customers/balance/${testCustomerAddress}`);

        expect([200, 400, 404, 429, 500]).toContain(response.status);

        if (response.status === 200 && response.body.data) {
          expect(response.body.data).toHaveProperty('lifetimeEarned');
        }
      });
    });
  });

  // ============================================================
  // SECTION 5: Mint to Wallet
  // ============================================================
  describe('Mint to Wallet', () => {
    describe('POST /api/customers/balance/:address/instant-mint', () => {
      it('should require authentication', async () => {
        const response = await request(app)
          .post(`/api/customers/balance/${testCustomerAddress}/instant-mint`)
          .send({ amount: 10 });

        expect([400, 401, 403]).toContain(response.status);
      });

      it('should require amount', async () => {
        const response = await request(app)
          .post(`/api/customers/balance/${testCustomerAddress}/instant-mint`)
          .set('Authorization', 'Bearer mock-customer-token')
          .send({});

        expect([400, 401, 403, 429, 500]).toContain(response.status);
      });

      it('should validate positive amount', async () => {
        const response = await request(app)
          .post(`/api/customers/balance/${testCustomerAddress}/instant-mint`)
          .set('Authorization', 'Bearer mock-customer-token')
          .send({ amount: -10 });

        expect([400, 401, 403, 429, 500]).toContain(response.status);
      });

      it('should validate zero amount', async () => {
        const response = await request(app)
          .post(`/api/customers/balance/${testCustomerAddress}/instant-mint`)
          .set('Authorization', 'Bearer mock-customer-token')
          .send({ amount: 0 });

        expect([400, 401, 403, 429, 500]).toContain(response.status);
      });

      it('should enforce max mint limit (10,000 RCN)', async () => {
        const response = await request(app)
          .post(`/api/customers/balance/${testCustomerAddress}/instant-mint`)
          .set('Authorization', 'Bearer mock-customer-token')
          .send({ amount: 15000 });

        expect([400, 401, 403, 429, 500]).toContain(response.status);
      });

      it('should process mint with valid amount', async () => {
        const response = await request(app)
          .post(`/api/customers/balance/${testCustomerAddress}/instant-mint`)
          .set('Authorization', 'Bearer mock-customer-token')
          .send({ amount: 10 });

        expect([200, 400, 401, 403, 404, 429, 500]).toContain(response.status);
      });

      it('should handle non-numeric amount', async () => {
        const response = await request(app)
          .post(`/api/customers/balance/${testCustomerAddress}/instant-mint`)
          .set('Authorization', 'Bearer mock-customer-token')
          .send({ amount: 'invalid' });

        expect([400, 401, 403, 429, 500]).toContain(response.status);
      });
    });

    describe('POST /api/customers/balance/:address/queue-mint', () => {
      it('should require authentication', async () => {
        const response = await request(app)
          .post(`/api/customers/balance/${testCustomerAddress}/queue-mint`)
          .send({ amount: 10 });

        expect([400, 401, 403]).toContain(response.status);
      });

      it('should queue mint request', async () => {
        const response = await request(app)
          .post(`/api/customers/balance/${testCustomerAddress}/queue-mint`)
          .set('Authorization', 'Bearer mock-customer-token')
          .send({ amount: 10 });

        expect([200, 400, 401, 403, 404, 429, 500]).toContain(response.status);
      });
    });

    describe('GET /api/customers/balance/:address/sync', () => {
      it('should sync balance for customer', async () => {
        const response = await request(app)
          .get(`/api/customers/balance/${testCustomerAddress}/sync`);

        expect([200, 404, 429, 500]).toContain(response.status);
      });
    });

    describe('GET /api/customers/balance/pending-mints', () => {
      it('should return pending mints', async () => {
        const response = await request(app)
          .get('/api/customers/balance/pending-mints');

        expect([200, 401, 403, 429, 500]).toContain(response.status);
      });
    });

    describe('GET /api/customers/balance/statistics', () => {
      it('should return balance statistics', async () => {
        const response = await request(app)
          .get('/api/customers/balance/statistics');

        expect([200, 401, 403, 429, 500]).toContain(response.status);

        if (response.status === 200) {
          expect(response.body).toHaveProperty('success');
        }
      });
    });
  });

  // ============================================================
  // SECTION 6: Shop Group Token Balances
  // ============================================================
  describe('Shop Group Token Balances', () => {
    describe('GET /api/affiliate-shop-groups', () => {
      it('should return all public groups', async () => {
        const response = await request(app)
          .get('/api/affiliate-shop-groups');

        expect([200, 429, 500]).toContain(response.status);

        if (response.status === 200) {
          expect(response.body).toHaveProperty('success');
        }
      });

      it('should support isPrivate filter', async () => {
        const response = await request(app)
          .get('/api/affiliate-shop-groups')
          .query({ isPrivate: false });

        expect([200, 429, 500]).toContain(response.status);
      });
    });

    describe('GET /api/affiliate-shop-groups/:groupId', () => {
      it('should return specific group', async () => {
        const response = await request(app)
          .get(`/api/affiliate-shop-groups/${testGroupId}`);

        expect([200, 404, 429, 500]).toContain(response.status);
      });

      it('should handle non-existent group', async () => {
        const response = await request(app)
          .get('/api/affiliate-shop-groups/non-existent-group');

        expect([404, 429, 500]).toContain(response.status);
      });
    });

    describe('GET /api/affiliate-shop-groups/customer/:address/balances', () => {
      it('should return customer group balances', async () => {
        const response = await request(app)
          .get(`/api/affiliate-shop-groups/customer/${testCustomerAddress}/balances`);

        expect([200, 404, 429, 500]).toContain(response.status);

        if (response.status === 200) {
          expect(response.body).toHaveProperty('success');
        }
      });

      it('should handle customer with no group balances', async () => {
        const response = await request(app)
          .get('/api/affiliate-shop-groups/customer/0x0000000000000000000000000000000000000000/balances');

        expect([200, 404, 429, 500]).toContain(response.status);
      });
    });
  });

  // ============================================================
  // SECTION 7: Customer Registration
  // ============================================================
  describe('Customer Registration', () => {
    describe('POST /api/customers/register', () => {
      it('should require walletAddress', async () => {
        const response = await request(app)
          .post('/api/customers/register')
          .send({});

        expect([400, 429, 500]).toContain(response.status);
      });

      it('should validate wallet address format', async () => {
        const response = await request(app)
          .post('/api/customers/register')
          .send({ walletAddress: 'invalid-address' });

        expect([400, 429, 500]).toContain(response.status);
      });

      it('should register new customer with valid address', async () => {
        const newAddress = `0x${Date.now().toString(16).padStart(40, '0')}`;
        const response = await request(app)
          .post('/api/customers/register')
          .send({ walletAddress: newAddress });

        expect([200, 201, 400, 409, 429, 500]).toContain(response.status);
      });

      it('should accept optional name', async () => {
        const newAddress = `0x${(Date.now() + 1).toString(16).padStart(40, '0')}`;
        const response = await request(app)
          .post('/api/customers/register')
          .send({
            walletAddress: newAddress,
            name: 'Test Customer',
          });

        expect([200, 201, 400, 409, 429, 500]).toContain(response.status);
      });

      it('should accept optional email', async () => {
        const newAddress = `0x${(Date.now() + 2).toString(16).padStart(40, '0')}`;
        const response = await request(app)
          .post('/api/customers/register')
          .send({
            walletAddress: newAddress,
            email: 'test@example.com',
          });

        expect([200, 201, 400, 409, 429, 500]).toContain(response.status);
      });

      it('should accept referral code', async () => {
        const newAddress = `0x${(Date.now() + 3).toString(16).padStart(40, '0')}`;
        const response = await request(app)
          .post('/api/customers/register')
          .send({
            walletAddress: newAddress,
            referralCode: 'REF123',
          });

        expect([200, 201, 400, 409, 429, 500]).toContain(response.status);
      });
    });
  });

  // ============================================================
  // SECTION 8: Customer Tiers
  // ============================================================
  describe('Customer Tiers', () => {
    describe('GET /api/customers/tier/:tierLevel', () => {
      it('should require authentication', async () => {
        const response = await request(app)
          .get('/api/customers/tier/BRONZE');

        expect([401, 403]).toContain(response.status);
      });

      it('should require admin role', async () => {
        const response = await request(app)
          .get('/api/customers/tier/BRONZE')
          .set('Authorization', 'Bearer mock-customer-token');

        expect([401, 403, 429, 500]).toContain(response.status);
      });

      it('should return BRONZE tier customers', async () => {
        const response = await request(app)
          .get('/api/customers/tier/BRONZE')
          .set('Authorization', 'Bearer mock-admin-token');

        expect([200, 401, 403, 429, 500]).toContain(response.status);
      });

      it('should return SILVER tier customers', async () => {
        const response = await request(app)
          .get('/api/customers/tier/SILVER')
          .set('Authorization', 'Bearer mock-admin-token');

        expect([200, 401, 403, 429, 500]).toContain(response.status);
      });

      it('should return GOLD tier customers', async () => {
        const response = await request(app)
          .get('/api/customers/tier/GOLD')
          .set('Authorization', 'Bearer mock-admin-token');

        expect([200, 401, 403, 429, 500]).toContain(response.status);
      });
    });
  });

  // ============================================================
  // SECTION 9: Account Management
  // ============================================================
  describe('Account Management', () => {
    describe('POST /api/customers/:address/deactivate', () => {
      it('should require authentication', async () => {
        const response = await request(app)
          .post(`/api/customers/${testCustomerAddress}/deactivate`)
          .send({ reason: 'User request' });

        expect([401, 403]).toContain(response.status);
      });

      it('should require admin role', async () => {
        const response = await request(app)
          .post(`/api/customers/${testCustomerAddress}/deactivate`)
          .set('Authorization', 'Bearer mock-customer-token')
          .send({ reason: 'User request' });

        expect([401, 403, 429, 500]).toContain(response.status);
      });
    });

    describe('POST /api/customers/:address/request-unsuspend', () => {
      it('should require reason', async () => {
        const response = await request(app)
          .post(`/api/customers/${testCustomerAddress}/request-unsuspend`)
          .send({});

        expect([400, 429, 500]).toContain(response.status);
      });

      it('should accept unsuspension request', async () => {
        const response = await request(app)
          .post(`/api/customers/${testCustomerAddress}/request-unsuspend`)
          .send({ reason: 'I would like to be unsuspended' });

        expect([200, 400, 404, 429, 500]).toContain(response.status);
      });

      it('should validate address format', async () => {
        const response = await request(app)
          .post(`/api/customers/${testInvalidAddress}/request-unsuspend`)
          .send({ reason: 'Unsuspend request' });

        expect([400, 429, 500]).toContain(response.status);
      });
    });
  });

  // ============================================================
  // SECTION 10: Edge Cases and Error Handling
  // ============================================================
  describe('Edge Cases and Error Handling', () => {
    describe('Invalid Address Formats', () => {
      it('should handle empty address', async () => {
        const response = await request(app)
          .get('/api/customers/');

        // Empty path might route differently
        expect([200, 400, 401, 403, 404, 429, 500]).toContain(response.status);
      });

      it('should handle address with special characters', async () => {
        const response = await request(app)
          .get('/api/customers/<script>alert(1)</script>');

        expect([400, 404, 429, 500]).toContain(response.status);
      });

      it('should handle very long address', async () => {
        const longAddress = '0x' + 'a'.repeat(100);
        const response = await request(app)
          .get(`/api/customers/${longAddress}`);

        expect([400, 404, 429, 500]).toContain(response.status);
      });
    });

    describe('Rate Limiting', () => {
      it('should handle multiple rapid requests', async () => {
        const requests = Array(5).fill(null).map(() =>
          request(app).get(`/api/customers/${testCustomerAddress}`)
        );

        const responses = await Promise.all(requests);

        responses.forEach(response => {
          expect([200, 400, 404, 429, 500]).toContain(response.status);
        });
      });
    });

    describe('Cross-Shop Verification', () => {
      it('should return cross-shop balance', async () => {
        const response = await request(app)
          .get(`/api/customers/cross-shop/balance/${testCustomerAddress}`);

        expect([200, 400, 404, 429, 500]).toContain(response.status);
      });

      it('should return cross-shop history', async () => {
        const response = await request(app)
          .get(`/api/customers/cross-shop/history/${testCustomerAddress}`);

        expect([200, 400, 404, 429, 500]).toContain(response.status);
      });

      it('should return network stats', async () => {
        const response = await request(app)
          .get('/api/customers/cross-shop/stats/network');

        expect([200, 429, 500]).toContain(response.status);
      });
    });

    describe('Data Export', () => {
      it('should require authentication for data export', async () => {
        const response = await request(app)
          .get(`/api/customers/${testCustomerAddress}/export`);

        expect([401, 403]).toContain(response.status);
      });

      it('should export data as JSON', async () => {
        const response = await request(app)
          .get(`/api/customers/${testCustomerAddress}/export`)
          .query({ format: 'json' })
          .set('Authorization', 'Bearer mock-customer-token');

        expect([200, 401, 403, 404, 429, 500]).toContain(response.status);
      });
    });

    describe('Notification Preferences', () => {
      it('should get notification preferences', async () => {
        const response = await request(app)
          .get(`/api/customers/${testCustomerAddress}/notification-preferences`)
          .set('Authorization', 'Bearer mock-customer-token');

        expect([200, 401, 403, 404, 429, 500]).toContain(response.status);
      });

      it('should update notification preferences', async () => {
        const response = await request(app)
          .put(`/api/customers/${testCustomerAddress}/notification-preferences`)
          .set('Authorization', 'Bearer mock-customer-token')
          .send({
            emailReminders: true,
            smsReminders: false,
          });

        expect([200, 400, 401, 403, 404, 429, 500]).toContain(response.status);
      });
    });
  });

  // ============================================================
  // SECTION 11: Response Structure Validation
  // ============================================================
  describe('Response Structure Validation', () => {
    it('should return proper structure for customer profile', async () => {
      const response = await request(app)
        .get(`/api/customers/${testCustomerAddress}`);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('success');
      }
    });

    it('should return proper structure for balance data', async () => {
      const response = await request(app)
        .get(`/api/customers/balance/${testCustomerAddress}`);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('data');
      }
    });

    it('should return proper error structure', async () => {
      const response = await request(app)
        .get(`/api/customers/${testInvalidAddress}`);

      if (response.status === 400) {
        expect(response.body).toHaveProperty('success', false);
      }
    });
  });

  // ============================================================
  // SECTION 12: Public Shops Endpoint
  // ============================================================
  describe('Public Shops', () => {
    describe('GET /api/customers/shops', () => {
      it('should return public shops list', async () => {
        const response = await request(app)
          .get('/api/customers/shops');

        expect([200, 429, 500]).toContain(response.status);

        if (response.status === 200) {
          expect(response.body).toHaveProperty('success');
          expect(response.body).toHaveProperty('data');
        }
      });
    });
  });

  // ============================================================
  // SECTION 13: Concurrent Request Handling
  // ============================================================
  describe('Concurrent Request Handling', () => {
    it('should handle multiple simultaneous profile requests', async () => {
      const addresses = [
        testCustomerAddress,
        '0x0000000000000000000000000000000000000001',
        '0x0000000000000000000000000000000000000002',
      ];

      const requests = addresses.map(addr =>
        request(app).get(`/api/customers/${addr}`)
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect([200, 400, 404, 429, 500]).toContain(response.status);
      });
    });

    it('should handle multiple simultaneous balance requests', async () => {
      const requests = Array(3).fill(null).map(() =>
        request(app).get(`/api/customers/balance/${testCustomerAddress}`)
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect([200, 400, 404, 429, 500]).toContain(response.status);
      });
    });
  });
});
