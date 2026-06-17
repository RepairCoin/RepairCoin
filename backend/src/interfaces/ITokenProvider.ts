/**
 * Token Provider Interface
 *
 * Abstraction layer for all RCN token operations. Lets the platform swap the
 * underlying implementation (database-only vs. blockchain-backed) without
 * touching business logic — selected at runtime by TokenProviderFactory based
 * on the ENABLE_BLOCKCHAIN_MINTING feature flag.
 *
 * See docs/BLOCKCHAIN_REVERSIBLE_REMOVAL_STRATEGY.md for the full rationale.
 */

export type TokenProviderType = 'database' | 'blockchain' | 'hybrid';

export interface TokenBalance {
  balance: number;
  source: TokenProviderType;
  lastUpdated: Date;
}

export interface TokenOperationResult {
  success: boolean;
  amount: number;
  /** DB transaction id (always set on success) */
  transactionId?: string;
  /** On-chain tx hash (blockchain provider only) */
  transactionHash?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface CreditTokensParams {
  customerAddress: string;
  amount: number;
  reason: string;
  shopId: string;
  metadata?: Record<string, unknown>;
}

export interface DebitTokensParams {
  customerAddress: string;
  amount: number;
  reason: string;
  shopId?: string;
  metadata?: Record<string, unknown>;
}

export interface TransferTokensParams {
  fromAddress: string;
  toAddress: string;
  amount: number;
  reason: string;
  metadata?: Record<string, unknown>;
}

export interface ValidateOperationParams {
  customerAddress: string;
  amount: number;
  operation: 'credit' | 'debit' | 'transfer';
}

export interface ProviderStatus {
  healthy: boolean;
  providerType: TokenProviderType;
  details: Record<string, unknown>;
}

export interface ITokenProvider {
  /** Provider identification */
  readonly providerType: TokenProviderType;
  readonly isBlockchainEnabled: boolean;

  /** Credit tokens to a customer (earning, referral bonus, admin mint, etc.) */
  creditTokens(params: CreditTokensParams): Promise<TokenOperationResult>;

  /** Debit tokens from a customer (redemption) */
  debitTokens(params: DebitTokensParams): Promise<TokenOperationResult>;

  /** Transfer tokens between customers */
  transferTokens(params: TransferTokensParams): Promise<TokenOperationResult>;

  /** Get a customer's current spendable balance */
  getBalance(customerAddress: string): Promise<TokenBalance>;

  /** Validate that an operation is possible before attempting it */
  validateOperation(
    params: ValidateOperationParams
  ): Promise<{ valid: boolean; reason?: string }>;

  /** Provider health/status */
  getProviderStatus(): Promise<ProviderStatus>;
}
