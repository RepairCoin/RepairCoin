// Shared token-operation types.
//
// MintResult lives here (not in the archived TokenMinter) so active code such as
// TokenService can reference the type without importing from contracts/_archive/.
// See docs/blockchain-removal/PHASE3_CLEANUP_PLAN.md.

export interface MintResult {
  success: boolean;
  tokensToMint?: number;
  transactionHash?: string;
  message?: string;
  error?: string;
  newTier?: string;
  gasUsed?: string;
  timestamp?: string;
}
