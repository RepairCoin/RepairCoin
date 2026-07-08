import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import RepairCoinApp from '../../src/app';
import { AdminService } from '../../src/domains/admin/services/AdminService';
import { adminRepository, refreshTokenRepository } from '../../src/repositories';
import * as dbPool from '../../src/utils/database-pool';

jest.mock('thirdweb');

describe('Admin Treasury Management Tests', () => {
  let app: any;
  let adminToken: string;
  const adminAddress = '0x1111111111111111111111111111111111111111';

  const adminRecord = {
    id: 1,
    walletAddress: adminAddress,
    name: 'Test Admin',
    permissions: ['all'],
    isActive: true,
    isSuperAdmin: true,
    role: 'super_admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  beforeAll(async () => {
    process.env.ADMIN_ADDRESSES = adminAddress;
    process.env.JWT_SECRET = 'test-secret';
    process.env.NODE_ENV = 'test';

    const repairCoinApp = new RepairCoinApp();
    await repairCoinApp.initialize();
    app = repairCoinApp.app;
  });

  // jest config restores mocks before each test — reinstall the auth data-layer
  // mocks (so the admin token authenticates without the real DB) and re-mint
  // the token every test.
  beforeEach(async () => {
    jest
      .spyOn(adminRepository, 'getAdminByWalletAddress')
      .mockImplementation(async (addr: string) =>
        addr.toLowerCase() === adminAddress.toLowerCase() ? (adminRecord as any) : null
      );
    jest.spyOn(adminRepository, 'updateAdminLastLogin').mockResolvedValue(undefined as any);
    jest.spyOn(adminRepository, 'updateAdmin').mockResolvedValue(undefined as any);
    jest.spyOn(refreshTokenRepository, 'hasRecentRevocation').mockResolvedValue(null as any);
    jest.spyOn(refreshTokenRepository, 'revokeActiveByDevice').mockResolvedValue(undefined as any);
    jest.spyOn(refreshTokenRepository, 'createRefreshToken').mockResolvedValue({} as any);
    jest.spyOn(refreshTokenRepository, 'isTokenRevoked').mockResolvedValue(false as any);

    const authResponse = await request(app)
      .post('/api/auth/admin')
      .send({ address: adminAddress });
    adminToken = authResponse.body.token;
  });

  afterAll(async () => {
    await dbPool.closeSharedPool();
  });

  describe('POST /api/admin/mint', () => {
    it('should mint tokens to customer address', async () => {
      jest.spyOn(AdminService.prototype, 'manualMint').mockResolvedValue({
        success: true,
        transactionHash: '0xabc123',
        amount: 100
      } as any);

      const response = await request(app)
        .post('/api/admin/mint')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerAddress: '0x1234567890123456789012345678901234567890',
          amount: 100,
          reason: 'Manual reward for loyalty'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        amount: 100,
        transactionHash: '0xabc123'
      });
    });

    it('should validate ethereum address format', async () => {
      const response = await request(app)
        .post('/api/admin/mint')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerAddress: 'invalid-address',
          amount: 100,
          reason: 'Test'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('valid Ethereum address');
    });

    it('should enforce maximum mint amount', async () => {
      const response = await request(app)
        .post('/api/admin/mint')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerAddress: '0x1234567890123456789012345678901234567890',
          amount: 10000, // Above maximum of 1000
          reason: 'Test'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('at most');
    });
  });

  describe('GET /api/admin/treasury/revenue-sharing', () => {
    const mockQuery = jest.fn<any>();
    const mockPool = { query: mockQuery };

    beforeEach(() => {
      mockQuery.mockReset();
      // Repositories captured the real pool at init; the revenue-sharing handler
      // calls getSharedPool() fresh per request, so this only redirects that route.
      jest.spyOn(dbPool, 'getSharedPool').mockReturnValue(mockPool as any);
    });

    it('should return revenue sharing summary and purchases for 30d period', async () => {
      // Mock summary query
      mockQuery.mockResolvedValueOnce({
        rows: [{
          purchase_count: '5',
          total_revenue: '510.00',
          operations_total: '408.00',
          stakers_total: '51.00',
          dao_treasury_total: '51.00'
        }]
      });

      // Mock purchases query
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 227,
            shop_id: 'peanut',
            shop_name: 'Peanut',
            amount: '100.00000000',
            total_cost: '10.00',
            operations_share: '8.00000000',
            stakers_share: '1.00000000',
            dao_treasury_share: '1.00000000',
            shop_tier: 'STANDARD',
            completed_at: '2026-04-14T05:49:50.281Z',
            created_at: '2026-04-14T05:49:12.663Z'
          },
          {
            id: 225,
            shop_id: 'peanut',
            shop_name: 'Peanut',
            amount: '1000.00000000',
            total_cost: '100.00',
            operations_share: '0.00000000',
            stakers_share: '0.00000000',
            dao_treasury_share: '0.00000000',
            shop_tier: 'STANDARD',
            completed_at: '2026-04-14T02:52:54.864Z',
            created_at: '2026-04-14T02:52:22.029Z'
          }
        ]
      });

      const response = await request(app)
        .get('/api/admin/treasury/revenue-sharing?period=30d')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.period).toBe('30d');

      // Verify summary
      const summary = response.body.data.summary;
      expect(summary.purchaseCount).toBe(5);
      expect(summary.totalRevenue).toBe(510);
      expect(summary.operationsTotal).toBe(408);
      expect(summary.stakersTotal).toBe(51);
      expect(summary.daoTreasuryTotal).toBe(51);

      // Verify purchases
      const purchases = response.body.data.purchases;
      expect(purchases).toHaveLength(2);
      expect(purchases[0]).toMatchObject({
        id: 227,
        shopId: 'peanut',
        shopName: 'Peanut',
        amount: 100,
        totalCost: 10,
        operationsShare: 8,
        stakersShare: 1,
        daoTreasuryShare: 1,
        shopTier: 'STANDARD'
      });
    });

    it('should handle different period filters', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ purchase_count: '2', total_revenue: '20.00', operations_total: '16.00', stakers_total: '2.00', dao_treasury_total: '2.00' }]
      });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/admin/treasury/revenue-sharing?period=7d')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.period).toBe('7d');

      // Verify parameterized query was called with 7 days
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INTERVAL'),
        [7]
      );
    });

    it('should handle "all" period without date filter', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ purchase_count: '100', total_revenue: '5000.00', operations_total: '4000.00', stakers_total: '500.00', dao_treasury_total: '500.00' }]
      });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/admin/treasury/revenue-sharing?period=all')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.period).toBe('all');
      expect(response.body.data.summary.purchaseCount).toBe(100);

      // Verify no date parameter was passed
      expect(mockQuery).toHaveBeenCalledWith(
        expect.not.stringContaining('INTERVAL'),
        []
      );
    });

    it('should return correct 80/10/10 revenue split for a standard tier purchase', async () => {
      // 100 RCN at $0.10 = $10.00 total
      // Expected: operations $8.00, stakers $1.00, DAO $1.00
      mockQuery.mockResolvedValueOnce({
        rows: [{ purchase_count: '1', total_revenue: '10.00', operations_total: '8.00', stakers_total: '1.00', dao_treasury_total: '1.00' }]
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1, shop_id: 'test-shop', shop_name: 'Test Shop',
          amount: '100.00000000', total_cost: '10.00',
          operations_share: '8.00000000', stakers_share: '1.00000000', dao_treasury_share: '1.00000000',
          shop_tier: 'STANDARD', completed_at: new Date().toISOString(), created_at: new Date().toISOString()
        }]
      });

      const response = await request(app)
        .get('/api/admin/treasury/revenue-sharing?period=30d')
        .set('Authorization', `Bearer ${adminToken}`);

      const summary = response.body.data.summary;
      const totalFromShares = summary.operationsTotal + summary.stakersTotal + summary.daoTreasuryTotal;
      expect(totalFromShares).toBe(summary.totalRevenue);

      // Verify percentages
      expect(summary.operationsTotal / summary.totalRevenue).toBeCloseTo(0.8, 2);
      expect(summary.stakersTotal / summary.totalRevenue).toBeCloseTo(0.1, 2);
      expect(summary.daoTreasuryTotal / summary.totalRevenue).toBeCloseTo(0.1, 2);
    });

    it('should handle empty results gracefully', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ purchase_count: '0', total_revenue: '0', operations_total: '0', stakers_total: '0', dao_treasury_total: '0' }]
      });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/admin/treasury/revenue-sharing?period=7d')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.summary.purchaseCount).toBe(0);
      expect(response.body.data.summary.totalRevenue).toBe(0);
      expect(response.body.data.purchases).toHaveLength(0);
    });

    it('should require admin authentication', async () => {
      const response = await request(app)
        .get('/api/admin/treasury/revenue-sharing?period=30d');

      expect(response.status).toBe(401);
    });
  });
});
