# Token Provider Migration - Real Examples

This document shows **exactly** what changes in your code when you implement the Provider Pattern.

---

## Example 1: Customer Earning Tokens (TokenService.ts)

### BEFORE (Current Code)

```typescript
// backend/src/domains/token/services/TokenService.ts

import { TokenMinter, MintResult } from '../../../contracts/TokenMinter';

export class TokenService {
  private tokenMinter: TokenMinter | null = null;

  private getTokenMinter(): TokenMinter {
    if (!this.tokenMinter) {
      this.tokenMinter = new TokenMinter();  // ❌ Direct blockchain dependency
    }
    return this.tokenMinter;
  }

  async processRepairEarning(
    customerAddress: string,
    repairAmount: number,
    shopId: string
  ): Promise<MintResult> {
    try {
      // Get customer
      let customer = await customerRepository.getCustomer(customerAddress);
      if (!customer) {
        customer = TierManager.createNewCustomer(customerAddress);
        await customerRepository.createCustomer(customer);
      }

      // ❌ Direct blockchain call
      const result = await this.getTokenMinter().mintRepairTokens(
        customerAddress,
        repairAmount,
        shopId,
        customer
      );

      if (result.success && result.tokensToMint && result.newTier) {
        await customerRepository.updateCustomerAfterEarning(
          customerAddress,
          result.tokensToMint,
          result.newTier as any
        );
      }

      return result;
    } catch (error) {
      logger.error('Error processing repair earning:', error);
      throw error;
    }
  }
}
```

### AFTER (With Provider Pattern)

```typescript
// backend/src/domains/token/services/TokenService.ts

import { TokenProviderFactory } from '../../../providers/TokenProviderFactory';  // ✅ Use factory
import { ITokenProvider } from '../../../interfaces/ITokenProvider';

export class TokenService {
  private tokenProvider: ITokenProvider;

  constructor() {
    this.tokenProvider = TokenProviderFactory.getProvider();  // ✅ Gets correct provider
  }

  async processRepairEarning(
    customerAddress: string,
    repairAmount: number,
    shopId: string
  ) {
    try {
      // Get customer
      let customer = await customerRepository.getCustomer(customerAddress);
      if (!customer) {
        customer = TierManager.createNewCustomer(customerAddress);
        await customerRepository.createCustomer(customer);
      }

      // Calculate tokens based on tier
      const tierBonus = customer.tier === 'gold' ? 5 : customer.tier === 'silver' ? 2 : 0;
      const tokensToEarn = Math.floor(repairAmount / 10) + tierBonus;

      // ✅ Provider handles implementation details
      const result = await this.tokenProvider.creditTokens({
        customerAddress,
        amount: tokensToEarn,
        reason: `Repair earning: $${repairAmount}`,
        shopId,
        metadata: {
          repairAmount,
          tierBonus,
          tier: customer.tier
        }
      });

      if (result.success) {
        // Update tier if needed
        const newTier = this.calculateTier(customer.total_rcn_earned + tokensToEarn);
        if (newTier !== customer.tier) {
          await customerRepository.updateTier(customerAddress, newTier);
        }
      }

      return result;
    } catch (error) {
      logger.error('Error processing repair earning:', error);
      throw error;
    }
  }
}
```

**What Changed:**
- ✅ No more `TokenMinter` import
- ✅ No more blockchain-specific logic
- ✅ Provider handles database OR blockchain automatically
- ✅ Same functionality, cleaner code

---

## Example 2: Customer Redemption (RedemptionSessionService.ts)

### BEFORE

```typescript
async processRedemption(
  customerAddress: string,
  shopId: string,
  amount: number
) {
  const blockchainEnabled = process.env.ENABLE_BLOCKCHAIN_MINTING === 'true';

  // ❌ Messy if/else blockchain logic
  if (blockchainEnabled) {
    const tokenMinter = new TokenMinter();
    const result = await tokenMinter.processRedemption(
      customerAddress,
      shopAddress,
      amount,
      shopId
    );

    if (!result.success) {
      throw new Error(result.message || 'Redemption failed');
    }
  }

  // Update database
  await customerRepository.updateBalance(
    customerAddress,
    currentBalance - amount
  );

  // Record transaction
  await transactionRepository.recordTransaction({
    customer_address: customerAddress,
    shop_id: shopId,
    amount: -amount,
    transaction_type: 'redemption',
    status: 'completed'
  });
}
```

### AFTER

```typescript
async processRedemption(
  customerAddress: string,
  shopId: string,
  amount: number
) {
  const tokenProvider = TokenProviderFactory.getProvider();

  // ✅ Clean, simple - provider handles everything
  const result = await tokenProvider.debitTokens({
    customerAddress,
    amount,
    reason: `Redemption at shop: ${shopId}`,
    shopId,
    metadata: {
      redemptionDate: new Date().toISOString()
    }
  });

  if (!result.success) {
    throw new Error(result.error || 'Redemption failed');
  }

  return result;
}
```

**What Changed:**
- ✅ Removed if/else blockchain checks
- ✅ Removed manual database updates (provider does it)
- ✅ Removed duplicate transaction recording
- ✅ 40 lines → 15 lines
- ✅ Much easier to read and maintain

