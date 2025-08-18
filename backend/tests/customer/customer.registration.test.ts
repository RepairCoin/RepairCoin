import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import RepairCoinApp from '../../src/app';
import { CustomerRepository } from '../../src/repositories/CustomerRepository';
import { ShopRepository } from '../../src/repositories/ShopRepository';
import { AdminRepository } from '../../src/repositories/AdminRepository';
import { ReferralRepository } from '../../src/repositories/ReferralRepository';

jest.mock('../../src/repositories/CustomerRepository');
jest.mock('../../src/repositories/ShopRepository');
jest.mock('../../src/repositories/AdminRepository');
jest.mock('../../src/repositories/ReferralRepository');
jest.mock('thirdweb');

describe('Customer Registration Tests', () => {
  let app: any;
  const customerWalletAddress = '0x1234567890123456789012345678901234567890';
  const shopWalletAddress = '0x2345678901234567890123456789012345678901';
  const adminAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f1234';

  const validCustomerData = {
    walletAddress: customerWalletAddress,
    email: 'customer@example.com',
    phone: '+1234567890',
    name: 'John Customer'
  };

  beforeAll(async () => {
    process.env.ADMIN_ADDRESSES = adminAddress;
    process.env.JWT_SECRET = 'test-secret';
    process.env.NODE_ENV = 'test';
    
    const repairCoinApp = new RepairCoinApp();
    await repairCoinApp.initialize();
    app = repairCoinApp.app;
  });

  describe('POST /api/customers/register', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should successfully register a new customer', async () => {
      // Mock role checks - wallet not registered anywhere
      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue(null);
      jest.spyOn(ShopRepository.prototype, 'getShopByWalletAddress')
        .mockResolvedValue(null);
      jest.spyOn(AdminRepository.prototype, 'isAdmin')
        .mockResolvedValue(false);
      
      // Mock successful customer creation
      jest.spyOn(CustomerRepository.prototype, 'createCustomer')
        .mockResolvedValue({
          address: validCustomerData.walletAddress,
          email: validCustomerData.email,
          phone: validCustomerData.phone,
          name: validCustomerData.name,
          lifetimeEarnings: 0,
          tier: 'BRONZE',
          isActive: true,
          joinDate: new Date().toISOString(),
          referralCode: 'CUST123'
        } as any);

      const response = await request(app)
        .post('/api/customers/register')
        .send(validCustomerData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.customer).toMatchObject({
        address: validCustomerData.walletAddress,
        email: validCustomerData.email,
        tier: 'BRONZE',
        lifetimeEarnings: 0
      });
      expect(response.body.data.customer.referralCode).toBeDefined();
    });

    it('should reject registration if wallet is already a customer', async () => {
      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue({
          address: customerWalletAddress,
          email: 'existing@example.com'
        } as any);

      const response = await request(app)
        .post('/api/customers/register')
        .send(validCustomerData);

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already registered');
    });

    it('should reject registration if wallet is a shop', async () => {
      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue(null);
      jest.spyOn(ShopRepository.prototype, 'getShopByWalletAddress')
        .mockResolvedValue({
          id: 'existing-shop',
          wallet_address: shopWalletAddress
        } as any);
      jest.spyOn(AdminRepository.prototype, 'isAdmin')
        .mockResolvedValue(false);

      const response = await request(app)
        .post('/api/customers/register')
        .send({
          ...validCustomerData,
          walletAddress: shopWalletAddress
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already registered as a shop');
      expect(response.body.conflictingRole).toBe('shop');
    });

    it('should reject registration if wallet is an admin', async () => {
      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue(null);
      jest.spyOn(ShopRepository.prototype, 'getShopByWalletAddress')
        .mockResolvedValue(null);
      jest.spyOn(AdminRepository.prototype, 'isAdmin')
        .mockResolvedValue(true);

      const response = await request(app)
        .post('/api/customers/register')
        .send({
          ...validCustomerData,
          walletAddress: adminAddress
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already registered as a admin');
      expect(response.body.conflictingRole).toBe('admin');
    });

    it('should validate required wallet address', async () => {
      const response = await request(app)
        .post('/api/customers/register')
        .send({
          email: 'test@example.com'
          // Missing walletAddress
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('walletAddress is required');
    });

    it('should validate wallet address format', async () => {
      const response = await request(app)
        .post('/api/customers/register')
        .send({
          ...validCustomerData,
          walletAddress: 'invalid-address'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid Ethereum address');
    });

    it('should validate email format if provided', async () => {
      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue(null);
      jest.spyOn(ShopRepository.prototype, 'getShopByWalletAddress')
        .mockResolvedValue(null);
      jest.spyOn(AdminRepository.prototype, 'isAdmin')
        .mockResolvedValue(false);

      const response = await request(app)
        .post('/api/customers/register')
        .send({
          ...validCustomerData,
          email: 'invalid-email'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid email');
    });

    it('should handle registration with referral code', async () => {
      const referrer = {
        address: '0x3456789012345678901234567890123456789012',
        referralCode: 'REF123',
        referralCount: 5
      };

      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue(null);
      jest.spyOn(ShopRepository.prototype, 'getShopByWalletAddress')
        .mockResolvedValue(null);
      jest.spyOn(AdminRepository.prototype, 'isAdmin')
        .mockResolvedValue(false);
      
      jest.spyOn(CustomerRepository.prototype, 'getCustomerByReferralCode')
        .mockResolvedValue(referrer as any);

      jest.spyOn(ReferralRepository.prototype, 'processReferral')
        .mockResolvedValue({
          success: true,
          referralId: 1
        } as any);

      jest.spyOn(CustomerRepository.prototype, 'createCustomer')
        .mockResolvedValue({
          ...validCustomerData,
          address: validCustomerData.walletAddress,
          referredBy: 'REF123'
        } as any);

      const response = await request(app)
        .post('/api/customers/register')
        .send({
          ...validCustomerData,
          referralCode: 'REF123'
        });

      expect(response.status).toBe(201);
      expect(response.body.data.customer.referredBy).toBe('REF123');
      expect(response.body.message).toContain('referral bonus after first repair');
    });

    it('should handle invalid referral code gracefully', async () => {
      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue(null);
      jest.spyOn(ShopRepository.prototype, 'getShopByWalletAddress')
        .mockResolvedValue(null);
      jest.spyOn(AdminRepository.prototype, 'isAdmin')
        .mockResolvedValue(false);
      
      jest.spyOn(CustomerRepository.prototype, 'getCustomerByReferralCode')
        .mockResolvedValue(null); // Invalid referral code

      jest.spyOn(CustomerRepository.prototype, 'createCustomer')
        .mockResolvedValue({
          ...validCustomerData,
          address: validCustomerData.walletAddress
        } as any);

      const response = await request(app)
        .post('/api/customers/register')
        .send({
          ...validCustomerData,
          referralCode: 'INVALID'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      // Should still register but without referral
      expect(response.body.data.customer.referredBy).toBeUndefined();
    });
  });

  describe('GET /api/customers/:address', () => {
    it('should retrieve customer information', async () => {
      const mockCustomer = {
        address: customerWalletAddress,
        email: 'customer@example.com',
        lifetimeEarnings: 500,
        tier: 'GOLD',
        dailyEarnings: 30,
        monthlyEarnings: 300,
        isActive: true,
        referralCount: 3,
        joinDate: '2025-01-01T00:00:00Z'
      };

      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue(mockCustomer as any);

      const response = await request(app)
        .get(`/api/customers/${customerWalletAddress}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.customer).toMatchObject(mockCustomer);
      expect(response.body.data).toHaveProperty('tierBenefits');
      expect(response.body.data).toHaveProperty('earningCapacity');
      expect(response.body.data).toHaveProperty('tierProgression');
    });

    it('should return 404 for non-existent customer', async () => {
      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue(null);

      const response = await request(app)
        .get('/api/customers/0x0000000000000000000000000000000000000000');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Customer not found');
    });

    it('should validate address format', async () => {
      const response = await request(app)
        .get('/api/customers/invalid-address');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid Ethereum address');
    });
  });

  describe('Customer Authentication', () => {
    it('should authenticate existing customer', async () => {
      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue({
          address: customerWalletAddress,
          email: 'customer@example.com',
          isActive: true
        } as any);

      const response = await request(app)
        .post('/api/auth/customer')
        .send({ walletAddress: customerWalletAddress });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toMatchObject({
        address: customerWalletAddress.toLowerCase(),
        role: 'customer'
      });
    });

    it('should reject authentication for suspended customer', async () => {
      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue({
          address: customerWalletAddress,
          isActive: false,
          suspendedAt: new Date().toISOString(),
          suspensionReason: 'Terms violation'
        } as any);

      const response = await request(app)
        .post('/api/auth/customer')
        .send({ walletAddress: customerWalletAddress });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('suspended');
    });

    it('should reject authentication for non-existent customer', async () => {
      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/customer')
        .send({ walletAddress: '0x0000000000000000000000000000000000000000' });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Customer not found');
    });
  });

  describe('Customer Initial State', () => {
    it('should create customer with correct initial values', async () => {
      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue(null);
      jest.spyOn(ShopRepository.prototype, 'getShopByWalletAddress')
        .mockResolvedValue(null);
      jest.spyOn(AdminRepository.prototype, 'isAdmin')
        .mockResolvedValue(false);

      let createdCustomer: any;
      jest.spyOn(CustomerRepository.prototype, 'createCustomer')
        .mockImplementation(async (data) => {
          createdCustomer = {
            ...data,
            joinDate: new Date().toISOString(),
            referralCode: `CUST${Date.now()}`
          };
          return createdCustomer;
        });

      await request(app)
        .post('/api/customers/register')
        .send(validCustomerData);

      expect(createdCustomer).toBeDefined();
      expect(createdCustomer).toMatchObject({
        lifetimeEarnings: 0,
        tier: 'BRONZE',
        dailyEarnings: 0,
        monthlyEarnings: 0,
        isActive: true,
        referralCount: 0
      });
      expect(createdCustomer.referralCode).toMatch(/^CUST\d+$/);
    });
  });
});