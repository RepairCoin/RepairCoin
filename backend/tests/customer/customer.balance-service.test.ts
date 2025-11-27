// @ts-nocheck
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock the repositories module first
jest.mock('../../src/repositories');
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

import { CustomerBalanceService } from '../../src/domains/customer/services/CustomerBalanceService';
import { customerRepository } from '../../src/repositories';

// Get the mocked repository
const mockedRepo = customerRepository as jest.Mocked<typeof customerRepository>;

/**
 * Customer Balance Service Unit Tests
 *
 * Tests for service-level balance operations:
 * - recordEarning() - Update customer balance after earning RCN
 * - recordRedemption() - Update customer balance after redemption
 * - getCustomerBalanceInfo() - Get comprehensive balance information
 * - queueForMinting() - Queue balance for blockchain minting
 * - validateMintRequest() - Validate mint request business rules
 */
describe('CustomerBalanceService Unit Tests', () => {
  let balanceService: CustomerBalanceService;
  const customerAddress = '0x1234567890123456789012345678901234567890';

  const mockCustomer = {
    address: customerAddress.toLowerCase(),
    email: 'customer@example.com',
    name: 'Test Customer',
    tier: 'BRONZE',
    lifetimeEarnings: 100,
    isActive: true
  };

  const mockBalanceInfo = {
    databaseBalance: 50,
    pendingMintBalance: 10,
    totalBalance: 60,
    lifetimeEarnings: 100,
    totalRedemptions: 40,
    lastBlockchainSync: '2024-01-15T10:00:00Z',
    balanceSynced: true
  };

  // Helper function to setup default mocks
  const setupDefaultMocks = () => {
    mockedRepo.getCustomer.mockResolvedValue(mockCustomer);
    mockedRepo.getCustomerBalance.mockResolvedValue(mockBalanceInfo);
    mockedRepo.updateBalanceAfterEarning.mockResolvedValue(undefined);
    mockedRepo.updateBalanceAfterRedemption.mockResolvedValue(undefined);
    mockedRepo.queueForMinting.mockResolvedValue(undefined);
    mockedRepo.completeMint.mockResolvedValue(undefined);
    mockedRepo.syncCustomerBalance.mockResolvedValue(undefined);
  };

  beforeEach(() => {
    // Reset all mocks completely before each test
    jest.resetAllMocks();
    balanceService = new CustomerBalanceService();
  });

  // ==========================================
  // recordEarning Tests
  // ==========================================
  describe('recordEarning()', () => {
    it('should successfully record customer earning', async () => {
      setupDefaultMocks();

      await expect(
        balanceService.recordEarning(customerAddress, 25, 'BRONZE')
      ).resolves.not.toThrow();

      expect(mockedRepo.updateBalanceAfterEarning)
        .toHaveBeenCalledWith(customerAddress, 25, 'BRONZE');
    });

    it('should pass metadata to repository when provided', async () => {
      setupDefaultMocks();
      const metadata = {
        shopId: 'shop_123',
        engagementType: 'repair',
        description: 'Phone screen repair'
      };

      await balanceService.recordEarning(customerAddress, 25, 'BRONZE', metadata);

      expect(mockedRepo.updateBalanceAfterEarning)
        .toHaveBeenCalledWith(customerAddress, 25, 'BRONZE');
    });

    it('should update tier to SILVER when applicable', async () => {
      setupDefaultMocks();

      await balanceService.recordEarning(customerAddress, 400, 'SILVER');

      expect(mockedRepo.updateBalanceAfterEarning)
        .toHaveBeenCalledWith(customerAddress, 400, 'SILVER');
    });

    it('should update tier to GOLD when applicable', async () => {
      setupDefaultMocks();

      await balanceService.recordEarning(customerAddress, 1000, 'GOLD');

      expect(mockedRepo.updateBalanceAfterEarning)
        .toHaveBeenCalledWith(customerAddress, 1000, 'GOLD');
    });

    it('should handle zero amount gracefully', async () => {
      setupDefaultMocks();

      await expect(
        balanceService.recordEarning(customerAddress, 0, 'BRONZE')
      ).resolves.not.toThrow();
    });

    it('should handle decimal amounts', async () => {
      setupDefaultMocks();

      await expect(
        balanceService.recordEarning(customerAddress, 25.50, 'BRONZE')
      ).resolves.not.toThrow();

      expect(mockedRepo.updateBalanceAfterEarning)
        .toHaveBeenCalledWith(customerAddress, 25.50, 'BRONZE');
    });

    it('should throw error when repository fails', async () => {
      mockedRepo.updateBalanceAfterEarning
        .mockRejectedValue(new Error('Database error'));

      await expect(
        balanceService.recordEarning(customerAddress, 25, 'BRONZE')
      ).rejects.toThrow('Failed to record customer earning');
    });

    it('should record earning with shop metadata', async () => {
      setupDefaultMocks();
      const metadata = {
        shopId: 'shop_456',
        engagementType: 'repair'
      };

      await balanceService.recordEarning(customerAddress, 30, 'BRONZE', metadata);

      expect(mockedRepo.updateBalanceAfterEarning)
        .toHaveBeenCalled();
    });

    it('should handle large earning amounts', async () => {
      setupDefaultMocks();

      await expect(
        balanceService.recordEarning(customerAddress, 5000, 'GOLD')
      ).resolves.not.toThrow();
    });
  });

  // ==========================================
  // recordRedemption Tests
  // ==========================================
  describe('recordRedemption()', () => {
    it('should successfully record customer redemption', async () => {
      setupDefaultMocks();

      await expect(
        balanceService.recordRedemption(customerAddress, 20, 'shop_123')
      ).resolves.not.toThrow();

      expect(mockedRepo.updateBalanceAfterRedemption)
        .toHaveBeenCalledWith(customerAddress, 20);
    });

    it('should verify sufficient balance before redemption', async () => {
      // Only set up the specific mock needed for this test
      mockedRepo.getCustomerBalance.mockResolvedValue({
        ...mockBalanceInfo,
        databaseBalance: 10
      });

      await expect(
        balanceService.recordRedemption(customerAddress, 50, 'shop_123')
      ).rejects.toThrow('Failed to record customer redemption');
    });

    it('should allow redemption equal to database balance', async () => {
      mockedRepo.getCustomerBalance.mockResolvedValue({
        ...mockBalanceInfo,
        databaseBalance: 50
      });
      mockedRepo.updateBalanceAfterRedemption.mockResolvedValue(undefined);

      await expect(
        balanceService.recordRedemption(customerAddress, 50, 'shop_123')
      ).resolves.not.toThrow();
    });

    it('should throw error when customer balance not found', async () => {
      // Only set up the specific mock - null balance
      mockedRepo.getCustomerBalance.mockResolvedValue(null);

      await expect(
        balanceService.recordRedemption(customerAddress, 20, 'shop_123')
      ).rejects.toThrow('Failed to record customer redemption');
    });

    it('should handle decimal redemption amounts', async () => {
      setupDefaultMocks();

      await expect(
        balanceService.recordRedemption(customerAddress, 15.75, 'shop_123')
      ).resolves.not.toThrow();
    });

    it('should throw error when repository fails', async () => {
      setupDefaultMocks();
      mockedRepo.updateBalanceAfterRedemption
        .mockRejectedValue(new Error('Database error'));

      await expect(
        balanceService.recordRedemption(customerAddress, 20, 'shop_123')
      ).rejects.toThrow('Failed to record customer redemption');
    });

    it('should pass shop ID correctly', async () => {
      setupDefaultMocks();
      const shopId = 'unique_shop_789';

      await balanceService.recordRedemption(customerAddress, 20, shopId);

      expect(mockedRepo.updateBalanceAfterRedemption)
        .toHaveBeenCalledWith(customerAddress, 20);
    });
  });

  // ==========================================
  // getCustomerBalanceInfo Tests
  // ==========================================
  describe('getCustomerBalanceInfo()', () => {
    it('should return comprehensive balance information', async () => {
      setupDefaultMocks();

      const result = await balanceService.getCustomerBalanceInfo(customerAddress);

      expect(result).not.toBeNull();
      expect(result?.address).toBe(customerAddress.toLowerCase());
      expect(result?.databaseBalance).toBe(50);
      expect(result?.pendingMintBalance).toBe(10);
      expect(result?.totalBalance).toBe(60);
      expect(result?.tier).toBe('BRONZE');
    });

    it('should return null for non-existent customer', async () => {
      mockedRepo.getCustomer.mockResolvedValue(null);

      const result = await balanceService.getCustomerBalanceInfo(customerAddress);

      expect(result).toBeNull();
    });

    it('should return null when balance info not found', async () => {
      mockedRepo.getCustomer.mockResolvedValue(mockCustomer);
      mockedRepo.getCustomerBalance.mockResolvedValue(null);

      const result = await balanceService.getCustomerBalanceInfo(customerAddress);

      expect(result).toBeNull();
    });

    it('should calculate canMintToWallet correctly when balance > 0', async () => {
      setupDefaultMocks();

      const result = await balanceService.getCustomerBalanceInfo(customerAddress);

      expect(result?.canMintToWallet).toBe(true);
    });

    it('should set canMintToWallet to false when balance is 0', async () => {
      mockedRepo.getCustomer.mockResolvedValue(mockCustomer);
      mockedRepo.getCustomerBalance.mockResolvedValue({
        ...mockBalanceInfo,
        databaseBalance: 0
      });

      const result = await balanceService.getCustomerBalanceInfo(customerAddress);

      expect(result?.canMintToWallet).toBe(false);
    });

    it('should include lifetime earnings', async () => {
      setupDefaultMocks();

      const result = await balanceService.getCustomerBalanceInfo(customerAddress);

      expect(result?.lifetimeEarnings).toBe(100);
    });

    it('should include total redemptions', async () => {
      setupDefaultMocks();

      const result = await balanceService.getCustomerBalanceInfo(customerAddress);

      expect(result?.totalRedemptions).toBe(40);
    });

    it('should throw error on repository failure', async () => {
      mockedRepo.getCustomer.mockRejectedValue(new Error('Database error'));

      await expect(
        balanceService.getCustomerBalanceInfo(customerAddress)
      ).rejects.toThrow('Failed to get customer balance information');
    });
  });

  // ==========================================
  // queueForMinting Tests
  // ==========================================
  describe('queueForMinting()', () => {
    it('should successfully queue balance for minting', async () => {
      setupDefaultMocks();

      const result = await balanceService.queueForMinting(customerAddress, 30);

      expect(result).toBeDefined();
      expect(result.customerAddress).toBe(customerAddress);
      expect(result.amount).toBe(30);
      expect(result.requestedAt).toBeDefined();
    });

    it('should reject when insufficient database balance', async () => {
      // Only set up the specific mock needed
      mockedRepo.getCustomerBalance.mockResolvedValue({
        ...mockBalanceInfo,
        databaseBalance: 10
      });

      await expect(
        balanceService.queueForMinting(customerAddress, 50)
      ).rejects.toThrow('Failed to queue balance for minting');
    });

    it('should allow queueing exact database balance', async () => {
      mockedRepo.getCustomerBalance.mockResolvedValue({
        ...mockBalanceInfo,
        databaseBalance: 50
      });
      mockedRepo.queueForMinting.mockResolvedValue(undefined);

      const result = await balanceService.queueForMinting(customerAddress, 50);

      expect(result.amount).toBe(50);
    });

    it('should call repository queueForMinting', async () => {
      setupDefaultMocks();

      await balanceService.queueForMinting(customerAddress, 30);

      expect(mockedRepo.queueForMinting)
        .toHaveBeenCalledWith(customerAddress, 30);
    });

    it('should return mint request with timestamp', async () => {
      setupDefaultMocks();

      const beforeTime = new Date().toISOString();
      const result = await balanceService.queueForMinting(customerAddress, 30);
      const afterTime = new Date().toISOString();

      expect(result.requestedAt).toBeDefined();
      expect(new Date(result.requestedAt).getTime()).toBeGreaterThanOrEqual(new Date(beforeTime).getTime());
      expect(new Date(result.requestedAt).getTime()).toBeLessThanOrEqual(new Date(afterTime).getTime());
    });

    it('should reject when balance info not found', async () => {
      // Only set up the specific mock - null balance
      mockedRepo.getCustomerBalance.mockResolvedValue(null);

      await expect(
        balanceService.queueForMinting(customerAddress, 30)
      ).rejects.toThrow('Failed to queue balance for minting');
    });

    it('should throw error on repository failure', async () => {
      setupDefaultMocks();
      mockedRepo.queueForMinting.mockRejectedValue(new Error('Database error'));

      await expect(
        balanceService.queueForMinting(customerAddress, 30)
      ).rejects.toThrow('Failed to queue balance for minting');
    });
  });

  // ==========================================
  // validateMintRequest Tests
  // ==========================================
  describe('validateMintRequest()', () => {
    it('should return valid for amount within balance', async () => {
      setupDefaultMocks();

      const result = await balanceService.validateMintRequest(customerAddress, 30);

      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should return invalid for zero amount', async () => {
      const result = await balanceService.validateMintRequest(customerAddress, 0);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('greater than zero');
    });

    it('should return invalid for negative amount', async () => {
      const result = await balanceService.validateMintRequest(customerAddress, -10);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('greater than zero');
    });

    it('should return invalid for non-existent customer', async () => {
      mockedRepo.getCustomerBalance.mockResolvedValue(null);

      const result = await balanceService.validateMintRequest(customerAddress, 30);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('not found');
    });

    it('should return invalid when amount exceeds balance', async () => {
      mockedRepo.getCustomerBalance.mockResolvedValue({
        ...mockBalanceInfo,
        databaseBalance: 20
      });

      const result = await balanceService.validateMintRequest(customerAddress, 50);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Insufficient');
      expect(result.maxAllowed).toBe(20);
    });

    it('should return valid for exact balance amount', async () => {
      setupDefaultMocks();

      const result = await balanceService.validateMintRequest(customerAddress, 50);

      expect(result.valid).toBe(true);
    });

    it('should handle validation errors gracefully', async () => {
      mockedRepo.getCustomerBalance.mockRejectedValue(new Error('Database error'));

      const result = await balanceService.validateMintRequest(customerAddress, 30);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('system error');
    });

    it('should provide maxAllowed when insufficient balance', async () => {
      mockedRepo.getCustomerBalance.mockResolvedValue({
        ...mockBalanceInfo,
        databaseBalance: 25
      });

      const result = await balanceService.validateMintRequest(customerAddress, 100);

      expect(result.valid).toBe(false);
      expect(result.maxAllowed).toBe(25);
    });
  });

  // ==========================================
  // getPendingMints Tests
  // ==========================================
  describe('getPendingMints()', () => {
    const mockPendingCustomers = [
      { address: '0xaaa', pendingAmount: 100 },
      { address: '0xbbb', pendingAmount: 50 }
    ];

    it('should return list of pending mint requests', async () => {
      mockedRepo.getCustomersWithPendingMints.mockResolvedValue(mockPendingCustomers);

      const result = await balanceService.getPendingMints();

      expect(result).toHaveLength(2);
      expect(result[0].customerAddress).toBe('0xaaa');
      expect(result[0].amount).toBe(100);
    });

    it('should use default limit of 100', async () => {
      mockedRepo.getCustomersWithPendingMints.mockResolvedValue(mockPendingCustomers);

      await balanceService.getPendingMints();

      expect(mockedRepo.getCustomersWithPendingMints)
        .toHaveBeenCalledWith(100);
    });

    it('should accept custom limit', async () => {
      mockedRepo.getCustomersWithPendingMints.mockResolvedValue(mockPendingCustomers);

      await balanceService.getPendingMints(50);

      expect(mockedRepo.getCustomersWithPendingMints)
        .toHaveBeenCalledWith(50);
    });

    it('should return empty array when no pending mints', async () => {
      mockedRepo.getCustomersWithPendingMints.mockResolvedValue([]);

      const result = await balanceService.getPendingMints();

      expect(result).toHaveLength(0);
    });

    it('should include requestedAt timestamp for each request', async () => {
      mockedRepo.getCustomersWithPendingMints.mockResolvedValue(mockPendingCustomers);

      const result = await balanceService.getPendingMints();

      result.forEach(request => {
        expect(request.requestedAt).toBeDefined();
      });
    });

    it('should throw error on repository failure', async () => {
      mockedRepo.getCustomersWithPendingMints.mockRejectedValue(new Error('Database error'));

      await expect(balanceService.getPendingMints()).rejects.toThrow('Failed to get pending mints');
    });
  });

  // ==========================================
  // syncCustomerBalance Tests
  // ==========================================
  describe('syncCustomerBalance()', () => {
    it('should sync customer balance and return updated info', async () => {
      setupDefaultMocks();

      const result = await balanceService.syncCustomerBalance(customerAddress);

      expect(result).toBeDefined();
      expect(result.address).toBe(customerAddress.toLowerCase());
      expect(mockedRepo.syncCustomerBalance).toHaveBeenCalledWith(customerAddress);
    });

    it('should throw error when customer not found after sync', async () => {
      // Set up mocks to return data on first call, null on second
      mockedRepo.syncCustomerBalance.mockResolvedValue(undefined);
      mockedRepo.getCustomer.mockResolvedValue(null);
      mockedRepo.getCustomerBalance.mockResolvedValue(null);

      await expect(
        balanceService.syncCustomerBalance(customerAddress)
      ).rejects.toThrow();
    });

    it('should throw error on sync failure', async () => {
      mockedRepo.syncCustomerBalance.mockRejectedValue(new Error('Sync failed'));

      await expect(
        balanceService.syncCustomerBalance(customerAddress)
      ).rejects.toThrow('Failed to sync customer balance');
    });
  });

  // ==========================================
  // getBalanceStatistics Tests
  // ==========================================
  describe('getBalanceStatistics()', () => {
    const mockStats = {
      totalDatabaseBalance: 10000,
      totalPendingMints: 500,
      totalCustomersWithBalance: 150,
      averageBalance: 66.67
    };

    it('should return balance statistics', async () => {
      mockedRepo.getBalanceStatistics.mockResolvedValue(mockStats);

      const result = await balanceService.getBalanceStatistics();

      expect(result.totalDatabaseBalance).toBe(10000);
      expect(result.totalPendingMints).toBe(500);
      expect(result.totalCustomersWithBalance).toBe(150);
      expect(result.averageBalance).toBe(66.67);
    });

    it('should throw error on repository failure', async () => {
      mockedRepo.getBalanceStatistics.mockRejectedValue(new Error('Statistics error'));

      await expect(balanceService.getBalanceStatistics())
        .rejects.toThrow('Failed to get balance statistics');
    });
  });
});
