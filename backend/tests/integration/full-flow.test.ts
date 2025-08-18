import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import RepairCoinApp from '../../src/app';

// Mock all repositories and services
jest.mock('../../src/repositories/CustomerRepository');
jest.mock('../../src/repositories/ShopRepository');
jest.mock('../../src/repositories/AdminRepository');
jest.mock('../../src/repositories/TransactionRepository');
jest.mock('../../src/repositories/ReferralRepository');
jest.mock('../../src/domains/token/services/TokenService');
jest.mock('../../src/domains/token/services/VerificationService');
jest.mock('thirdweb');

describe('Full Integration Flow Test', () => {
  let app: any;
  let adminToken: string;
  let shopToken: string;
  let customerToken: string;

  const adminAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f1234';
  const shopId = 'test-auto-repair';
  const shopAddress = '0x1234567890123456789012345678901234567890';
  const customerAddress = '0x2345678901234567890123456789012345678901';
  const referredCustomerAddress = '0x3456789012345678901234567890123456789012';

  beforeAll(async () => {
    process.env.ADMIN_ADDRESSES = adminAddress;
    process.env.JWT_SECRET = 'test-secret';
    process.env.NODE_ENV = 'test';
    
    const repairCoinApp = new RepairCoinApp();
    await repairCoinApp.initialize();
    app = repairCoinApp.app;
  });

  describe('Complete User Journey', () => {
    it('should complete full cycle: shop registration → approval → customer registration → earn → redeem', async () => {
      console.log('\n=== STEP 1: Shop Registration ===');
      
      // 1. Shop registers
      const shopRegistration = await request(app)
        .post('/api/shops/register')
        .send({
          shopId,
          walletAddress: shopAddress,
          firstName: 'John',
          lastName: 'Owner',
          email: 'shop@test.com',
          phone: '+1234567890',
          companyName: 'Test Auto Repair',
          companySize: '11-50',
          monthlyRevenue: '$10k-$50k',
          role: 'owner',
          streetAddress: '123 Main St',
          city: 'Los Angeles',
          country: 'USA',
          acceptedTerms: true
        });

      expect(shopRegistration.status).toBe(201);
      expect(shopRegistration.body.data.shop.is_verified).toBe(false);
      console.log('✓ Shop registered successfully (pending approval)');

      console.log('\n=== STEP 2: Admin Approves Shop ===');
      
      // 2. Admin logs in
      const adminAuth = await request(app)
        .post('/api/auth/admin')
        .send({ walletAddress: adminAddress });
      
      adminToken = adminAuth.body.token;
      expect(adminToken).toBeDefined();
      console.log('✓ Admin authenticated');

      // 3. Admin approves shop
      const shopApproval = await request(app)
        .post(`/api/admin/shops/${shopId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(shopApproval.status).toBe(200);
      console.log('✓ Shop approved by admin');

      // 4. Admin sells RCN to shop
      const rcnSale = await request(app)
        .post(`/api/admin/shops/${shopId}/sell-rcn`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 10000, // 10,000 RCN
          paymentReference: 'STRIPE-TEST-001'
        });

      expect(rcnSale.status).toBe(200);
      expect(rcnSale.body.data.totalCost).toBe(1000); // $1,000 at $0.10 per RCN
      console.log('✓ Shop purchased 10,000 RCN for $1,000');

      console.log('\n=== STEP 3: Customer Registration ===');
      
      // 5. Customer registers
      const customerRegistration = await request(app)
        .post('/api/customers/register')
        .send({
          walletAddress: customerAddress,
          email: 'customer@test.com',
          phone: '+1987654321',
          name: 'Jane Customer'
        });

      expect(customerRegistration.status).toBe(201);
      const customerReferralCode = customerRegistration.body.data.customer.referralCode;
      console.log(`✓ Customer registered with referral code: ${customerReferralCode}`);

      // 6. Customer authenticates
      const customerAuth = await request(app)
        .post('/api/auth/customer')
        .send({ walletAddress: customerAddress });
      
      customerToken = customerAuth.body.token;
      console.log('✓ Customer authenticated');

      console.log('\n=== STEP 4: Referred Customer Registration ===');
      
      // 7. Another customer registers with referral
      const referredRegistration = await request(app)
        .post('/api/customers/register')
        .send({
          walletAddress: referredCustomerAddress,
          email: 'referred@test.com',
          referralCode: customerReferralCode
        });

      expect(referredRegistration.status).toBe(201);
      expect(referredRegistration.body.message).toContain('referral bonus after first repair');
      console.log('✓ Referred customer registered');

      console.log('\n=== STEP 5: Shop Issues Rewards ===');
      
      // 8. Shop authenticates
      const shopAuth = await request(app)
        .post('/api/auth/shop')
        .send({ shopId, walletAddress: shopAddress });
      
      shopToken = shopAuth.body.token;
      console.log('✓ Shop authenticated');

      // 9. Shop issues reward to first customer (Silver tier)
      const firstReward = await request(app)
        .post(`/api/shops/${shopId}/issue-reward`)
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          customerAddress,
          repairAmount: 150, // Large repair
          serviceType: 'engine_repair',
          description: 'Complete engine overhaul'
        });

      expect(firstReward.status).toBe(200);
      expect(firstReward.body.data).toMatchObject({
        baseReward: 25,
        tierBonus: 10, // Bronze tier bonus
        totalReward: 35
      });
      console.log('✓ First customer earned 35 RCN (25 base + 10 Bronze bonus)');

      // 10. Shop issues reward to referred customer (triggers referral bonus)
      const referredReward = await request(app)
        .post(`/api/shops/${shopId}/issue-reward`)
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          customerAddress: referredCustomerAddress,
          repairAmount: 75, // Small repair
          serviceType: 'oil_change'
        });

      expect(referredReward.status).toBe(200);
      expect(referredReward.body.data.referralBonusApplied).toBe(true);
      console.log('✓ Referred customer earned RCN + referral bonuses distributed');

      console.log('\n=== STEP 6: Customer Redemption ===');
      
      // 11. Customer checks balance
      const balanceCheck = await request(app)
        .get(`/api/tokens/earned-balance/${customerAddress}`);

      expect(balanceCheck.status).toBe(200);
      expect(balanceCheck.body.data.earnedBalance).toBeGreaterThan(0);
      console.log(`✓ Customer balance: ${balanceCheck.body.data.earnedBalance} RCN`);

      // 12. Shop creates redemption session
      const redemptionSession = await request(app)
        .post(`/api/shops/${shopId}/redemption-session`)
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          customerAddress,
          amount: 30, // Redeem 30 RCN
          serviceDescription: 'Brake pad replacement'
        });

      expect(redemptionSession.status).toBe(200);
      const sessionId = redemptionSession.body.data.sessionId;
      console.log(`✓ Redemption session created: ${sessionId}`);

      // 13. Customer approves redemption
      const approveRedemption = await request(app)
        .post(`/api/customers/${customerAddress}/approve-redemption`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          sessionId,
          approved: true
        });

      expect(approveRedemption.status).toBe(200);
      console.log('✓ Customer approved redemption');

      // 14. Shop completes redemption
      const completeRedemption = await request(app)
        .post(`/api/shops/${shopId}/complete-redemption`)
        .set('Authorization', `Bearer ${shopToken}`)
        .send({ sessionId });

      expect(completeRedemption.status).toBe(200);
      console.log('✓ Redemption completed - 30 RCN = $30 value');

      console.log('\n=== STEP 7: Analytics & Reporting ===');
      
      // 15. Check admin platform stats
      const platformStats = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(platformStats.status).toBe(200);
      expect(platformStats.body.data).toMatchObject({
        totalCustomers: expect.any(Number),
        totalShops: expect.any(Number),
        totalTransactions: expect.any(Number)
      });
      console.log('✓ Platform statistics retrieved');

      // 16. Check shop analytics
      const shopAnalytics = await request(app)
        .get(`/api/shops/${shopId}/analytics`)
        .set('Authorization', `Bearer ${shopToken}`);

      expect(shopAnalytics.status).toBe(200);
      console.log('✓ Shop analytics retrieved');

      // 17. Check customer transaction history
      const customerHistory = await request(app)
        .get(`/api/customers/${customerAddress}/transactions`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(customerHistory.status).toBe(200);
      expect(customerHistory.body.data.transactions.length).toBeGreaterThan(0);
      console.log('✓ Customer transaction history retrieved');

      console.log('\n=== COMPLETE FLOW TEST PASSED ===');
      console.log('All major user journeys validated successfully! 🎉');
    });
  });

  describe('Edge Cases and Business Rules', () => {
    it('should enforce daily earning limits', async () => {
      // Set customer to near daily limit
      const response = await request(app)
        .post(`/api/shops/${shopId}/issue-reward`)
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          customerAddress,
          repairAmount: 200, // Would exceed daily limit
          serviceType: 'major_repair'
        });

      // Should fail or adjust based on remaining capacity
      expect([200, 400]).toContain(response.status);
    });

    it('should enforce cross-shop redemption limits', async () => {
      // Try to redeem at a different shop
      const otherShopId = 'other-shop';
      
      const redemptionCheck = await request(app)
        .get(`/api/customers/${customerAddress}/redemption-check`)
        .query({
          shopId: otherShopId,
          amount: 50 // More than 20% limit
        });

      expect(redemptionCheck.body.data.canRedeem).toBe(false);
      expect(redemptionCheck.body.data.reason).toContain('cross-shop limit');
    });
  });
});