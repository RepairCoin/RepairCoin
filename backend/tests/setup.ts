// Test setup file for all tests
import dotenv from 'dotenv';
import path from 'path';

// Load test environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.test') });

// Set test environment defaults
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
process.env.THIRDWEB_CLIENT_ID = process.env.THIRDWEB_CLIENT_ID || 'test-client-id';
process.env.THIRDWEB_SECRET_KEY = process.env.THIRDWEB_SECRET_KEY || 'test-secret-key';
process.env.REPAIRCOIN_CONTRACT_ADDRESS = process.env.REPAIRCOIN_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000';
process.env.PRIVATE_KEY = process.env.PRIVATE_KEY || '0000000000000000000000000000000000000000000000000000000000000000';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Global test utilities
global.testUtils = {
  generateWalletAddress: () => {
    const chars = '0123456789abcdef';
    let address = '0x';
    for (let i = 0; i < 40; i++) {
      address += chars[Math.floor(Math.random() * chars.length)];
    }
    return address;
  },
  
  generateTransactionHash: () => {
    const chars = '0123456789abcdef';
    let hash = '0x';
    for (let i = 0; i < 64; i++) {
      hash += chars[Math.floor(Math.random() * chars.length)];
    }
    return hash;
  },

  sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
};

// Clean up after all tests
afterAll(async () => {
  // Close any open handles
  await new Promise(resolve => setTimeout(resolve, 500));
});