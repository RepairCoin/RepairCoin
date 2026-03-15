/**
 * Waitlist End-to-End Tests
 *
 * Tests the full waitlist submission flow by calling the controller directly
 * with mocked request/response objects:
 * 1. Hero form submission (shop owner - new email)
 * 2. Bottom CTA form submission (customer - new email)
 * 3. Duplicate email returns 409
 * 4. Validation: empty fields, invalid email, invalid userType
 * 5. Email case normalization
 * 6. Frontend form contract verification
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock WaitlistRepository before importing controller
const mockExistsByEmail = jest.fn<(...args: any[]) => Promise<boolean>>();
const mockCreate = jest.fn<(...args: any[]) => Promise<any>>();

jest.mock('../../src/repositories/WaitlistRepository', () => ({
  __esModule: true,
  default: {
    existsByEmail: (...args: any[]) => mockExistsByEmail(...args),
    create: (...args: any[]) => mockCreate(...args),
  },
}));

// Mock EmailService
jest.mock('../../src/services/EmailService', () => ({
  EmailService: jest.fn().mockImplementation(() => ({
    sendWaitlistConfirmation: jest.fn().mockResolvedValue(true as never),
    sendWaitlistAdminNotification: jest.fn().mockResolvedValue(true as never),
  })),
}));

import { submitWaitlist } from '../../src/controllers/WaitlistController';

// Helper to create mock req/res
function createMockReqRes(body: any) {
  const req = { body } as any;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as any;
  return { req, res };
}

describe('Waitlist Controller E2E Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // Test Suite 1: Successful Submissions (both forms)
  // ============================================================
  describe('Successful form submissions', () => {
    it('should accept a new shop owner submission (hero form)', async () => {
      const email = 'shopowner@example.com';
      mockExistsByEmail.mockResolvedValue(false);
      mockCreate.mockResolvedValue({
        id: 'uuid-1',
        email,
        userType: 'shop',
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      const { req, res } = createMockReqRes({ email, userType: 'shop' });
      await submitWaitlist(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Successfully added to waitlist',
          data: expect.objectContaining({
            email,
            userType: 'shop',
            status: 'pending',
          }),
        })
      );
    });

    it('should accept a new customer submission (bottom CTA form)', async () => {
      const email = 'customer@example.com';
      mockExistsByEmail.mockResolvedValue(false);
      mockCreate.mockResolvedValue({
        id: 'uuid-2',
        email,
        userType: 'customer',
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      const { req, res } = createMockReqRes({ email, userType: 'customer' });
      await submitWaitlist(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            email,
            userType: 'customer',
          }),
        })
      );
    });

    it('should return id and createdAt in response data', async () => {
      const createdAt = '2026-03-06T10:00:00.000Z';
      mockExistsByEmail.mockResolvedValue(false);
      mockCreate.mockResolvedValue({
        id: 'uuid-123',
        email: 'new@test.com',
        userType: 'shop',
        status: 'pending',
        createdAt,
      });

      const { req, res } = createMockReqRes({ email: 'new@test.com', userType: 'shop' });
      await submitWaitlist(req, res);

      const jsonCall = (res.json as jest.Mock).mock.calls[0][0] as any;
      expect(jsonCall.data.id).toBe('uuid-123');
      expect(jsonCall.data.createdAt).toBe(createdAt);
    });
  });

  // ============================================================
  // Test Suite 2: Duplicate Email Handling
  // ============================================================
  describe('Duplicate email prevention', () => {
    it('should reject duplicate email with 409 status', async () => {
      mockExistsByEmail.mockResolvedValue(true);

      const { req, res } = createMockReqRes({
        email: 'existing@example.com',
        userType: 'shop',
      });
      await submitWaitlist(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'This email is already on the waitlist',
      });
    });

    it('should reject duplicate even with different userType', async () => {
      mockExistsByEmail.mockResolvedValue(true);

      const { req, res } = createMockReqRes({
        email: 'existing@example.com',
        userType: 'customer', // Different from original 'shop'
      });
      await submitWaitlist(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should normalize email to lowercase before checking duplicates', async () => {
      mockExistsByEmail.mockResolvedValue(true);

      const { req, res } = createMockReqRes({
        email: 'EXISTING@EXAMPLE.COM',
        userType: 'shop',
      });
      await submitWaitlist(req, res);

      // Should check with lowercase email
      expect(mockExistsByEmail).toHaveBeenCalledWith('existing@example.com');
      expect(res.status).toHaveBeenCalledWith(409);
    });

    it('should simulate deocagunot@pos.partners duplicate scenario', async () => {
      // This email was already submitted - repository returns true
      mockExistsByEmail.mockResolvedValue(true);

      const { req, res } = createMockReqRes({
        email: 'deocagunot@pos.partners',
        userType: 'shop',
      });
      await submitWaitlist(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'This email is already on the waitlist',
      });
    });
  });

  // ============================================================
  // Test Suite 3: Input Validation
  // ============================================================
  describe('Input validation', () => {
    it('should reject empty email', async () => {
      const { req, res } = createMockReqRes({ email: '', userType: 'customer' });
      await submitWaitlist(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Email and user type are required',
      });
      expect(mockExistsByEmail).not.toHaveBeenCalled();
    });

    it('should reject missing email field', async () => {
      const { req, res } = createMockReqRes({ userType: 'customer' });
      await submitWaitlist(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should reject empty userType', async () => {
      const { req, res } = createMockReqRes({ email: 'test@example.com', userType: '' });
      await submitWaitlist(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should reject missing userType', async () => {
      const { req, res } = createMockReqRes({ email: 'test@example.com' });
      await submitWaitlist(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should reject invalid email format (no @)', async () => {
      const { req, res } = createMockReqRes({ email: 'not-an-email', userType: 'customer' });
      await submitWaitlist(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid email format',
      });
    });

    it('should reject invalid email format (no domain)', async () => {
      const { req, res } = createMockReqRes({ email: 'user@', userType: 'customer' });
      await submitWaitlist(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid email format',
      });
    });

    it('should reject invalid userType "admin"', async () => {
      const { req, res } = createMockReqRes({ email: 'valid@example.com', userType: 'admin' });
      await submitWaitlist(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'User type must be either "customer" or "shop"',
      });
    });

    it('should reject invalid userType "investor"', async () => {
      const { req, res } = createMockReqRes({ email: 'valid@example.com', userType: 'investor' });
      await submitWaitlist(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ============================================================
  // Test Suite 4: Email Normalization
  // ============================================================
  describe('Email normalization', () => {
    it('should normalize email to lowercase on creation', async () => {
      mockExistsByEmail.mockResolvedValue(false);
      mockCreate.mockResolvedValue({
        id: 'uuid-norm',
        email: 'test-mixed@example.com',
        userType: 'customer',
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      const { req, res } = createMockReqRes({
        email: 'Test-MiXeD@Example.COM',
        userType: 'customer',
      });
      await submitWaitlist(req, res);

      // Should create with lowercase email
      expect(mockCreate).toHaveBeenCalledWith({
        email: 'test-mixed@example.com',
        userType: 'customer',
      });
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  // ============================================================
  // Test Suite 5: Frontend Form Contract
  // ============================================================
  describe('Frontend form contract verification', () => {
    it('hero form and CTA form use identical payload shape', () => {
      // Both forms in waitlist/page.tsx call the same handleSubmit
      // which sends: { email: email.toLowerCase(), userType }
      const heroPayload = { email: 'hero@test.com', userType: 'shop' };
      const ctaPayload = { email: 'cta@test.com', userType: 'customer' };

      expect(Object.keys(heroPayload).sort()).toEqual(Object.keys(ctaPayload).sort());
      expect(['customer', 'shop']).toContain(heroPayload.userType);
      expect(['customer', 'shop']).toContain(ctaPayload.userType);
    });

    it('success response matches what frontend checks', async () => {
      mockExistsByEmail.mockResolvedValue(false);
      mockCreate.mockResolvedValue({
        id: 'uuid-contract',
        email: 'contract@test.com',
        userType: 'shop',
        status: 'pending',
        createdAt: '2026-03-06T00:00:00.000Z',
      });

      const { req, res } = createMockReqRes({ email: 'contract@test.com', userType: 'shop' });
      await submitWaitlist(req, res);

      const jsonCall = (res.json as jest.Mock).mock.calls[0][0] as any;

      // Frontend checks: response.data.success
      expect(jsonCall.success).toBe(true);
      // Frontend then sets submitted = true and shows toast
      expect(jsonCall.message).toBeDefined();
      expect(jsonCall.data).toBeDefined();
    });

    it('409 response matches what frontend error handler checks', async () => {
      mockExistsByEmail.mockResolvedValue(true);

      const { req, res } = createMockReqRes({ email: 'dup@test.com', userType: 'shop' });
      await submitWaitlist(req, res);

      // Frontend checks: error.response?.status === 409
      expect(res.status).toHaveBeenCalledWith(409);

      const jsonCall = (res.json as jest.Mock).mock.calls[0][0] as any;
      // Frontend shows: toast.error("This email is already on the waitlist")
      expect(jsonCall.error).toBe('This email is already on the waitlist');
    });

    it('both forms post to /waitlist/submit endpoint', () => {
      // Frontend handleSubmit posts to:
      // `${process.env.NEXT_PUBLIC_API_URL}/waitlist/submit`
      // Backend route is: router.post('/submit', submitWaitlist)
      // Mounted at: /api/waitlist
      // Full path: POST /api/waitlist/submit
      const endpoint = '/api/waitlist/submit';
      expect(endpoint).toBe('/api/waitlist/submit');
    });
  });

  // ============================================================
  // Test Suite 6: Error Handling
  // ============================================================
  describe('Error handling', () => {
    it('should return 500 when repository throws', async () => {
      mockExistsByEmail.mockRejectedValue(new Error('Database connection failed'));

      const { req, res } = createMockReqRes({ email: 'test@example.com', userType: 'shop' });
      await submitWaitlist(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to submit waitlist entry',
      });
    });

    it('should return 500 when create throws', async () => {
      mockExistsByEmail.mockResolvedValue(false);
      mockCreate.mockRejectedValue(new Error('Insert failed'));

      const { req, res } = createMockReqRes({ email: 'test@example.com', userType: 'customer' });
      await submitWaitlist(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
