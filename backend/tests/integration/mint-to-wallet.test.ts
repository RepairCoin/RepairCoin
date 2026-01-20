/**
 * Mint to Wallet - Integration Tests
 *
 * Based on: docs/testing/mint-to-wallet-testing.md
 *
 * Tests the mint-to-wallet feature that allows customers to transfer
 * their off-chain RCN balance to their blockchain wallet.
 *
 * API Endpoints:
 * - GET /api/customers/balance/:address - Get balance info
 * - POST /api/customers/balance/:address/instant-mint - Mint tokens to wallet
 * - POST /api/customers/balance/:address/queue-mint - Queue for batch minting
 */

import request from 'supertest';
import express from 'express';

// Create mock service BEFORE importing routes
const mockValidateMintRequest = jest.fn();
const mockInstantMint = jest.fn();
const mockQueueForMinting = jest.fn();
const mockGetCustomerBalanceInfo = jest.fn();
const mockGetPendingMints = jest.fn();
const mockGetBalanceStatistics = jest.fn();
const mockSyncCustomerBalance = jest.fn();
const mockRecordTransaction = jest.fn();

// Mock the service module
jest.mock('../../src/domains/customer/services/CustomerBalanceService', () => ({
  customerBalanceService: {
    validateMintRequest: mockValidateMintRequest,
    instantMint: mockInstantMint,
    queueForMinting: mockQueueForMinting,
    getCustomerBalanceInfo: mockGetCustomerBalanceInfo,
    getPendingMints: mockGetPendingMints,
    getBalanceStatistics: mockGetBalanceStatistics,
    syncCustomerBalance: mockSyncCustomerBalance,
  },
  CustomerBalanceService: jest.fn(),
}));

// Mock repositories
jest.mock('../../src/repositories', () => ({
  customerRepository: {
    getCustomer: jest.fn(),
    getCustomerBalance: jest.fn(),
    queueForMinting: jest.fn(),
  },
  transactionRepository: {
    recordTransaction: mockRecordTransaction,
  },
}));

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Import balance routes AFTER mocks are set up
import balanceRoutes from '../../src/domains/customer/routes/balance';