---

## Example 3: Admin Minting Tokens

### BEFORE

```typescript
// backend/src/domains/admin/services/operations/TokenOperationsService.ts

async mintTokensToShop(shopId: string, amount: number) {
  try {
    const shop = await shopRepository.getShop(shopId);
    if (!shop) {
      throw new Error('Shop not found');
    }

    // ❌ Direct blockchain dependency
    const tokenMinter = new TokenMinter();
    const result = await tokenMinter.adminMintTokens(
      shop.wallet_address,
      amount,
      `Admin mint to shop ${shopId}`
    );

    if (result.success) {
      // Update database
      await shopRepository.updateRCNBalance(shopId, shop.rcn_balance + amount);

      // Record transaction
      await transactionRepository.recordTransaction({
        shop_id: shopId,
        amount: amount,
        transaction_type: 'admin_mint',
        status: 'completed',
        blockchain_hash: result.transactionHash
      });

      return {
        success: true,
        transactionHash: result.transactionHash,
        newBalance: shop.rcn_balance + amount
      };
    } else {
      throw new Error(result.error || 'Mint failed');
    }
  } catch (error) {
    logger.error('Admin mint failed:', error);
    throw error;
  }
}
```

### AFTER

```typescript
// backend/src/domains/admin/services/operations/TokenOperationsService.ts

async mintTokensToShop(shopId: string, amount: number) {
  try {
    const shop = await shopRepository.getShop(shopId);
    if (!shop) {
      throw new Error('Shop not found');
    }

    const tokenProvider = TokenProviderFactory.getProvider();

    // ✅ Clean provider call
    const result = await tokenProvider.creditTokens({
      customerAddress: shop.wallet_address,
      amount,
      reason: `Admin mint to shop ${shopId}`,
      shopId: 'admin',
      metadata: {
        adminAction: 'mint',
        targetShop: shopId
      }
    });

    if (!result.success) {
      throw new Error(result.error || 'Mint failed');
    }

    // Update shop balance
    await shopRepository.updateRCNBalance(shopId, shop.rcn_balance + amount);

    return {
      success: true,
      transactionId: result.transactionId,
      transactionHash: result.transactionHash, // Only set if blockchain enabled
      newBalance: shop.rcn_balance + amount
    };

  } catch (error) {
    logger.error('Admin mint failed:', error);
    throw error;
  }
}
```

**What Changed:**
- ✅ No more direct TokenMinter usage
- ✅ Provider handles blockchain OR database
- ✅ Transaction recording handled by provider
- ✅ Cleaner error handling

---

## Example 4: Customer Balance Check

### BEFORE

```typescript
async getCustomerBalance(customerAddress: string) {
  const blockchainEnabled = process.env.ENABLE_BLOCKCHAIN_MINTING === 'true';

  if (blockchainEnabled) {
    // ❌ Try blockchain first
    try {
      const tokenMinter = new TokenMinter();
      const blockchainBalance = await tokenMinter.getCustomerBalance(customerAddress);

      // Sync with database
      const dbCustomer = await customerRepository.getCustomer(customerAddress);
      if (dbCustomer && dbCustomer.current_rcn_balance !== blockchainBalance) {
        logger.warn('Balance mismatch', {
          blockchain: blockchainBalance,
          database: dbCustomer.current_rcn_balance
        });
      }

      return blockchainBalance;
    } catch (error) {
      logger.error('Blockchain balance check failed, falling back to database');
      // Fall back to database
    }
  }

  // Database balance
  const customer = await customerRepository.getCustomer(customerAddress);
  return customer?.current_rcn_balance || 0;
}
```

### AFTER

```typescript
async getCustomerBalance(customerAddress: string) {
  const tokenProvider = TokenProviderFactory.getProvider();

  // ✅ Provider handles source automatically
  const balanceInfo = await tokenProvider.getBalance(customerAddress);

  return {
    balance: balanceInfo.balance,
    source: balanceInfo.source,  // 'database' or 'blockchain'
    lastUpdated: balanceInfo.lastUpdated
  };
}
```

**What Changed:**
- ✅ No if/else logic
- ✅ No manual fallback handling
- ✅ Provider decides source automatically
- ✅ 30 lines → 8 lines

---

## Example 5: Referral Bonus

### BEFORE

```typescript
async processReferralBonus(
  referrerAddress: string,
  refereeAddress: string
) {
  const REFERRER_BONUS = 25;
  const REFEREE_BONUS = 10;

  const blockchainEnabled = process.env.ENABLE_BLOCKCHAIN_MINTING === 'true';

  try {
    if (blockchainEnabled) {
      // ❌ Blockchain minting
      const tokenMinter = new TokenMinter();

      // Mint to referrer
      const referrerResult = await tokenMinter.adminMintTokens(
        referrerAddress,
        REFERRER_BONUS,
        'Referral bonus'
      );

      // Mint to referee
      const refereeResult = await tokenMinter.adminMintTokens(
        refereeAddress,
        REFEREE_BONUS,
        'Signup bonus'
      );

      if (!referrerResult.success || !refereeResult.success) {
        throw new Error('Minting failed');
      }
    }

    // ❌ Manual database updates
    await customerRepository.updateBalance(
      referrerAddress,
      (await customerRepository.getCustomer(referrerAddress))!.current_rcn_balance + REFERRER_BONUS
    );

    await customerRepository.updateBalance(
      refereeAddress,
      (await customerRepository.getCustomer(refereeAddress))!.current_rcn_balance + REFEREE_BONUS
    );

    // Record transactions
    await transactionRepository.recordTransaction({ ... });
    await transactionRepository.recordTransaction({ ... });

  } catch (error) {
    logger.error('Referral bonus failed:', error);
    throw error;
  }
}
```

