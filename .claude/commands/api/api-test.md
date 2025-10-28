# Test API Endpoints (RepairCoin)

Test RepairCoin backend API endpoints using Jest and supertest with proper authentication and domain-driven structure.

## Target Endpoint

$ARGUMENTS

---

## RepairCoin Testing Stack

- **Jest** - Test framework
- **Supertest** - HTTP testing
- **Mock Services** - Database/blockchain mocking
- **Integration Tests** - Full request/response cycle

## Test File Structure

`backend/tests/{domain}/{feature}.test.ts`

## Complete Test Template

\`\`\`typescript
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import RepairCoinApp from '../../src/app';
import { DatabaseService } from '../../src/services/DatabaseService';

// Mock external services
jest.mock('../../src/services/DatabaseService');
jest.mock('thirdweb');

describe('{Feature} API Tests', () => {
  let app: unknown;
  let adminToken: string;
  let shopToken: string;
  let customerToken: string;

  const testWallets = {
    admin: '0x742d35Cc6634C0532925a3b844Bc9e7595f1234',
    shop: '0x1234567890123456789012345678901234567890',
    customer: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
  };

  beforeAll(async () => {
    // Setup test environment
    process.env.ADMIN_ADDRESSES = testWallets.admin;
    process.env.JWT_SECRET = 'test-secret-key';
    process.env.NODE_ENV = 'test';

    // Initialize app
    const repairCoinApp = new RepairCoinApp();
    await repairCoinApp.initialize();
    app = repairCoinApp.app;

    // Get auth tokens
    const adminAuth = await request(app as any)
      .post('/api/auth/admin')
      .send({ walletAddress: testWallets.admin });
    adminToken = adminAuth.body.token;

    const shopAuth = await request(app as any)
      .post('/api/auth/shop')
      .send({ walletAddress: testWallets.shop });
    shopToken = shopAuth.body.token;

    const customerAuth = await request(app as any)
      .post('/api/auth/customer')
      .send({ walletAddress: testWallets.customer });
    customerToken = customerAuth.body.token;
  });

  afterAll(async () => {
    await DatabaseService.getInstance().cleanup();
  });

  describe('POST /api/{domain}/{endpoint}', () => {
    it('should create resource successfully', async () => {
      const response = await request(app as any)
        .post('/api/{domain}/{endpoint}')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          field1: 'value1',
          field2: 123
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.field1).toBe('value1');
    });

    it('should reject missing required fields', async () => {
      const response = await request(app as any)
        .post('/api/{domain}/{endpoint}')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });

    it('should reject invalid field format', async () => {
      const response = await request(app as any)
        .post('/api/{domain}/{endpoint}')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          field1: 'invalid-format'
        });

      expect(response.status).toBe(400);
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(app as any)
        .post('/api/{domain}/{endpoint}')
        .send({ field1: 'value1' });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Authentication');
    });

    it('should reject insufficient permissions', async () => {
      const response = await request(app as any)
        .post('/api/{domain}/{endpoint}')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ field1: 'value1' });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('permissions');
    });

    it('should reject invalid JWT token', async () => {
      const response = await request(app as any)
        .post('/api/{domain}/{endpoint}')
        .set('Authorization', 'Bearer invalid-token')
        .send({ field1: 'value1' });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid token');
    });
  });

  describe('GET /api/{domain}/{endpoint}/:id', () => {
    it('should retrieve resource by ID', async () => {
      const response = await request(app as any)
        .get('/api/{domain}/{endpoint}/123')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 for non-existent resource', async () => {
      const response = await request(app as any)
        .get('/api/{domain}/{endpoint}/nonexistent')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/{domain}/{endpoint}/:id', () => {
    it('should update resource', async () => {
      const response = await request(app as any)
        .put('/api/{domain}/{endpoint}/123')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ field1: 'updated-value' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /api/{domain}/{endpoint}/:id', () => {
    it('should delete resource', async () => {
      const response = await request(app as any)
        .delete('/api/{domain}/{endpoint}/123')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });
  });
});
\`\`\`

## Running Tests

\`\`\`bash
# Run all tests
cd backend && npm test

# Run specific domain tests
npm run test:admin
npm run test:customer
npm run test:shop

# Watch mode (TDD)
npm run test:watch

# Coverage report
npm run test:coverage
\`\`\`

## Test Checklist

- [ ] Test successful request (200)
- [ ] Test missing required fields (400)
- [ ] Test invalid field format (400)
- [ ] Test unauthenticated request (401)
- [ ] Test invalid token (401)
- [ ] Test insufficient permissions (403)
- [ ] Test not found (404)
- [ ] Test conflict/duplicate (409)
- [ ] Test with all relevant roles
- [ ] Mock external services
- [ ] Clean up after tests

## Examples

- Admin tests: `backend/tests/admin/admin.auth.test.ts`
- Shop tests: `backend/tests/shop/shop.operations.test.ts`
- Customer tests: `backend/tests/customer/`
- Integration: `backend/tests/integration/full-flow.test.ts`
