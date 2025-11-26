import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, jest, beforeEach } from '@jest/globals';
import RepairCoinApp from '../../src/app';
import { CustomerRepository } from '../../src/repositories/CustomerRepository';
import { ShopRepository } from '../../src/repositories/ShopRepository';
import { RoleValidator } from '../../src/utils/roleValidator';
import { ReferralService } from '../../src/services/ReferralService';
import { UniquenessService } from '../../src/services/uniquenessService';

// Mock repositories and services BEFORE they are imported by the app
jest.mock('../../src/repositories/CustomerRepository');
jest.mock('../../src/repositories/ShopRepository');
jest.mock('../../src/repositories/AdminRepository');
jest.mock('../../src/repositories/TransactionRepository');
jest.mock('../../src/repositories/TreasuryRepository');
jest.mock('../../src/utils/roleValidator');
jest.mock('../../src/services/ReferralService');
jest.mock('../../src/services/uniquenessService');
jest.mock('thirdweb');

/**
 * Customer Registration Tests
 *
 * Tests customer registration endpoint: POST /api/customers/register
 *
 * Test coverage:
 * - Successful registration scenarios
 * - Validation errors (missing fields, invalid formats)
 * - Role conflict detection (shop, admin conflicts)
 * - Referral code processing
 * - Customer retrieval after registration
 * - Edge cases and error handling
 */
