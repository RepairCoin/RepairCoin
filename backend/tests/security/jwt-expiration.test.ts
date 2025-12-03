/**
 * JWT Token Expiration Security Tests
 *
 * These tests verify that the authentication system properly rejects:
 * - Expired tokens (even from years ago)
 * - Tokens with invalid signatures
 * - Malformed tokens
 * - Tokens without required fields
 *
 * Critical Security Requirement:
 * Expired or previously used tokens must NEVER be accepted by the API.
 */

import jwt from 'jsonwebtoken';
import request from 'supertest';
import express, { Express } from 'express';
import cookieParser from 'cookie-parser';

// Import the actual auth middleware
import { authMiddleware, generateAccessToken, generateRefreshToken } from '../../src/middleware/auth';

describe('JWT Token Expiration Security', () => {
  let app: Express;
  const TEST_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-testing-purposes-only';

  // Store original env
  const originalEnv = process.env.JWT_SECRET;

  beforeAll(() => {
    // Set test JWT secret
    process.env.JWT_SECRET = TEST_SECRET;

    // Create test Express app with auth middleware
    app = express();
    app.use(express.json());
    app.use(cookieParser());

    // Protected test endpoint
    app.get('/api/test/protected', authMiddleware, (req, res) => {
      res.json({
        success: true,
        user: req.user,
        message: 'Access granted to protected resource'
      });
    });

    // Public endpoint for comparison
    app.get('/api/test/public', (req, res) => {
      res.json({ success: true, message: 'Public endpoint' });
    });
  });

  afterAll(() => {
    // Restore original env
    if (originalEnv) {
      process.env.JWT_SECRET = originalEnv;
    }
  });

  describe('Token Expiration Validation', () => {
    it('should REJECT token expired 4+ years ago (January 1, 2021)', async () => {
      // Create a token that expired on January 1, 2021
      const expiredToken = jwt.sign(
        {
          address: '0x1234567890abcdef1234567890abcdef12345678',
          role: 'customer',
          type: 'access',
          iat: Math.floor(new Date('2020-01-01').getTime() / 1000),
          exp: Math.floor(new Date('2021-01-01').getTime() / 1000) // Expired Jan 1, 2021
        },
        TEST_SECRET,
        { noTimestamp: true }
      );

      const response = await request(app)
        .get('/api/test/protected')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('TOKEN_EXPIRED');
    });

    it('should REJECT token expired 1 year ago', async () => {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const expiredToken = jwt.sign(
        {
          address: '0x1234567890abcdef1234567890abcdef12345678',
          role: 'customer',
          type: 'access'
        },
        TEST_SECRET,
        { expiresIn: '-1y' }
      );

      const response = await request(app)
        .get('/api/test/protected')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('TOKEN_EXPIRED');
    });

    it('should REJECT token expired 1 day ago', async () => {
      const expiredToken = jwt.sign(
        {
          address: '0x1234567890abcdef1234567890abcdef12345678',
          role: 'customer',
          type: 'access'
        },
        TEST_SECRET,
        { expiresIn: '-1d' }
      );

      const response = await request(app)
        .get('/api/test/protected')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('TOKEN_EXPIRED');
    });

    it('should REJECT token expired 1 hour ago', async () => {
      const expiredToken = jwt.sign(
        {
          address: '0x1234567890abcdef1234567890abcdef12345678',
          role: 'customer',
          type: 'access'
        },
        TEST_SECRET,
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .get('/api/test/protected')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('TOKEN_EXPIRED');
    });

    it('should REJECT token expired 1 minute ago', async () => {
      const expiredToken = jwt.sign(
        {
          address: '0x1234567890abcdef1234567890abcdef12345678',
          role: 'customer',
          type: 'access'
        },
        TEST_SECRET,
        { expiresIn: '-1m' }
      );

      const response = await request(app)
        .get('/api/test/protected')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('TOKEN_EXPIRED');
    });

    it('should REJECT token expired just 1 second ago', async () => {
      const expiredToken = jwt.sign(
        {
          address: '0x1234567890abcdef1234567890abcdef12345678',
          role: 'customer',
          type: 'access'
        },
        TEST_SECRET,
        { expiresIn: '-1s' }
      );

      const response = await request(app)
        .get('/api/test/protected')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('TOKEN_EXPIRED');
    });
  });

  describe('Token Signature Validation', () => {
    it('should REJECT token signed with wrong secret', async () => {
      const wrongSecretToken = jwt.sign(
        {
          address: '0x1234567890abcdef1234567890abcdef12345678',
          role: 'customer',
          type: 'access'
        },
        'wrong-secret-key',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/test/protected')
        .set('Authorization', `Bearer ${wrongSecretToken}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_TOKEN');
    });

    it('should REJECT tampered token (modified payload)', async () => {
      // Create a valid token
      const validToken = jwt.sign(
        {
          address: '0x1234567890abcdef1234567890abcdef12345678',
          role: 'customer',
          type: 'access'
        },
        TEST_SECRET,
        { expiresIn: '1h' }
      );

      // Tamper with the payload (change role to admin)
      const parts = validToken.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      payload.role = 'admin'; // Try to escalate privileges
      parts[1] = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const tamperedToken = parts.join('.');

      const response = await request(app)
        .get('/api/test/protected')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_TOKEN');
    });
  });

  describe('Malformed Token Validation', () => {
    it('should REJECT completely invalid token string', async () => {
      const response = await request(app)
        .get('/api/test/protected')
        .set('Authorization', 'Bearer not-a-valid-jwt-token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should REJECT token with missing parts', async () => {
      const response = await request(app)
        .get('/api/test/protected')
        .set('Authorization', 'Bearer header.payload'); // Missing signature

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should REJECT empty token', async () => {
      const response = await request(app)
        .get('/api/test/protected')
        .set('Authorization', 'Bearer ');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should REJECT request without Authorization header', async () => {
      const response = await request(app)
        .get('/api/test/protected');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('MISSING_AUTH_TOKEN');
    });

    it('should REJECT Authorization header without Bearer prefix', async () => {
      const validToken = jwt.sign(
        {
          address: '0x1234567890abcdef1234567890abcdef12345678',
          role: 'customer',
          type: 'access'
        },
        TEST_SECRET,
        { expiresIn: '1h' }
      );

      // Token without "Bearer " prefix is actually accepted by the middleware
      // (it strips "Bearer " if present, otherwise uses the whole string)
      // So this test verifies the token still needs to be valid
      const response = await request(app)
        .get('/api/test/protected')
        .set('Authorization', 'InvalidPrefix ' + validToken);

      // The middleware will try to verify "InvalidPrefix <token>" as a token
      expect(response.status).toBe(401);
    });
  });

  describe('Token Payload Validation', () => {
    it('should REJECT token without address field', async () => {
      const tokenWithoutAddress = jwt.sign(
        {
          role: 'customer',
          type: 'access'
        },
        TEST_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/test/protected')
        .set('Authorization', `Bearer ${tokenWithoutAddress}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_TOKEN_PAYLOAD');
    });

    it('should REJECT token without role field', async () => {
      const tokenWithoutRole = jwt.sign(
        {
          address: '0x1234567890abcdef1234567890abcdef12345678',
          type: 'access'
        },
        TEST_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/test/protected')
        .set('Authorization', `Bearer ${tokenWithoutRole}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_TOKEN_PAYLOAD');
    });

    it('should REJECT shop token without shopId', async () => {
      const shopTokenWithoutShopId = jwt.sign(
        {
          address: '0x1234567890abcdef1234567890abcdef12345678',
          role: 'shop',
          type: 'access'
          // Missing shopId
        },
        TEST_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/test/protected')
        .set('Authorization', `Bearer ${shopTokenWithoutShopId}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('MISSING_SHOP_ID');
    });
  });

  describe('Token Type Validation', () => {
    it('should REJECT refresh token used for API access', async () => {
      const refreshToken = jwt.sign(
        {
          address: '0x1234567890abcdef1234567890abcdef12345678',
          role: 'customer',
          type: 'refresh', // Wrong type - should be 'access'
          tokenId: 'test-token-id'
        },
        TEST_SECRET,
        { expiresIn: '7d' }
      );

      const response = await request(app)
        .get('/api/test/protected')
        .set('Authorization', `Bearer ${refreshToken}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_TOKEN_TYPE');
    });
  });

  describe('Token Generation Functions', () => {
    beforeAll(() => {
      process.env.JWT_SECRET = TEST_SECRET;
    });

    it('should generate access token with correct expiration (15 minutes)', () => {
      const accessToken = generateAccessToken({
        address: '0x1234567890abcdef1234567890abcdef12345678',
        role: 'customer'
      });

      const decoded = jwt.decode(accessToken) as any;

      expect(decoded.type).toBe('access');
      expect(decoded.address).toBe('0x1234567890abcdef1234567890abcdef12345678');
      expect(decoded.role).toBe('customer');

      // Check expiration is approximately 15 minutes from now
      const expiresIn = decoded.exp - decoded.iat;
      expect(expiresIn).toBe(15 * 60); // 15 minutes in seconds
    });

    it('should generate refresh token with correct expiration (7 days)', () => {
      const refreshToken = generateRefreshToken(
        {
          address: '0x1234567890abcdef1234567890abcdef12345678',
          role: 'customer'
        },
        'test-token-id'
      );

      const decoded = jwt.decode(refreshToken) as any;

      expect(decoded.type).toBe('refresh');
      expect(decoded.tokenId).toBe('test-token-id');
      expect(decoded.address).toBe('0x1234567890abcdef1234567890abcdef12345678');
      expect(decoded.role).toBe('customer');

      // Check expiration is approximately 7 days from now
      const expiresIn = decoded.exp - decoded.iat;
      expect(expiresIn).toBe(7 * 24 * 60 * 60); // 7 days in seconds
    });
  });

  describe('Cookie-based Authentication', () => {
    it('should REJECT expired token from cookie', async () => {
      const expiredToken = jwt.sign(
        {
          address: '0x1234567890abcdef1234567890abcdef12345678',
          role: 'customer',
          type: 'access'
        },
        TEST_SECRET,
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .get('/api/test/protected')
        .set('Cookie', `auth_token=${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('TOKEN_EXPIRED');
    });

    it('should prefer cookie token over Authorization header', async () => {
      // Create an expired token for cookie
      const expiredCookieToken = jwt.sign(
        {
          address: '0xexpired',
          role: 'customer',
          type: 'access'
        },
        TEST_SECRET,
        { expiresIn: '-1h' }
      );

      // Create a valid token for header (should be ignored)
      const validHeaderToken = jwt.sign(
        {
          address: '0xvalid',
          role: 'customer',
          type: 'access'
        },
        TEST_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/test/protected')
        .set('Cookie', `auth_token=${expiredCookieToken}`)
        .set('Authorization', `Bearer ${validHeaderToken}`);

      // Should fail because cookie (preferred) has expired token
      expect(response.status).toBe(401);
      expect(response.body.code).toBe('TOKEN_EXPIRED');
    });
  });

  describe('Edge Cases', () => {
    it('should handle token with exp set to 0 (epoch)', async () => {
      const epochToken = jwt.sign(
        {
          address: '0x1234567890abcdef1234567890abcdef12345678',
          role: 'customer',
          type: 'access',
          iat: 0,
          exp: 0
        },
        TEST_SECRET,
        { noTimestamp: true }
      );

      const response = await request(app)
        .get('/api/test/protected')
        .set('Authorization', `Bearer ${epochToken}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should handle token with negative exp', async () => {
      const negativeExpToken = jwt.sign(
        {
          address: '0x1234567890abcdef1234567890abcdef12345678',
          role: 'customer',
          type: 'access',
          iat: -1000,
          exp: -500
        },
        TEST_SECRET,
        { noTimestamp: true }
      );

      const response = await request(app)
        .get('/api/test/protected')
        .set('Authorization', `Bearer ${negativeExpToken}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should handle very large exp value (year 3000)', async () => {
      // This should still work - it's not expired
      const farFutureToken = jwt.sign(
        {
          address: '0x1234567890abcdef1234567890abcdef12345678',
          role: 'customer',
          type: 'access',
          exp: Math.floor(new Date('3000-01-01').getTime() / 1000)
        },
        TEST_SECRET
      );

      const response = await request(app)
        .get('/api/test/protected')
        .set('Authorization', `Bearer ${farFutureToken}`);

      // Will fail because user doesn't exist in database, but NOT because of expiration
      expect(response.body.code).not.toBe('TOKEN_EXPIRED');
    });
  });
});

describe('JWT Library Behavior Verification', () => {
  const TEST_SECRET = 'test-secret';

  it('jwt.verify() should throw TokenExpiredError for expired tokens', () => {
    const expiredToken = jwt.sign(
      { data: 'test' },
      TEST_SECRET,
      { expiresIn: '-1h' }
    );

    expect(() => {
      jwt.verify(expiredToken, TEST_SECRET);
    }).toThrow('jwt expired');
  });

  it('jwt.verify() should throw JsonWebTokenError for invalid signature', () => {
    const token = jwt.sign({ data: 'test' }, TEST_SECRET);

    expect(() => {
      jwt.verify(token, 'wrong-secret');
    }).toThrow('invalid signature');
  });

  it('jwt.verify() should throw JsonWebTokenError for malformed token', () => {
    expect(() => {
      jwt.verify('not.a.validtoken', TEST_SECRET);
    }).toThrow();
  });

  it('jwt.decode() does NOT verify - use jwt.verify() for security', () => {
    const expiredToken = jwt.sign(
      { data: 'test' },
      TEST_SECRET,
      { expiresIn: '-1h' }
    );

    // jwt.decode() does NOT check expiration - this is a security risk if used alone
    const decoded = jwt.decode(expiredToken);
    expect(decoded).not.toBeNull();

    // jwt.verify() DOES check expiration - this is what we use
    expect(() => {
      jwt.verify(expiredToken, TEST_SECRET);
    }).toThrow('jwt expired');
  });
});
