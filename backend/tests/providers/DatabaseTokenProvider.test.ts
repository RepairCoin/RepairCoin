/**
 * DatabaseTokenProvider unit tests
 *
 * Safety net for the Provider Pattern migration (Strategy B). Verifies the
 * database-only token provider's credit/debit/balance semantics against the
 * canonical calculated balance (customerRepository.getCustomerBalance().databaseBalance),
 * NOT the raw current_rcn_balance column.
 *
 * See docs/BLOCKCHAIN_REVERSIBLE_REMOVAL_STRATEGY.md.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// ============================================================
// Mocks (declared before importing the provider under test)
// ============================================================
const mockGetCustomer = jest.fn<(...args: any[]) => Promise<any>>();
const mockGetCustomerBalance = jest.fn<(...args: any[]) => Promise<any>>();
const mockUpdateAfterEarning = jest.fn<(...args: any[]) => Promise<void>>();
const mockUpdateAfterRedemption = jest.fn<(...args: any[]) => Promise<void>>();
const mockHealthCheck = jest.fn<(...args: any[]) => Promise<any>>();
const mockRecordTransaction = jest.fn<(...args: any[]) => Promise<void>>();

jest.mock('../../src/repositories', () => ({
  customerRepository: {
    getCustomer: (...args: any[]) => mockGetCustomer(...args),
    getCustomerBalance: (...args: any[]) => mockGetCustomerBalance(...args),
    updateCustomerAfterEarning: (...args: any[]) => mockUpdateAfterEarning(...args),
    updateBalanceAfterRedemption: (...args: any[]) => mockUpdateAfterRedemption(...args),
    healthCheck: (...args: any[]) => mockHealthCheck(...args),
  },
  transactionRepository: {
    recordTransaction: (...args: any[]) => mockRecordTransaction(...args),
  },
}));

const mockCalculateTier = jest.fn<(lifetimeEarnings: number) => string>();
jest.mock('../../src/contracts/TierManager', () => ({
  TierManager: jest.fn().mockImplementation(() => ({
    calculateTier: (lifetimeEarnings: number) => mockCalculateTier(lifetimeEarnings),
  })),
}));

jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { DatabaseTokenProvider } from '../../src/providers/DatabaseTokenProvider';

describe('DatabaseTokenProvider', () => {
  let provider: DatabaseTokenProvider;

  beforeEach(() => {
    mockCalculateTier.mockReturnValue('SILVER');
    mockRecordTransaction.mockResolvedValue(undefined);
    mockUpdateAfterEarning.mockResolvedValue(undefined);
    mockUpdateAfterRedemption.mockResolvedValue(undefined);
    mockHealthCheck.mockResolvedValue({ status: 'healthy' });
    provider = new DatabaseTokenProvider();
  });

  describe('creditTokens', () => {
    it('credits tokens, recomputes tier from new lifetime earnings, and records a mint transaction', async () => {
      mockGetCustomer.mockResolvedValue({ address: '0xabc', tier: 'BRONZE', lifetimeEarnings: 30 });
      mockGetCustomerBalance.mockResolvedValue({ databaseBalance: 30 });

      const result = await provider.creditTokens({
        customerAddress: '0xABC',
        amount: 20,
        reason: 'Repair completion',
        shopId: 'shop1',
      });

      // Tier recomputed from lifetimeEarnings (30) + amount (20) = 50
      expect(mockCalculateTier).toHaveBeenCalledWith(50);
      expect(mockUpdateAfterEarning).toHaveBeenCalledWith('0xABC', 20, 'SILVER');
      expect(mockRecordTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'mint', amount: 20, status: 'confirmed' })
      );

      expect(result.success).toBe(true);
      expect(result.amount).toBe(20);
      expect(result.transactionId).toBeDefined();
      expect(result.metadata).toMatchObject({ previousBalance: 30, newBalance: 50, newTier: 'SILVER' });
    });

    it('rejects a non-positive amount without touching the database', async () => {
      const result = await provider.creditTokens({
        customerAddress: '0xabc',
        amount: 0,
        reason: 'bad',
        shopId: 'shop1',
      });

      expect(result.success).toBe(false);
      expect(mockUpdateAfterEarning).not.toHaveBeenCalled();
      expect(mockRecordTransaction).not.toHaveBeenCalled();
    });

    it('fails when the customer does not exist', async () => {
      mockGetCustomer.mockResolvedValue(null);

      const result = await provider.creditTokens({
        customerAddress: '0xmissing',
        amount: 10,
        reason: 'Repair',
        shopId: 'shop1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Customer not found');
      expect(mockUpdateAfterEarning).not.toHaveBeenCalled();
    });
  });

  describe('debitTokens', () => {
    it('debits against the calculated available balance and records a redeem transaction', async () => {
      mockGetCustomerBalance.mockResolvedValue({ databaseBalance: 100 });

      const result = await provider.debitTokens({
        customerAddress: '0xabc',
        amount: 40,
        reason: 'Redemption at Shop',
        shopId: 'shop1',
      });

      expect(mockUpdateAfterRedemption).toHaveBeenCalledWith('0xabc', 40);
      expect(mockRecordTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'redeem', amount: 40, status: 'confirmed' })
      );
      expect(result.success).toBe(true);
      expect(result.metadata).toMatchObject({ previousBalance: 100, newBalance: 60 });
    });

    it('refuses to over-draw when the available balance is insufficient', async () => {
      mockGetCustomerBalance.mockResolvedValue({ databaseBalance: 10 });

      const result = await provider.debitTokens({
        customerAddress: '0xabc',
        amount: 40,
        reason: 'Redemption',
        shopId: 'shop1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Insufficient balance/);
      expect(mockUpdateAfterRedemption).not.toHaveBeenCalled();
      expect(mockRecordTransaction).not.toHaveBeenCalled();
    });

    it('fails when the customer does not exist', async () => {
      mockGetCustomerBalance.mockResolvedValue(null);

      const result = await provider.debitTokens({
        customerAddress: '0xmissing',
        amount: 5,
        reason: 'Redemption',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Customer not found');
      expect(mockUpdateAfterRedemption).not.toHaveBeenCalled();
    });
  });

  describe('transferTokens', () => {
    it('is not supported in database-only mode', async () => {
      const result = await provider.transferTokens({
        fromAddress: '0xa',
        toAddress: '0xb',
        amount: 5,
        reason: 'gift',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not supported/i);
    });
  });

  describe('getBalance', () => {
    it('returns the canonical calculated databaseBalance', async () => {
      mockGetCustomerBalance.mockResolvedValue({ databaseBalance: 77 });

      const result = await provider.getBalance('0xabc');

      expect(result).toMatchObject({ balance: 77, source: 'database' });
    });

    it('returns 0 for an unknown customer', async () => {
      mockGetCustomerBalance.mockResolvedValue(null);

      const result = await provider.getBalance('0xmissing');

      expect(result.balance).toBe(0);
    });
  });

  describe('validateOperation', () => {
    it('accepts a positive credit', async () => {
      const result = await provider.validateOperation({
        customerAddress: '0xabc',
        amount: 5,
        operation: 'credit',
      });
      expect(result.valid).toBe(true);
    });

    it('rejects a debit that exceeds the available balance', async () => {
      mockGetCustomerBalance.mockResolvedValue({ databaseBalance: 1 });

      const result = await provider.validateOperation({
        customerAddress: '0xabc',
        amount: 5,
        operation: 'debit',
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/Insufficient/);
    });

    it('rejects transfers outright', async () => {
      const result = await provider.validateOperation({
        customerAddress: '0xabc',
        amount: 5,
        operation: 'transfer',
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('getProviderStatus', () => {
    it('reports healthy when the database health check passes', async () => {
      const status = await provider.getProviderStatus();
      expect(status).toMatchObject({ healthy: true, providerType: 'database' });
      expect(status.details).toMatchObject({ blockchainEnabled: false, databaseConnected: true });
    });
  });
});