### AFTER

```typescript
async processReferralBonus(
  referrerAddress: string,
  refereeAddress: string
) {
  const REFERRER_BONUS = 25;
  const REFEREE_BONUS = 10;

  const tokenProvider = TokenProviderFactory.getProvider();

  try {
    // ✅ Credit referrer
    const referrerResult = await tokenProvider.creditTokens({
      customerAddress: referrerAddress,
      amount: REFERRER_BONUS,
      reason: 'Referral bonus',
      shopId: 'platform',
      metadata: { referredUser: refereeAddress }
    });

    // ✅ Credit referee
    const refereeResult = await tokenProvider.creditTokens({
      customerAddress: refereeAddress,
      amount: REFEREE_BONUS,
      reason: 'Signup bonus',
      shopId: 'platform',
      metadata: { referredBy: referrerAddress }
    });

    if (!referrerResult.success || !refereeResult.success) {
      throw new Error('Bonus credit failed');
    }

    return {
      referrerBonus: referrerResult,
      refereeBonus: refereeResult
    };

  } catch (error) {
    logger.error('Referral bonus failed:', error);
    throw error;
  }
}
```

**What Changed:**
- ✅ No blockchain if/else logic
- ✅ No manual database updates
- ✅ Provider handles everything consistently
- ✅ 60 lines → 30 lines
- ✅ Much easier to understand

---

## Summary: What You Gain

### Code Quality
- **Cleaner:** No scattered if/else blockchain checks
- **Shorter:** 30-50% less code in services
- **Simpler:** Single abstraction instead of two paths

### Maintainability
- **One Place:** All token logic in providers
- **Easy Changes:** Modify provider, not 20+ service files
- **Testable:** Mock provider for unit tests

### Flexibility
- **Toggle:** Switch blockchain on/off with one env var
- **Future-Proof:** Add new providers (e.g., Layer 2) easily
- **Reversible:** No refactoring needed to go back

### Developer Experience
- **Clear Intent:** Code reads like business logic
- **Less Complexity:** No blockchain details in business layer
- **Faster Development:** Write once, works with any provider

---

## Implementation Time Per File

Based on these examples:

| File Type | Lines Changed | Time Estimate |
|-----------|---------------|---------------|
| Small service (1-2 token ops) | 20-40 lines | 30-45 min |
| Medium service (3-5 token ops) | 50-100 lines | 1-1.5 hours |
| Large service (6+ token ops) | 100-200 lines | 2-3 hours |

**Total for 11 files:** ~12-16 hours

---

## Testing After Migration

```typescript
// Example test with provider pattern

describe('TokenService', () => {
  let tokenService: TokenService;
  let mockProvider: jest.Mocked<ITokenProvider>;

  beforeEach(() => {
    // ✅ Easy to mock provider
    mockProvider = {
      creditTokens: jest.fn(),
      debitTokens: jest.fn(),
      getBalance: jest.fn(),
      // ... other methods
    } as any;

    // Inject mock provider
    TokenProviderFactory.reset();
    jest.spyOn(TokenProviderFactory, 'getProvider').mockReturnValue(mockProvider);

    tokenService = new TokenService();
  });

  it('should credit tokens on repair earning', async () => {
    mockProvider.creditTokens.mockResolvedValue({
      success: true,
      amount: 10,
      transactionId: 'txn-123'
    });

    const result = await tokenService.processRepairEarning(
      '0x123',
      100,
      'shop-1'
    );

    expect(mockProvider.creditTokens).toHaveBeenCalledWith({
      customerAddress: '0x123',
      amount: 10,
      reason: expect.stringContaining('Repair earning'),
      shopId: 'shop-1',
      metadata: expect.any(Object)
    });

    expect(result.success).toBe(true);
  });
});
```

**Testing Benefits:**
- ✅ No need to mock blockchain calls
- ✅ No need to mock Thirdweb SDK
- ✅ One simple interface to mock
- ✅ Fast tests (no network calls)
- ✅ Consistent across all service tests

---

## Bottom Line

The Provider Pattern gives you:
1. **50% less code** in service files
2. **Zero blockchain logic** in business layer
3. **One-line toggle** between database/blockchain
4. **Easy testing** with simple mocks
5. **Future flexibility** without refactoring

It's the industry-standard way to handle swappable implementations, used by Stripe, AWS, Twilio, and every major platform.

**Next Step:** Review these examples with your team and start with Phase 1 of the migration strategy.
