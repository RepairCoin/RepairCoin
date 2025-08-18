import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { RepairCoinApp } from '../app';

describe('Wallet Detection System Tests', () => {
  let app: express.Application;
  let server: any;
  
  // Test wallet addresses
  const ADMIN_ADDRESS = process.env.ADMIN_ADDRESSES?.split(',')[0] || '0x761E5E59485ec6feb263320f5d636042bD9EBc8c';
  const CUSTOMER_ADDRESS = '0x1234567890123456789012345678901234567890';
  const SHOP_ADDRESS = '0x7890123456789012345678901234567890123456';
  const UNREGISTERED_ADDRESS = '0x9999999999999999999999999999999999999999';
  const INVALID_ADDRESS = '0xinvalid';
  const SHORT_ADDRESS = '0x123';

  beforeAll(async () => {
    const repairCoinApp = new RepairCoinApp();
    await repairCoinApp.initialize();
    app = repairCoinApp.getApp();
    server = app.listen(0); // Use random port for testing
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  describe('Customer Wallet Detection', () => {
    it('should detect registered customer wallet', async () => {
      const response = await request(app)
        .get(`/api/customers/${CUSTOMER_ADDRESS}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.customer).toBeDefined();
      expect(response.body.data.customer.address.toLowerCase()).toBe(CUSTOMER_ADDRESS.toLowerCase());
    });

    it('should return 404 for unregistered customer wallet', async () => {
      const response = await request(app)
        .get(`/api/customers/${UNREGISTERED_ADDRESS}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });

    it('should validate customer address format', async () => {
      const response = await request(app)
        .get(`/api/customers/${INVALID_ADDRESS}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid Ethereum address');
    });

    it('should handle short addresses', async () => {
      const response = await request(app)
        .get(`/api/customers/${SHORT_ADDRESS}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Shop Wallet Detection', () => {
    it('should detect registered shop wallet', async () => {
      const response = await request(app)
        .get(`/api/shops/wallet/${SHOP_ADDRESS}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.walletAddress.toLowerCase()).toBe(SHOP_ADDRESS.toLowerCase());
    });

    it('should return 404 for unregistered shop wallet', async () => {
      const response = await request(app)
        .get(`/api/shops/wallet/${UNREGISTERED_ADDRESS}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Shop not found');
    });

    it('should validate shop address format', async () => {
      const response = await request(app)
        .get(`/api/shops/wallet/${INVALID_ADDRESS}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid');
    });
  });

  describe('Role Exclusivity', () => {
    it('should not allow same wallet to be both customer and shop', async () => {
      // First check if customer exists
      const customerResponse = await request(app)
        .get(`/api/customers/${CUSTOMER_ADDRESS}`)
        .expect(200);

      // Then verify same address is not a shop
      const shopResponse = await request(app)
        .get(`/api/shops/wallet/${CUSTOMER_ADDRESS}`)
        .expect(404);

      expect(customerResponse.body.success).toBe(true);
      expect(shopResponse.body.success).toBe(false);
    });

    it('should detect admin addresses correctly', async () => {
      // Admin addresses should not be registered as customers or shops
      const customerResponse = await request(app)
        .get(`/api/customers/${ADMIN_ADDRESS}`)
        .expect(404);

      const shopResponse = await request(app)
        .get(`/api/shops/wallet/${ADMIN_ADDRESS}`)
        .expect(404);

      expect(customerResponse.body.success).toBe(false);
      expect(shopResponse.body.success).toBe(false);
    });
  });

  describe('Case Sensitivity', () => {
    it('should handle uppercase addresses for customers', async () => {
      const response = await request(app)
        .get(`/api/customers/${CUSTOMER_ADDRESS.toUpperCase()}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.customer.address.toLowerCase()).toBe(CUSTOMER_ADDRESS.toLowerCase());
    });

    it('should handle lowercase addresses for shops', async () => {
      const response = await request(app)
        .get(`/api/shops/wallet/${SHOP_ADDRESS.toLowerCase()}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.walletAddress.toLowerCase()).toBe(SHOP_ADDRESS.toLowerCase());
    });

    it('should handle mixed case addresses', async () => {
      const mixedCase = '0x' + CUSTOMER_ADDRESS.slice(2).split('').map((c, i) => 
        i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()
      ).join('');

      const response = await request(app)
        .get(`/api/customers/${mixedCase}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Performance and Error Handling', () => {
    it('should handle concurrent requests', async () => {
      const promises = [
        request(app).get(`/api/customers/${CUSTOMER_ADDRESS}`),
        request(app).get(`/api/shops/wallet/${SHOP_ADDRESS}`),
        request(app).get(`/api/customers/${UNREGISTERED_ADDRESS}`),
        request(app).get(`/api/shops/wallet/${UNREGISTERED_ADDRESS}`)
      ];

      const responses = await Promise.all(promises);
      
      expect(responses[0].status).toBe(200);
      expect(responses[1].status).toBe(200);
      expect(responses[2].status).toBe(404);
      expect(responses[3].status).toBe(404);
    });

    it('should handle malformed requests gracefully', async () => {
      const response = await request(app)
        .get('/api/customers/')
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return appropriate headers', async () => {
      const response = await request(app)
        .get(`/api/customers/${CUSTOMER_ADDRESS}`)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.headers['x-request-id']).toBeDefined();
    });
  });

  describe('Data Integrity', () => {
    it('should return consistent data structure for customers', async () => {
      const response = await request(app)
        .get(`/api/customers/${CUSTOMER_ADDRESS}`)
        .expect(200);

      const { data } = response.body;
      
      // Verify required fields
      expect(data.customer).toHaveProperty('address');
      expect(data.customer).toHaveProperty('name');
      expect(data.customer).toHaveProperty('tier');
      expect(data.customer).toHaveProperty('lifetimeEarnings');
      expect(data).toHaveProperty('blockchainBalance');
      expect(data).toHaveProperty('tierBenefits');
    });

    it('should return consistent data structure for shops', async () => {
      const response = await request(app)
        .get(`/api/shops/wallet/${SHOP_ADDRESS}`)
        .expect(200);

      const { data } = response.body;
      
      // Verify required fields
      expect(data).toHaveProperty('shopId');
      expect(data).toHaveProperty('name');
      expect(data).toHaveProperty('walletAddress');
      expect(data).toHaveProperty('verified');
      expect(data).toHaveProperty('active');
      expect(data).toHaveProperty('purchasedRcnBalance');
    });
  });
});