describe('Customer Registration Tests', () => {
  let app: any;
  const customerWalletAddress = '0x1234567890123456789012345678901234567890';
  const shopWalletAddress = '0x2345678901234567890123456789012345678901';
  const adminAddress = '0x742d35cc6634c0532925a3b844bc9e7595f12340';

  const validCustomerData = {
    walletAddress: customerWalletAddress,
    email: 'customer@example.com',
    phone: '+1234567890',
    name: 'John Customer'
  };

  const mockNewCustomer = {
    address: customerWalletAddress.toLowerCase(),
    email: validCustomerData.email,
    phone: validCustomerData.phone,
    name: validCustomerData.name,
    lifetimeEarnings: 0,
    tier: 'BRONZE',
    isActive: true,
    joinDate: new Date().toISOString(),
    lastEarnedDate: new Date().toISOString(),
    referralCount: 0,
    referralCode: 'CUST123ABC'
  };

  beforeAll(async () => {
    process.env.ADMIN_ADDRESSES = adminAddress;
    process.env.JWT_SECRET = 'test-secret-key-for-testing-purposes';
    process.env.NODE_ENV = 'test';

    const repairCoinApp = new RepairCoinApp();
    await repairCoinApp.initialize();
    app = repairCoinApp.app;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Default: Role validation passes (no conflicts)
    jest.spyOn(RoleValidator, 'validateCustomerRegistration')
      .mockResolvedValue({ isValid: true });

    // Default: Customer doesn't exist
    jest.spyOn(CustomerRepository.prototype, 'getCustomer')
      .mockResolvedValue(null);

    // Default: Shop doesn't exist for the address
    jest.spyOn(ShopRepository.prototype, 'getShopByWallet')
      .mockResolvedValue(null);

    // Default: Create customer succeeds
    jest.spyOn(CustomerRepository.prototype, 'createCustomer')
      .mockResolvedValue(undefined);

    // Default: Referral service returns success
    jest.spyOn(ReferralService.prototype, 'processReferral')
      .mockResolvedValue({ success: true, message: 'Referral processed' });

    // Default: Uniqueness checks pass
    jest.spyOn(UniquenessService.prototype, 'checkEmailUniqueness')
      .mockResolvedValue({ isUnique: true });
    jest.spyOn(UniquenessService.prototype, 'checkWalletUniqueness')
      .mockResolvedValue({ isUnique: true });
  });

  // ==========================================
  // Successful Registration Tests
  // ==========================================
  describe('POST /api/customers/register - Successful Registration', () => {
    it('should successfully register a new customer with all fields', async () => {
      const response = await request(app)
        .post('/api/customers/register')
        .send(validCustomerData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.address).toBe(customerWalletAddress.toLowerCase());
      expect(response.body.data.tier).toBe('BRONZE');
      expect(response.body.data.lifetimeEarnings).toBe(0);
      expect(response.body.data.isActive).toBe(true);
    });

    it('should register customer with only wallet address (minimal data)', async () => {
      const response = await request(app)
        .post('/api/customers/register')
        .send({ walletAddress: customerWalletAddress });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.address).toBe(customerWalletAddress.toLowerCase());
    });

    it('should normalize wallet address to lowercase', async () => {
      const upperCaseAddress = '0xABCDEF1234567890ABCDEF1234567890ABCDEF12';

      const response = await request(app)
        .post('/api/customers/register')
        .send({ walletAddress: upperCaseAddress });

      expect(response.status).toBe(201);
      expect(response.body.data.address).toBe(upperCaseAddress.toLowerCase());
    });

    it('should register customer with embedded wallet type', async () => {
      const response = await request(app)
        .post('/api/customers/register')
        .send({
          ...validCustomerData,
          walletType: 'embedded',
          authMethod: 'email'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should register customer with external wallet type', async () => {
      const response = await request(app)
        .post('/api/customers/register')
        .send({
          ...validCustomerData,
          walletType: 'external',
          authMethod: 'wallet'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });
  });

  // ==========================================
  // Validation Error Tests
  // ==========================================
  describe('POST /api/customers/register - Validation Errors', () => {
    it('should reject registration without wallet address', async () => {
      const response = await request(app)
        .post('/api/customers/register')
        .send({
          email: 'test@example.com',
          name: 'Test User'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('walletAddress');
    });

    it('should reject registration with empty wallet address', async () => {
      const response = await request(app)
        .post('/api/customers/register')
        .send({
          walletAddress: '',
          email: 'test@example.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject invalid Ethereum address format - too short', async () => {
      const response = await request(app)
        .post('/api/customers/register')
        .send({
          walletAddress: '0x1234',
          email: 'test@example.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('valid Ethereum address');
    });

    it('should reject invalid Ethereum address format - missing 0x prefix', async () => {
      const response = await request(app)
        .post('/api/customers/register')
        .send({
          walletAddress: '1234567890123456789012345678901234567890',
          email: 'test@example.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('valid Ethereum address');
    });

    it('should reject invalid Ethereum address format - invalid characters', async () => {
      const response = await request(app)
        .post('/api/customers/register')
        .send({
          walletAddress: '0xGGGG567890123456789012345678901234567890',
          email: 'test@example.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('valid Ethereum address');
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/api/customers/register')
        .send({
          ...validCustomerData,
          email: 'invalid-email-format'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('valid email');
    });

    it('should reject email without domain', async () => {
      const response = await request(app)
        .post('/api/customers/register')
        .send({
          ...validCustomerData,
          email: 'test@'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should accept registration without email (optional field)', async () => {
      const response = await request(app)
        .post('/api/customers/register')
        .send({
          walletAddress: customerWalletAddress,
          name: 'Test User'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });
  });

  // ==========================================
  // Role Conflict Tests
  // ==========================================
  describe('POST /api/customers/register - Role Conflicts', () => {
    it('should reject registration if wallet is already a customer', async () => {
      // Mock that customer already exists
      jest.spyOn(CustomerRepository.prototype, 'getCustomer')
        .mockResolvedValue(mockNewCustomer as any);

      const response = await request(app)
        .post('/api/customers/register')
        .send(validCustomerData);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already registered');
    });

    it('should reject registration if wallet is a shop', async () => {
      jest.spyOn(RoleValidator, 'validateCustomerRegistration')
        .mockResolvedValue({
          isValid: false,
          conflictingRole: 'shop',
          message: 'This wallet address is already registered as a shop (Test Shop) and cannot be used for customer registration'
        });

      const response = await request(app)
        .post('/api/customers/register')
        .send({
          ...validCustomerData,
          walletAddress: shopWalletAddress
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already registered as a shop');
      expect(response.body.conflictingRole).toBe('shop');
    });

    it('should reject registration if wallet is an admin', async () => {
      jest.spyOn(RoleValidator, 'validateCustomerRegistration')
        .mockResolvedValue({
          isValid: false,
          conflictingRole: 'admin',
          message: 'This wallet address is already registered as an admin and cannot be used for customer registration'
        });

      const response = await request(app)
        .post('/api/customers/register')
        .send({
          ...validCustomerData,
          walletAddress: adminAddress
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('admin');
      expect(response.body.conflictingRole).toBe('admin');
    });

    it('should reject registration if email is already used by another customer', async () => {
      jest.spyOn(RoleValidator, 'validateCustomerRegistration')
        .mockResolvedValue({
          isValid: false,
          conflictingRole: 'customer',
          message: 'This email address is already in use. Please use a different email or sign in to your existing customer account.'
        });

      const response = await request(app)
        .post('/api/customers/register')
        .send({
          ...validCustomerData,
          email: 'existing@example.com'
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already in use');
    });
  });

  // ==========================================
  // Referral Code Tests
  // ==========================================
  describe('POST /api/customers/register - Referral Codes', () => {
    it('should process valid referral code during registration', async () => {
      jest.spyOn(ReferralService.prototype, 'processReferral')
        .mockResolvedValue({
          success: true,
          message: 'Referral processed successfully'
        });

      const response = await request(app)
        .post('/api/customers/register')
        .send({
          ...validCustomerData,
          referralCode: 'REF123ABC'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(ReferralService.prototype.processReferral).toHaveBeenCalledWith(
        'REF123ABC',
        customerWalletAddress.toLowerCase(),
        expect.any(Object)
      );
    });

    it('should still register customer if referral code is invalid', async () => {
      jest.spyOn(ReferralService.prototype, 'processReferral')
        .mockResolvedValue({
          success: false,
          message: 'Invalid referral code'
        });

      const response = await request(app)
        .post('/api/customers/register')
        .send({
          ...validCustomerData,
          referralCode: 'INVALID_CODE'
        });

      // Registration should still succeed
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should still register customer if referral processing throws error', async () => {
      jest.spyOn(ReferralService.prototype, 'processReferral')
        .mockRejectedValue(new Error('Referral service error'));

      const response = await request(app)
        .post('/api/customers/register')
        .send({
          ...validCustomerData,
          referralCode: 'ERROR_CODE'
        });

      // Registration should still succeed - referral errors don't block registration
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should handle empty referral code gracefully', async () => {
      const response = await request(app)
        .post('/api/customers/register')
        .send({
          ...validCustomerData,
          referralCode: ''
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      // Should not call processReferral for empty code
      expect(ReferralService.prototype.processReferral).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // Customer Retrieval Tests
  // ==========================================
  describe('GET /api/customers/:address - Customer Retrieval', () => {
    it('should return 404 for non-existent customer', async () => {
      jest.spyOn(CustomerRepository.prototype, 'getCustomer')
        .mockResolvedValue(null);

      const response = await request(app)
        .get('/api/customers/0x0000000000000000000000000000000000000000');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Customer not found');
    });

    it('should validate address format in URL parameter', async () => {
      const response = await request(app)
        .get('/api/customers/invalid-address');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('valid Ethereum address');
    });

    it('should call getCustomer with lowercase address', async () => {
      const upperCaseAddress = '0xABCDEF1234567890ABCDEF1234567890ABCDEF12';

      // Even if getCustomer returns null, the middleware normalizes to lowercase
      jest.spyOn(CustomerRepository.prototype, 'getCustomer')
        .mockResolvedValue(null);

      await request(app)
        .get(`/api/customers/${upperCaseAddress}`);

      // Verify the address was normalized to lowercase when calling repository
      expect(CustomerRepository.prototype.getCustomer)
        .toHaveBeenCalledWith(upperCaseAddress.toLowerCase());
    });
  });

  // ==========================================
  // Customer Initial State Tests
  // ==========================================
  describe('POST /api/customers/register - Initial State Verification', () => {
    it('should create customer with correct initial values', async () => {
      let capturedCustomerData: any;

      jest.spyOn(CustomerRepository.prototype, 'createCustomer')
        .mockImplementation(async (data: any) => {
          capturedCustomerData = data;
          return undefined;
        });

      await request(app)
        .post('/api/customers/register')
        .send(validCustomerData);

      expect(capturedCustomerData).toBeDefined();
      expect(capturedCustomerData.lifetimeEarnings).toBe(0);
      expect(capturedCustomerData.tier).toBe('BRONZE');
      expect(capturedCustomerData.isActive).toBe(true);
      expect(capturedCustomerData.referralCount).toBe(0);
      expect(capturedCustomerData.address).toBe(customerWalletAddress.toLowerCase());
    });

    it('should set joinDate to current time', async () => {
      const beforeTime = new Date();

      let capturedCustomerData: any;
      jest.spyOn(CustomerRepository.prototype, 'createCustomer')
        .mockImplementation(async (data: any) => {
          capturedCustomerData = data;
          return undefined;
        });

      await request(app)
        .post('/api/customers/register')
        .send(validCustomerData);

      const afterTime = new Date();
      const joinDate = new Date(capturedCustomerData.joinDate);

      expect(joinDate.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(joinDate.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should set lastEarnedDate to current time', async () => {
      let capturedCustomerData: any;
      jest.spyOn(CustomerRepository.prototype, 'createCustomer')
        .mockImplementation(async (data: any) => {
          capturedCustomerData = data;
          return undefined;
        });

      await request(app)
        .post('/api/customers/register')
        .send(validCustomerData);

      expect(capturedCustomerData.lastEarnedDate).toBeDefined();
      expect(new Date(capturedCustomerData.lastEarnedDate).getTime()).not.toBeNaN();
    });
  });

  // ==========================================
  // Edge Cases and Error Handling
  // ==========================================
  describe('POST /api/customers/register - Edge Cases', () => {
    it('should handle database error during creation gracefully', async () => {
      jest.spyOn(CustomerRepository.prototype, 'createCustomer')
        .mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/customers/register')
        .send(validCustomerData);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should handle role validation service error', async () => {
      jest.spyOn(RoleValidator, 'validateCustomerRegistration')
        .mockRejectedValue(new Error('Role validation service unavailable'));

      const response = await request(app)
        .post('/api/customers/register')
        .send(validCustomerData);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should handle special characters in name field', async () => {
      const response = await request(app)
        .post('/api/customers/register')
        .send({
          ...validCustomerData,
          name: "O'Brien-Smith Jr."
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should handle unicode characters in name field', async () => {
      const response = await request(app)
        .post('/api/customers/register')
        .send({
          ...validCustomerData,
          name: '日本語名前 José García'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should handle very long name gracefully', async () => {
      const longName = 'A'.repeat(500);

      const response = await request(app)
        .post('/api/customers/register')
        .send({
          ...validCustomerData,
          name: longName
        });

      // Should either succeed or return validation error, not crash
      expect([201, 400]).toContain(response.status);
    });

    it('should handle phone number with various formats', async () => {
      const phoneFormats = [
        '+1-234-567-8901',
        '(234) 567-8901',
        '234.567.8901',
        '+44 20 7123 4567'
      ];

      for (const phone of phoneFormats) {
        const response = await request(app)
          .post('/api/customers/register')
          .send({
            walletAddress: `0x${Math.random().toString(16).substring(2, 42)}`,
            phone
          });

        // Registration should accept various phone formats
        expect([201, 400]).toContain(response.status);
      }
    });

    it('should handle concurrent registration attempts for same address', async () => {
      // First request succeeds
      jest.spyOn(CustomerRepository.prototype, 'getCustomer')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockNewCustomer as any);

      const [response1, response2] = await Promise.all([
        request(app)
          .post('/api/customers/register')
          .send(validCustomerData),
        request(app)
          .post('/api/customers/register')
          .send(validCustomerData)
      ]);

      // At least one should succeed, the other may fail with conflict
      const statuses = [response1.status, response2.status].sort();
      expect(statuses).toContain(201);
    });
  });

  // ==========================================
  // Additional Auth Method Tests
  // ==========================================
  describe('POST /api/customers/register - Auth Methods', () => {
    it('should accept google auth method', async () => {
      const response = await request(app)
        .post('/api/customers/register')
        .send({
          ...validCustomerData,
          authMethod: 'google'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should accept apple auth method', async () => {
      const response = await request(app)
        .post('/api/customers/register')
        .send({
          ...validCustomerData,
          authMethod: 'apple'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should default to wallet auth method when not specified', async () => {
      let capturedData: any;
      jest.spyOn(CustomerRepository.prototype, 'createCustomer')
        .mockImplementation(async (data: any) => {
          capturedData = data;
          return undefined;
        });

      await request(app)
        .post('/api/customers/register')
        .send(validCustomerData);

      expect(capturedData.auth_method).toBe('wallet');
    });

    it('should default to external wallet type when not specified', async () => {
      let capturedData: any;
      jest.spyOn(CustomerRepository.prototype, 'createCustomer')
        .mockImplementation(async (data: any) => {
          capturedData = data;
          return undefined;
        });

      await request(app)
        .post('/api/customers/register')
        .send(validCustomerData);

      expect(capturedData.wallet_type).toBe('external');
    });
  });

  // ==========================================
  // FixFlow Integration Tests
  // ==========================================
  describe('POST /api/customers/register - FixFlow Integration', () => {
    it('should accept fixflowCustomerId during registration', async () => {
      let capturedData: any;
      jest.spyOn(CustomerRepository.prototype, 'createCustomer')
        .mockImplementation(async (data: any) => {
          capturedData = data;
          return undefined;
        });

      const response = await request(app)
        .post('/api/customers/register')
        .send({
          ...validCustomerData,
          fixflowCustomerId: 'fixflow_cust_12345'
        });

      expect(response.status).toBe(201);
      expect(capturedData.fixflowCustomerId).toBe('fixflow_cust_12345');
    });

    it('should register without fixflowCustomerId', async () => {
      const response = await request(app)
        .post('/api/customers/register')
        .send(validCustomerData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });
  });

  // ==========================================
  // Response Format Tests
  // ==========================================
  describe('POST /api/customers/register - Response Format', () => {
    it('should return proper success response structure', async () => {
      const response = await request(app)
        .post('/api/customers/register')
        .send(validCustomerData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body.message).toContain('registered successfully');
    });

    it('should return proper error response structure', async () => {
      const response = await request(app)
        .post('/api/customers/register')
        .send({ email: 'test@example.com' }); // Missing walletAddress

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return customer data with all expected fields on success', async () => {
      const response = await request(app)
        .post('/api/customers/register')
        .send(validCustomerData);

      expect(response.status).toBe(201);
      const customerData = response.body.data;

      expect(customerData).toHaveProperty('address');
      expect(customerData).toHaveProperty('tier');
      expect(customerData).toHaveProperty('lifetimeEarnings');
      expect(customerData).toHaveProperty('isActive');
      expect(customerData).toHaveProperty('joinDate');
      expect(customerData).toHaveProperty('referralCount');
    });
  });

  // ==========================================
  // Security Tests
  // ==========================================
  describe('POST /api/customers/register - Security', () => {
    it('should reject SQL injection attempts in wallet address', async () => {
      const response = await request(app)
        .post('/api/customers/register')
        .send({
          walletAddress: "'; DROP TABLE customers; --"
        });

      expect(response.status).toBe(400);
    });

    it('should reject JavaScript URL in wallet address', async () => {
      const response = await request(app)
        .post('/api/customers/register')
        .send({
          walletAddress: 'javascript:alert(1)'
        });

      expect(response.status).toBe(400);
    });

    it('should handle null byte injection in wallet address', async () => {
      const response = await request(app)
        .post('/api/customers/register')
        .send({
          walletAddress: '0x1234567890123456789012345678901234567890\0extra'
        });

      // Should either reject due to invalid format or sanitize the null byte
      expect([400, 201]).toContain(response.status);
    });

    it('should handle extremely long input gracefully', async () => {
      const response = await request(app)
        .post('/api/customers/register')
        .send({
          walletAddress: customerWalletAddress,
          name: 'A'.repeat(10000)
        });

      // Should either succeed (with truncation) or reject
      expect([201, 400]).toContain(response.status);
      expect(response.body).toBeDefined();
    });

    it('should handle special characters in email field', async () => {
      const response = await request(app)
        .post('/api/customers/register')
        .send({
          walletAddress: customerWalletAddress,
          email: "test+special'chars@example.com"
        });

      // Valid email addresses with special chars before @ should work or be rejected
      expect([201, 400]).toContain(response.status);
    });
  });
});