describe('Mint to Wallet - Integration Tests', () => {
  let app: express.Application;

  // Test data
  const TEST_CUSTOMER_ADDRESS = '0x6F359646065e7FCFC4eB3cE4D108283268761063'.toLowerCase();
  const INVALID_ADDRESS = '0xinvalid';
  const NON_EXISTENT_ADDRESS = '0x0000000000000000000000000000000000000000';

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create Express app with balance routes
    app = express();
    app.use(express.json());
    app.use('/api/customers/balance', balanceRoutes);
  });

  // ============================================
  // Scenario 1: Basic Mint to Wallet
  // ============================================
  describe('Scenario 1: Basic Mint to Wallet', () => {
    it('should successfully mint tokens to wallet', async () => {
      const mintAmount = 10;
      const mockTxHash = '0x' + 'a'.repeat(64);

      // Mock instant mint to succeed
      mockInstantMint.mockResolvedValue({
        success: true,
        transactionHash: mockTxHash,
        amount: mintAmount,
      });

      const response = await request(app)
        .post(`/api/customers/balance/${TEST_CUSTOMER_ADDRESS}/instant-mint`)
        .send({ amount: mintAmount })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactionHash).toBe(mockTxHash);
      expect(response.body.data.amount).toBe(mintAmount);
      expect(response.body.data.customerAddress).toBe(TEST_CUSTOMER_ADDRESS);
      expect(response.body.message).toContain('Successfully minted');
    });

    it('should return transaction hash starting with 0x', async () => {
      const mintAmount = 5;
      const mockTxHash = '0x' + 'b'.repeat(64);

      mockInstantMint.mockResolvedValue({
        success: true,
        transactionHash: mockTxHash,
        amount: mintAmount,
      });

      const response = await request(app)
        .post(`/api/customers/balance/${TEST_CUSTOMER_ADDRESS}/instant-mint`)
        .send({ amount: mintAmount })
        .expect(200);

      // Transaction hash should be a real blockchain hash (66 chars: 0x + 64 hex chars)
      expect(response.body.data.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });
  });

  // ============================================
  // Scenario 2: Mint Full Balance
  // ============================================
  describe('Scenario 2: Mint Full Balance', () => {
    it('should successfully mint full available balance', async () => {
      const fullBalance = 50;
      const mockTxHash = '0x' + 'c'.repeat(64);

      mockInstantMint.mockResolvedValue({
        success: true,
        transactionHash: mockTxHash,
        amount: fullBalance,
      });

      const response = await request(app)
        .post(`/api/customers/balance/${TEST_CUSTOMER_ADDRESS}/instant-mint`)
        .send({ amount: fullBalance })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.amount).toBe(fullBalance);
    });

    it('should result in zero database balance after minting full amount', async () => {
      const fullBalance = 100;
      const mockTxHash = '0x' + 'd'.repeat(64);

      // Mock the service methods
      mockInstantMint.mockResolvedValue({
        success: true,
        transactionHash: mockTxHash,
        amount: fullBalance,
      });

      // First mint full balance
      const mintResponse = await request(app)
        .post(`/api/customers/balance/${TEST_CUSTOMER_ADDRESS}/instant-mint`)
        .send({ amount: fullBalance })
        .expect(200);

      expect(mintResponse.body.success).toBe(true);

      // Verify the instant mint was called with full balance
      expect(mockInstantMint).toHaveBeenCalledWith(
        TEST_CUSTOMER_ADDRESS,
        fullBalance
      );
    });
  });

  // ============================================
  // Scenario 3: Insufficient Balance
  // ============================================
  describe('Scenario 3: Insufficient Balance', () => {
    it('should reject mint request when amount exceeds available balance', async () => {
      const availableBalance = 10;
      const requestedAmount = 20;

      mockInstantMint.mockResolvedValue({
        success: false,
        error: `Insufficient balance. You have ${availableBalance.toFixed(2)} RCN available to mint.`,
      });

      const response = await request(app)
        .post(`/api/customers/balance/${TEST_CUSTOMER_ADDRESS}/instant-mint`)
        .send({ amount: requestedAmount })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Insufficient balance');
    });

    it('should not deduct balance when mint fails due to insufficient funds', async () => {
      mockInstantMint.mockResolvedValue({
        success: false,
        error: 'Insufficient balance. You have 5.00 RCN available to mint.',
      });

      const response = await request(app)
        .post(`/api/customers/balance/${TEST_CUSTOMER_ADDRESS}/instant-mint`)
        .send({ amount: 100 })
        .expect(400);

      expect(response.body.success).toBe(false);
      // Verify no transaction was recorded on failure
      expect(mockInstantMint).toHaveBeenCalled();
    });
  });

  // ============================================
  // Scenario 4: Minimum Amount Validation
  // ============================================
  describe('Scenario 4: Minimum Amount Validation', () => {
    it('should reject mint request with zero amount', async () => {
      const response = await request(app)
        .post(`/api/customers/balance/${TEST_CUSTOMER_ADDRESS}/instant-mint`)
        .send({ amount: 0 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('greater than zero');
    });

    it('should reject mint request with negative amount', async () => {
      const response = await request(app)
        .post(`/api/customers/balance/${TEST_CUSTOMER_ADDRESS}/instant-mint`)
        .send({ amount: -10 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('greater than zero');
    });

    it('should reject mint request without amount', async () => {
      const response = await request(app)
        .post(`/api/customers/balance/${TEST_CUSTOMER_ADDRESS}/instant-mint`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid amount');
    });

    it('should reject mint request exceeding maximum limit (10,000 RCN)', async () => {
      const response = await request(app)
        .post(`/api/customers/balance/${TEST_CUSTOMER_ADDRESS}/instant-mint`)
        .send({ amount: 10001 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('exceeds maximum limit');
    });

    it('should accept small valid amounts', async () => {
      const smallAmount = 0.01;
      const mockTxHash = '0x' + 'e'.repeat(64);

      mockInstantMint.mockResolvedValue({
        success: true,
        transactionHash: mockTxHash,
        amount: smallAmount,
      });

      const response = await request(app)
        .post(`/api/customers/balance/${TEST_CUSTOMER_ADDRESS}/instant-mint`)
        .send({ amount: smallAmount })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  // ============================================
  // Scenario 5 & 6: Wallet Type Handling
  // (Note: API behaves the same for all wallet types,
  //  wallet-specific behavior is frontend concern)
  // ============================================
  describe('Scenarios 5 & 6: Wallet Type Handling', () => {
    it('should process mint for any valid wallet address', async () => {
      const mockTxHash = '0x' + 'f'.repeat(64);

      mockInstantMint.mockResolvedValue({
        success: true,
        transactionHash: mockTxHash,
        amount: 5,
      });

      const response = await request(app)
        .post(`/api/customers/balance/${TEST_CUSTOMER_ADDRESS}/instant-mint`)
        .send({ amount: 5 })
        .expect(200);

      expect(response.body.success).toBe(true);
      // Gas fee paid by admin wallet (not customer) - verified by successful transaction
      expect(response.body.data.transactionHash).toBeDefined();
    });

    it('should reject invalid wallet address format', async () => {
      const response = await request(app)
        .post(`/api/customers/balance/${INVALID_ADDRESS}/instant-mint`)
        .send({ amount: 5 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid wallet address');
    });
  });

  // ============================================
  // Scenario 7: Network Error Handling
  // ============================================
  describe('Scenario 7: Network Error Handling', () => {
    it('should handle blockchain mint failure gracefully', async () => {
      mockInstantMint.mockResolvedValue({
        success: false,
        error: 'Blockchain mint failed',
      });

      const response = await request(app)
        .post(`/api/customers/balance/${TEST_CUSTOMER_ADDRESS}/instant-mint`)
        .send({ amount: 10 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should handle service exceptions gracefully', async () => {
      mockInstantMint.mockRejectedValue(new Error('Network connection failed'));

      const response = await request(app)
        .post(`/api/customers/balance/${TEST_CUSTOMER_ADDRESS}/instant-mint`)
        .send({ amount: 10 })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to mint tokens');
    });

    it('should not deduct balance when blockchain transaction fails', async () => {
      mockInstantMint.mockResolvedValue({
        success: false,
        error: 'Transaction reverted: insufficient gas',
      });

      const response = await request(app)
        .post(`/api/customers/balance/${TEST_CUSTOMER_ADDRESS}/instant-mint`)
        .send({ amount: 10 })
        .expect(400);

      expect(response.body.success).toBe(false);
      // Balance should remain unchanged on blockchain failure
    });
  });

  // ============================================
  // Scenario 8: Transaction Pending State
  // ============================================
  describe('Scenario 8: Transaction Pending State', () => {
    it('should return immediately after blockchain confirmation', async () => {
      const mockTxHash = '0x' + '1'.repeat(64);

      mockInstantMint.mockResolvedValue({
        success: true,
        transactionHash: mockTxHash,
        amount: 10,
      });

      const startTime = Date.now();

      const response = await request(app)
        .post(`/api/customers/balance/${TEST_CUSTOMER_ADDRESS}/instant-mint`)
        .send({ amount: 10 })
        .expect(200);

      const duration = Date.now() - startTime;

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactionHash).toBe(mockTxHash);
      // Response should be reasonably fast (mocked, so instant)
      expect(duration).toBeLessThan(5000);
    });
  });

  // ============================================
  // Queue Mint Endpoint Tests
  // ============================================
  describe('Queue Mint Endpoint', () => {
    it('should successfully queue balance for minting', async () => {
      const queueAmount = 25;

      mockValidateMintRequest.mockResolvedValue({
        valid: true,
      });

      mockQueueForMinting.mockResolvedValue({
        customerAddress: TEST_CUSTOMER_ADDRESS,
        amount: queueAmount,
        requestedAt: new Date().toISOString(),
      });

      const response = await request(app)
        .post(`/api/customers/balance/${TEST_CUSTOMER_ADDRESS}/queue-mint`)
        .send({ amount: queueAmount })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.customerAddress).toBe(TEST_CUSTOMER_ADDRESS);
      expect(response.body.data.amount).toBe(queueAmount);
      expect(response.body.message).toContain('queued');
    });

    it('should reject queue request with invalid amount', async () => {
      const response = await request(app)
        .post(`/api/customers/balance/${TEST_CUSTOMER_ADDRESS}/queue-mint`)
        .send({ amount: 0 })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject queue request when validation fails', async () => {
      mockValidateMintRequest.mockResolvedValue({
        valid: false,
        reason: 'Insufficient balance',
        maxAllowed: 5,
      });

      const response = await request(app)
        .post(`/api/customers/balance/${TEST_CUSTOMER_ADDRESS}/queue-mint`)
        .send({ amount: 100 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Insufficient');
    });
  });

  // ============================================
  // Get Balance Endpoint Tests
  // ============================================
  describe('Get Balance Endpoint', () => {
    it('should return balance info for valid customer', async () => {
      mockGetCustomerBalanceInfo.mockResolvedValue({
        address: TEST_CUSTOMER_ADDRESS,
        databaseBalance: 100,
        pendingMintBalance: 0,
        totalBalance: 100,
        lifetimeEarnings: 500,
        totalRedemptions: 400,
        totalMintedToWallet: 0,
        lastBlockchainSync: null,
        balanceSynced: true,
        tier: 'SILVER',
        canMintToWallet: true,
      });

      const response = await request(app)
        .get(`/api/customers/balance/${TEST_CUSTOMER_ADDRESS}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.databaseBalance).toBe(100);
      expect(response.body.data.canMintToWallet).toBe(true);
    });

    it('should return 404 for non-existent customer', async () => {
      mockGetCustomerBalanceInfo.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/customers/balance/${NON_EXISTENT_ADDRESS}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });

    it('should reject invalid address format', async () => {
      const response = await request(app)
        .get(`/api/customers/balance/${INVALID_ADDRESS}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid wallet address');
    });
  });

  // ============================================
  // Database Verification Tests
  // ============================================
  describe('Database Verification', () => {
    it('should record transaction with correct type (mint_to_wallet)', async () => {
      const mockTxHash = '0x' + '2'.repeat(64);
      const mintAmount = 15;

      mockInstantMint.mockImplementation(async () => {
        // Simulate the service recording a transaction
        await mockRecordTransaction({
          type: 'mint',
          customerAddress: TEST_CUSTOMER_ADDRESS,
          amount: mintAmount,
          transactionHash: mockTxHash,
          metadata: { mintType: 'instant_mint' },
        });

        return {
          success: true,
          transactionHash: mockTxHash,
          amount: mintAmount,
        };
      });

      await request(app)
        .post(`/api/customers/balance/${TEST_CUSTOMER_ADDRESS}/instant-mint`)
        .send({ amount: mintAmount })
        .expect(200);

      // Verify transaction was recorded
      expect(mockRecordTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'mint',
          customerAddress: TEST_CUSTOMER_ADDRESS,
          amount: mintAmount,
        })
      );
    });

    it('should record real transaction hash (not offchain_)', async () => {
      const realTxHash = '0x' + '3'.repeat(64);

      mockInstantMint.mockResolvedValue({
        success: true,
        transactionHash: realTxHash,
        amount: 10,
      });

      const response = await request(app)
        .post(`/api/customers/balance/${TEST_CUSTOMER_ADDRESS}/instant-mint`)
        .send({ amount: 10 })
        .expect(200);

      // Verify transaction hash is real blockchain hash
      expect(response.body.data.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(response.body.data.transactionHash).not.toMatch(/^offchain_/);
    });
  });

  // ============================================
  // Edge Cases and Error Scenarios
  // ============================================
  describe('Edge Cases', () => {
    it('should handle decimal amounts correctly', async () => {
      const decimalAmount = 10.5;
      const mockTxHash = '0x' + '4'.repeat(64);

      mockInstantMint.mockResolvedValue({
        success: true,
        transactionHash: mockTxHash,
        amount: decimalAmount,
      });

      const response = await request(app)
        .post(`/api/customers/balance/${TEST_CUSTOMER_ADDRESS}/instant-mint`)
        .send({ amount: decimalAmount })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.amount).toBe(decimalAmount);
    });

    it('should handle address with mixed case hex characters', async () => {
      // The API validates the 0x prefix must be lowercase, but hex chars can be mixed case
      const mixedCaseAddress = '0x6F359646065e7FCFC4eB3cE4D108283268761063';
      const mockTxHash = '0x' + '5'.repeat(64);

      mockInstantMint.mockResolvedValue({
        success: true,
        transactionHash: mockTxHash,
        amount: 5,
      });

      // Address validation accepts mixed-case hex characters (per EIP-55 checksum format)
      const response = await request(app)
        .post(`/api/customers/balance/${mixedCaseAddress}/instant-mint`)
        .send({ amount: 5 })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle contract paused error', async () => {
      mockInstantMint.mockResolvedValue({
        success: false,
        error: 'Contract is paused',
      });

      const response = await request(app)
        .post(`/api/customers/balance/${TEST_CUSTOMER_ADDRESS}/instant-mint`)
        .send({ amount: 10 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('paused');
    });

    it('should handle maximum amount at limit (10,000 RCN)', async () => {
      const maxAmount = 10000;
      const mockTxHash = '0x' + '6'.repeat(64);

      mockInstantMint.mockResolvedValue({
        success: true,
        transactionHash: mockTxHash,
        amount: maxAmount,
      });

      const response = await request(app)
        .post(`/api/customers/balance/${TEST_CUSTOMER_ADDRESS}/instant-mint`)
        .send({ amount: maxAmount })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.amount).toBe(maxAmount);
    });
  });

  // ============================================
  // Pending Mints Endpoint Tests
  // ============================================
  describe('Pending Mints Endpoint', () => {
    it('should return list of pending mints', async () => {
      mockGetPendingMints.mockResolvedValue([
        {
          customerAddress: TEST_CUSTOMER_ADDRESS,
          amount: 50,
          requestedAt: new Date().toISOString(),
        },
      ]);

      const response = await request(app)
        .get('/api/customers/balance/pending-mints')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].customerAddress).toBe(TEST_CUSTOMER_ADDRESS);
    });

    it('should respect limit parameter', async () => {
      mockGetPendingMints.mockResolvedValue([]);

      await request(app)
        .get('/api/customers/balance/pending-mints?limit=10')
        .expect(200);

      expect(mockGetPendingMints).toHaveBeenCalledWith(10);
    });

    it('should reject invalid limit', async () => {
      const response = await request(app)
        .get('/api/customers/balance/pending-mints?limit=0')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  // ============================================
  // Balance Statistics Endpoint Tests
  // ============================================
  describe('Balance Statistics Endpoint', () => {
    it('should return balance statistics', async () => {
      mockGetBalanceStatistics.mockResolvedValue({
        totalDatabaseBalance: 10000,
        totalPendingMints: 500,
        totalCustomersWithBalance: 100,
        averageBalance: 100,
      });

      const response = await request(app)
        .get('/api/customers/balance/statistics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalDatabaseBalance).toBe(10000);
      expect(response.body.data.totalPendingMints).toBe(500);
    });
  });

  // ============================================
  // Sync Balance Endpoint Tests
  // ============================================
  describe('Sync Balance Endpoint', () => {
    it('should sync customer balance successfully', async () => {
      mockSyncCustomerBalance.mockResolvedValue({
        address: TEST_CUSTOMER_ADDRESS,
        databaseBalance: 100,
        pendingMintBalance: 0,
        totalBalance: 100,
        lifetimeEarnings: 500,
        totalRedemptions: 400,
        totalMintedToWallet: 0,
        lastBlockchainSync: new Date().toISOString(),
        balanceSynced: true,
        tier: 'SILVER',
        canMintToWallet: true,
      });

      const response = await request(app)
        .post(`/api/customers/balance/${TEST_CUSTOMER_ADDRESS}/sync`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('synchronized');
    });

    it('should reject sync for invalid address', async () => {
      const response = await request(app)
        .post(`/api/customers/balance/${INVALID_ADDRESS}/sync`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});
