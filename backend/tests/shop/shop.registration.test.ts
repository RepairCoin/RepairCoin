import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import RepairCoinApp from '../../src/app';
import { ShopRepository } from '../../src/repositories/ShopRepository';
import { CustomerRepository } from '../../src/repositories/CustomerRepository';
import { AdminRepository } from '../../src/repositories/AdminRepository';

jest.mock('../../src/repositories/ShopRepository');
jest.mock('../../src/repositories/CustomerRepository');
jest.mock('../../src/repositories/AdminRepository');
jest.mock('thirdweb');

describe('Shop Registration Tests', () => {
  let app: any;
  const shopWalletAddress = '0x1234567890123456789012345678901234567890';
  const customerWalletAddress = '0x2345678901234567890123456789012345678901';
  const adminAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f1234';

  const validShopData = {
    shopId: 'test-auto-repair',
    walletAddress: shopWalletAddress,
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@testautorepair.com',
    phone: '+1234567890',
    companyName: 'Test Auto Repair',
    companySize: '11-50',
    monthlyRevenue: '$10k-$50k',
    role: 'owner',
    streetAddress: '123 Main St',
    city: 'Los Angeles',
    country: 'USA',
    website: 'https://testautorepair.com',
    acceptedTerms: true
  };

  beforeAll(async () => {
    process.env.ADMIN_ADDRESSES = adminAddress;
    process.env.JWT_SECRET = 'test-secret';
    process.env.NODE_ENV = 'test';
    
    const repairCoinApp = new RepairCoinApp();
    await repairCoinApp.initialize();
    app = repairCoinApp.app;
  });

  describe('POST /api/shops/register', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should successfully register a new shop', async () => {
      // Mock role checks - wallet not registered anywhere
      jest.spyOn(ShopRepository.prototype, 'getShopByWalletAddress')
        .mockResolvedValue(null);
      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue(null);
      jest.spyOn(AdminRepository.prototype, 'isAdmin')
        .mockResolvedValue(false);
      
      // Mock successful shop creation
      jest.spyOn(ShopRepository.prototype, 'createShop')
        .mockResolvedValue({
          id: validShopData.shopId,
          wallet_address: validShopData.walletAddress,
          company_name: validShopData.companyName,
          is_verified: false,
          is_active: true,
          join_date: new Date().toISOString()
        } as any);

      const response = await request(app)
        .post('/api/shops/register')
        .send(validShopData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.shop).toMatchObject({
        id: validShopData.shopId,
        wallet_address: validShopData.walletAddress,
        is_verified: false
      });
      expect(response.body.message).toContain('pending approval');
    });

    it('should reject registration if wallet is already a customer', async () => {
      // Mock wallet already registered as customer
      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue({
          address: customerWalletAddress,
          email: 'customer@example.com',
          isActive: true
        } as any);
      jest.spyOn(ShopRepository.prototype, 'getShopByWalletAddress')
        .mockResolvedValue(null);
      jest.spyOn(AdminRepository.prototype, 'isAdmin')
        .mockResolvedValue(false);

      const response = await request(app)
        .post('/api/shops/register')
        .send({
          ...validShopData,
          walletAddress: customerWalletAddress
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already registered as a customer');
      expect(response.body.conflictingRole).toBe('customer');
    });

    it('should reject registration if wallet is already a shop', async () => {
      // Mock wallet already registered as shop
      jest.spyOn(ShopRepository.prototype, 'getShopByWalletAddress')
        .mockResolvedValue({
          id: 'existing-shop',
          wallet_address: shopWalletAddress,
          is_verified: true
        } as any);

      const response = await request(app)
        .post('/api/shops/register')
        .send(validShopData);

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already registered');
    });

    it('should reject registration if wallet is an admin', async () => {
      jest.spyOn(AdminRepository.prototype, 'isAdmin')
        .mockResolvedValue(true);
      jest.spyOn(ShopRepository.prototype, 'getShopByWalletAddress')
        .mockResolvedValue(null);
      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue(null);

      const response = await request(app)
        .post('/api/shops/register')
        .send({
          ...validShopData,
          walletAddress: adminAddress
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already registered as a admin');
      expect(response.body.conflictingRole).toBe('admin');
    });

    it('should validate required fields', async () => {
      const incompleteData = {
        shopId: 'incomplete-shop',
        walletAddress: '0x3456789012345678901234567890123456789012'
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/shops/register')
        .send(incompleteData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/shops/register')
        .send({
          ...validShopData,
          email: 'invalid-email'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('email');
    });

    it('should validate wallet address format', async () => {
      const response = await request(app)
        .post('/api/shops/register')
        .send({
          ...validShopData,
          walletAddress: 'invalid-address'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid');
    });

    it('should require terms acceptance', async () => {
      const response = await request(app)
        .post('/api/shops/register')
        .send({
          ...validShopData,
          acceptedTerms: false
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('terms');
    });

    it('should validate company size options', async () => {
      const response = await request(app)
        .post('/api/shops/register')
        .send({
          ...validShopData,
          companySize: 'invalid-size'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('company size');
    });

    it('should validate monthly revenue options', async () => {
      const response = await request(app)
        .post('/api/shops/register')
        .send({
          ...validShopData,
          monthlyRevenue: 'invalid-revenue'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('monthly revenue');
    });

    it('should handle duplicate shop ID', async () => {
      jest.spyOn(ShopRepository.prototype, 'getShopByWalletAddress')
        .mockResolvedValue(null);
      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue(null);
      jest.spyOn(AdminRepository.prototype, 'isAdmin')
        .mockResolvedValue(false);
      
      // Mock shop ID already exists
      jest.spyOn(ShopRepository.prototype, 'getShopById')
        .mockResolvedValue({
          id: validShopData.shopId,
          wallet_address: '0x9999999999999999999999999999999999999999'
        } as any);

      const response = await request(app)
        .post('/api/shops/register')
        .send(validShopData);

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('Shop ID already exists');
    });

    it('should handle referral code if provided', async () => {
      jest.spyOn(ShopRepository.prototype, 'getShopByWalletAddress')
        .mockResolvedValue(null);
      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue(null);
      jest.spyOn(AdminRepository.prototype, 'isAdmin')
        .mockResolvedValue(false);
      
      jest.spyOn(ShopRepository.prototype, 'createShop')
        .mockResolvedValue({
          id: validShopData.shopId,
          referral_info: 'PARTNER123'
        } as any);

      const response = await request(app)
        .post('/api/shops/register')
        .send({
          ...validShopData,
          referralCode: 'PARTNER123'
        });

      expect(response.status).toBe(201);
      expect(ShopRepository.prototype.createShop).toHaveBeenCalledWith(
        expect.objectContaining({
          referral_info: 'PARTNER123'
        })
      );
    });
  });

  describe('GET /api/shops/wallet/:address', () => {
    it('should find shop by wallet address', async () => {
      const mockShop = {
        id: 'test-shop',
        wallet_address: shopWalletAddress,
        company_name: 'Test Shop',
        is_verified: true,
        is_active: true
      };

      jest.spyOn(ShopRepository.prototype, 'getShopByWalletAddress')
        .mockResolvedValue(mockShop as any);

      const response = await request(app)
        .get(`/api/shops/wallet/${shopWalletAddress}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.shop).toMatchObject(mockShop);
    });

    it('should return 404 if shop not found', async () => {
      jest.spyOn(ShopRepository.prototype, 'getShopByWalletAddress')
        .mockResolvedValue(null);

      const response = await request(app)
        .get('/api/shops/wallet/0x0000000000000000000000000000000000000000');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Shop not found');
    });

    it('should validate wallet address format', async () => {
      const response = await request(app)
        .get('/api/shops/wallet/invalid-address');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid');
    });
  });

  describe('Shop Status After Registration', () => {
    it('should create shop in pending state', async () => {
      jest.spyOn(ShopRepository.prototype, 'getShopByWalletAddress')
        .mockResolvedValue(null);
      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue(null);
      jest.spyOn(AdminRepository.prototype, 'isAdmin')
        .mockResolvedValue(false);
      
      let createdShop: any;
      jest.spyOn(ShopRepository.prototype, 'createShop')
        .mockImplementation(async (data) => {
          createdShop = {
            ...data,
            id: data.id,
            join_date: new Date().toISOString()
          };
          return createdShop;
        });

      await request(app)
        .post('/api/shops/register')
        .send(validShopData);

      expect(createdShop).toBeDefined();
      expect(createdShop.is_verified).toBe(false);
      expect(createdShop.is_active).toBe(true);
      expect(createdShop.purchased_rcn_balance).toBe(0);
      expect(createdShop.distributed_rcn).toBe(0);
    });
  });
});