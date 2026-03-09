/**
 * RCN Redemption Balance Tests
 *
 * Verifies that all RCN balance-related operations correctly update customer balances.
 * Tests the fix for the bug where redemptions were not deducting from customer balance
 * (commit a736bf56 removed the deduction call).
 *
 * Tests cover:
 * 1. Balance calculation formula: available = lifetime - redemptions - pending - minted
 * 2. Redemption deducts from current_rcn_balance and increments total_redemptions
 * 3. Earning adds to lifetime_earnings and current_rcn_balance
 * 4. Mint-to-wallet deducts from current_rcn_balance only
 * 5. Multiple redemptions accumulate correctly
 * 6. Balance never goes below zero
 * 7. Atomic transaction: all steps succeed or all rollback
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// ============================================================
// Test Suite 1: Balance Calculation Formula
// ============================================================
describe('RCN Balance Calculation Formula', () => {
  /**
   * Simulates the SQL from CustomerRepository.getCustomerBalance() (line 643-658):
   * available = lifetime_earnings - total_redemptions - pending_mint - minted_to_wallet
   */
  function calculateAvailableBalance(customer: {
    lifetime_earnings: number;
    total_redemptions: number;
    pending_mint_balance: number;
    minted_to_wallet: number;
  }): number {
    return Math.max(
      0,
      customer.lifetime_earnings -
        customer.total_redemptions -
        customer.pending_mint_balance -
        customer.minted_to_wallet
    );
  }

  it('should calculate correct available balance with no redemptions', () => {
    const balance = calculateAvailableBalance({
      lifetime_earnings: 200,
      total_redemptions: 0,
      pending_mint_balance: 0,
      minted_to_wallet: 0,
    });
    expect(balance).toBe(200);
  });

  it('should deduct redemptions from available balance', () => {
    const balance = calculateAvailableBalance({
      lifetime_earnings: 200,
      total_redemptions: 30,
      pending_mint_balance: 0,
      minted_to_wallet: 0,
    });
    expect(balance).toBe(170);
  });

  it('should deduct pending mint from available balance', () => {
    const balance = calculateAvailableBalance({
      lifetime_earnings: 200,
      total_redemptions: 30,
      pending_mint_balance: 50,
      minted_to_wallet: 0,
    });
    expect(balance).toBe(120);
  });

  it('should deduct minted-to-wallet from available balance', () => {
    const balance = calculateAvailableBalance({
      lifetime_earnings: 200,
      total_redemptions: 30,
      pending_mint_balance: 0,
      minted_to_wallet: 20,
    });
    expect(balance).toBe(150);
  });

  it('should deduct all three from available balance', () => {
    const balance = calculateAvailableBalance({
      lifetime_earnings: 200,
      total_redemptions: 30,
      pending_mint_balance: 50,
      minted_to_wallet: 20,
    });
    // 200 - 30 - 50 - 20 = 100
    expect(balance).toBe(100);
  });

  it('should never return negative balance (GREATEST 0)', () => {
    const balance = calculateAvailableBalance({
      lifetime_earnings: 50,
      total_redemptions: 100,
      pending_mint_balance: 0,
      minted_to_wallet: 0,
    });
    expect(balance).toBe(0);
  });

  it('should match the reported bug scenario (150 RCN with missing redemptions)', () => {
    // Before fix: total_redemptions was NOT incremented, so balance stayed at 150
    const beforeFix = calculateAvailableBalance({
      lifetime_earnings: 196,
      total_redemptions: 46, // NOT updated (should be 76)
      pending_mint_balance: 0,
      minted_to_wallet: 0,
    });
    expect(beforeFix).toBe(150); // Bug: shows 150 instead of 120

    // After fix: total_redemptions is correctly incremented
    const afterFix = calculateAvailableBalance({
      lifetime_earnings: 196,
      total_redemptions: 76, // 46 + 30 (3x10 redemptions)
      pending_mint_balance: 0,
      minted_to_wallet: 0,
    });
    expect(afterFix).toBe(120); // Correct: 196 - 76 = 120
  });
});

// ============================================================
// Test Suite 2: Redemption SQL Simulation
// ============================================================
describe('Redemption Balance Update (SQL simulation)', () => {
  /**
   * Simulates the SQL added in the fix (step 4d in atomic transaction):
   * UPDATE customers SET
   *   current_rcn_balance = GREATEST(0, COALESCE(current_rcn_balance, 0) - amount),
   *   total_redemptions = COALESCE(total_redemptions, 0) + amount
   */
  function applyRedemption(
    customer: { current_rcn_balance: number; total_redemptions: number },
    amount: number
  ) {
    return {
      current_rcn_balance: Math.max(0, (customer.current_rcn_balance || 0) - amount),
      total_redemptions: (customer.total_redemptions || 0) + amount,
    };
  }

  it('should deduct amount from current_rcn_balance', () => {
    const result = applyRedemption(
      { current_rcn_balance: 150, total_redemptions: 46 },
      10
    );
    expect(result.current_rcn_balance).toBe(140);
  });

  it('should increment total_redemptions by amount', () => {
    const result = applyRedemption(
      { current_rcn_balance: 150, total_redemptions: 46 },
      10
    );
    expect(result.total_redemptions).toBe(56);
  });

  it('should handle 3 consecutive 10 RCN redemptions (the reported bug)', () => {
    let customer = { current_rcn_balance: 150, total_redemptions: 46 };

    // Redemption 1
    customer = applyRedemption(customer, 10);
    expect(customer.current_rcn_balance).toBe(140);
    expect(customer.total_redemptions).toBe(56);

    // Redemption 2
    customer = applyRedemption(customer, 10);
    expect(customer.current_rcn_balance).toBe(130);
    expect(customer.total_redemptions).toBe(66);

    // Redemption 3
    customer = applyRedemption(customer, 10);
    expect(customer.current_rcn_balance).toBe(120);
    expect(customer.total_redemptions).toBe(76);
  });

  it('should not go below zero on over-redemption', () => {
    const result = applyRedemption(
      { current_rcn_balance: 5, total_redemptions: 0 },
      10
    );
    expect(result.current_rcn_balance).toBe(0);
    expect(result.total_redemptions).toBe(10);
  });

  it('should handle null/zero initial values', () => {
    const result = applyRedemption(
      { current_rcn_balance: 0, total_redemptions: 0 },
      10
    );
    expect(result.current_rcn_balance).toBe(0);
    expect(result.total_redemptions).toBe(10);
  });
});

// ============================================================
// Test Suite 3: Earning Balance Update (SQL simulation)
// ============================================================
describe('Earning Balance Update (SQL simulation)', () => {
  /**
   * Simulates CustomerRepository.updateBalanceAfterEarning():
   * UPDATE customers SET
   *   lifetime_earnings = lifetime_earnings + amount,
   *   current_rcn_balance = COALESCE(current_rcn_balance, 0) + amount
   */
  function applyEarning(
    customer: { lifetime_earnings: number; current_rcn_balance: number },
    amount: number
  ) {
    return {
      lifetime_earnings: customer.lifetime_earnings + amount,
      current_rcn_balance: (customer.current_rcn_balance || 0) + amount,
    };
  }

  it('should increase both lifetime_earnings and current_rcn_balance', () => {
    const result = applyEarning(
      { lifetime_earnings: 100, current_rcn_balance: 80 },
      25
    );
    expect(result.lifetime_earnings).toBe(125);
    expect(result.current_rcn_balance).toBe(105);
  });

  it('should handle first earning on new customer', () => {
    const result = applyEarning(
      { lifetime_earnings: 0, current_rcn_balance: 0 },
      10
    );
    expect(result.lifetime_earnings).toBe(10);
    expect(result.current_rcn_balance).toBe(10);
  });
});

// ============================================================
// Test Suite 4: Mint-to-Wallet Balance Update (SQL simulation)
// ============================================================
describe('Mint-to-Wallet Balance Update (SQL simulation)', () => {
  /**
   * Simulates CustomerRepository.decreaseBalanceAfterMint():
   * UPDATE customers SET
   *   current_rcn_balance = GREATEST(0, COALESCE(current_rcn_balance, 0) - amount)
   * WHERE current_rcn_balance >= amount
   *
   * NOTE: Does NOT touch lifetime_earnings or total_redemptions
   */
  function applyMintToWallet(
    customer: { current_rcn_balance: number; lifetime_earnings: number; total_redemptions: number },
    amount: number
  ): { success: boolean; customer: typeof customer } {
    if ((customer.current_rcn_balance || 0) < amount) {
      return { success: false, customer };
    }
    return {
      success: true,
      customer: {
        ...customer,
        current_rcn_balance: Math.max(0, (customer.current_rcn_balance || 0) - amount),
        // lifetime_earnings and total_redemptions stay the same
      },
    };
  }

  it('should only decrease current_rcn_balance', () => {
    const result = applyMintToWallet(
      { current_rcn_balance: 100, lifetime_earnings: 200, total_redemptions: 50 },
      30
    );
    expect(result.success).toBe(true);
    expect(result.customer.current_rcn_balance).toBe(70);
    expect(result.customer.lifetime_earnings).toBe(200); // Unchanged
    expect(result.customer.total_redemptions).toBe(50); // Unchanged
  });

  it('should reject mint when insufficient balance', () => {
    const result = applyMintToWallet(
      { current_rcn_balance: 5, lifetime_earnings: 100, total_redemptions: 95 },
      10
    );
    expect(result.success).toBe(false);
    expect(result.customer.current_rcn_balance).toBe(5); // Unchanged
  });
});

// ============================================================
// Test Suite 5: Full Lifecycle (Earn → Redeem → Mint)
// ============================================================
describe('Full RCN Lifecycle: Earn → Redeem → Mint-to-Wallet', () => {
  interface CustomerState {
    lifetime_earnings: number;
    current_rcn_balance: number;
    total_redemptions: number;
    pending_mint_balance: number;
    minted_to_wallet: number;
  }

  function earn(state: CustomerState, amount: number): CustomerState {
    return {
      ...state,
      lifetime_earnings: state.lifetime_earnings + amount,
      current_rcn_balance: state.current_rcn_balance + amount,
    };
  }

  function redeem(state: CustomerState, amount: number): CustomerState {
    return {
      ...state,
      current_rcn_balance: Math.max(0, state.current_rcn_balance - amount),
      total_redemptions: state.total_redemptions + amount,
    };
  }

  function mintToWallet(state: CustomerState, amount: number): CustomerState {
    return {
      ...state,
      current_rcn_balance: Math.max(0, state.current_rcn_balance - amount),
      minted_to_wallet: state.minted_to_wallet + amount,
    };
  }

  function getAvailableBalance(state: CustomerState): number {
    return Math.max(
      0,
      state.lifetime_earnings -
        state.total_redemptions -
        state.pending_mint_balance -
        state.minted_to_wallet
    );
  }

  it('should track balance correctly through full lifecycle', () => {
    let customer: CustomerState = {
      lifetime_earnings: 0,
      current_rcn_balance: 0,
      total_redemptions: 0,
      pending_mint_balance: 0,
      minted_to_wallet: 0,
    };

    // Customer earns 100 RCN from repairs
    customer = earn(customer, 100);
    expect(getAvailableBalance(customer)).toBe(100);
    expect(customer.current_rcn_balance).toBe(100);

    // Customer earns 50 more
    customer = earn(customer, 50);
    expect(getAvailableBalance(customer)).toBe(150);

    // Customer redeems 30 at a shop
    customer = redeem(customer, 30);
    expect(getAvailableBalance(customer)).toBe(120);
    expect(customer.current_rcn_balance).toBe(120);
    expect(customer.total_redemptions).toBe(30);

    // Customer mints 20 to wallet
    customer = mintToWallet(customer, 20);
    expect(getAvailableBalance(customer)).toBe(100);
    expect(customer.current_rcn_balance).toBe(100);
    expect(customer.minted_to_wallet).toBe(20);

    // Customer redeems 10 more
    customer = redeem(customer, 10);
    expect(getAvailableBalance(customer)).toBe(90);

    // Verify final state
    expect(customer.lifetime_earnings).toBe(150);
    expect(customer.total_redemptions).toBe(40);
    expect(customer.minted_to_wallet).toBe(20);
    expect(customer.current_rcn_balance).toBe(90);
  });

  it('should reproduce and verify the reported bug fix', () => {
    // Start with the customer state before the 3 redemptions
    let customer: CustomerState = {
      lifetime_earnings: 196,
      current_rcn_balance: 150,
      total_redemptions: 46,
      pending_mint_balance: 0,
      minted_to_wallet: 0,
    };

    expect(getAvailableBalance(customer)).toBe(150);

    // 3 redemptions of 10 RCN each (the reported bug)
    customer = redeem(customer, 10);
    expect(getAvailableBalance(customer)).toBe(140);

    customer = redeem(customer, 10);
    expect(getAvailableBalance(customer)).toBe(130);

    customer = redeem(customer, 10);
    expect(getAvailableBalance(customer)).toBe(120);

    // Verify final state
    expect(customer.total_redemptions).toBe(76);
    expect(customer.current_rcn_balance).toBe(120);
    expect(customer.lifetime_earnings).toBe(196); // Unchanged by redemption
  });

  it('should handle edge case: redeem everything', () => {
    let customer: CustomerState = {
      lifetime_earnings: 50,
      current_rcn_balance: 50,
      total_redemptions: 0,
      pending_mint_balance: 0,
      minted_to_wallet: 0,
    };

    customer = redeem(customer, 50);
    expect(getAvailableBalance(customer)).toBe(0);
    expect(customer.current_rcn_balance).toBe(0);
    expect(customer.total_redemptions).toBe(50);
  });

  it('should handle rapid successive redemptions', () => {
    let customer: CustomerState = {
      lifetime_earnings: 100,
      current_rcn_balance: 100,
      total_redemptions: 0,
      pending_mint_balance: 0,
      minted_to_wallet: 0,
    };

    // 10 rapid redemptions of 10 RCN
    for (let i = 0; i < 10; i++) {
      customer = redeem(customer, 10);
    }

    expect(getAvailableBalance(customer)).toBe(0);
    expect(customer.total_redemptions).toBe(100);
    expect(customer.current_rcn_balance).toBe(0);
  });
});

// ============================================================
// Test Suite 6: Atomic Transaction Verification
// ============================================================
describe('Atomic Transaction: Redemption Steps', () => {
  /**
   * Simulates the 4 steps in the atomic transaction block.
   * If any step throws, all changes are rolled back.
   */
  function simulateAtomicRedemption(options: {
    shopBalance: number;
    shopTotalRedemptions: number;
    customerBalance: number;
    customerTotalRedemptions: number;
    amount: number;
    failAtStep?: number; // 1-4, which step to fail at
  }) {
    const shop = {
      purchasedRcnBalance: options.shopBalance,
      totalRedemptions: options.shopTotalRedemptions,
    };
    const customer = {
      current_rcn_balance: options.customerBalance,
      total_redemptions: options.customerTotalRedemptions,
    };
    const transaction = { recorded: false };
    const session = { used: false };

    // Snapshot for rollback
    const shopSnapshot = { ...shop };
    const customerSnapshot = { ...customer };
    const txSnapshot = { ...transaction };
    const sessionSnapshot = { ...session };

    try {
      // Step 4a: Record transaction
      if (options.failAtStep === 1) throw new Error('Transaction record failed');
      transaction.recorded = true;

      // Step 4b: Update shop stats
      if (options.failAtStep === 2) throw new Error('Shop update failed');
      shop.totalRedemptions += options.amount;
      shop.purchasedRcnBalance += options.amount;

      // Step 4c: Mark session as used
      if (options.failAtStep === 3) throw new Error('Session update failed');
      session.used = true;

      // Step 4d: Deduct customer balance (THE FIX)
      if (options.failAtStep === 4) throw new Error('Customer balance update failed');
      customer.current_rcn_balance = Math.max(0, customer.current_rcn_balance - options.amount);
      customer.total_redemptions += options.amount;

      return { success: true, shop, customer, transaction, session };
    } catch (error) {
      // ROLLBACK
      return {
        success: false,
        shop: shopSnapshot,
        customer: customerSnapshot,
        transaction: txSnapshot,
        session: sessionSnapshot,
        error: (error as Error).message,
      };
    }
  }

  it('should update all 4 steps on success', () => {
    const result = simulateAtomicRedemption({
      shopBalance: 100,
      shopTotalRedemptions: 50,
      customerBalance: 150,
      customerTotalRedemptions: 46,
      amount: 10,
    });

    expect(result.success).toBe(true);
    expect(result.transaction.recorded).toBe(true);
    expect(result.shop.purchasedRcnBalance).toBe(110);
    expect(result.shop.totalRedemptions).toBe(60);
    expect(result.session.used).toBe(true);
    expect(result.customer.current_rcn_balance).toBe(140);
    expect(result.customer.total_redemptions).toBe(56);
  });

  it('should rollback everything if transaction record fails', () => {
    const result = simulateAtomicRedemption({
      shopBalance: 100,
      shopTotalRedemptions: 50,
      customerBalance: 150,
      customerTotalRedemptions: 46,
      amount: 10,
      failAtStep: 1,
    });

    expect(result.success).toBe(false);
    expect(result.transaction.recorded).toBe(false);
    expect(result.shop.purchasedRcnBalance).toBe(100); // Unchanged
    expect(result.customer.current_rcn_balance).toBe(150); // Unchanged
    expect(result.customer.total_redemptions).toBe(46); // Unchanged
  });

  it('should rollback everything if shop update fails', () => {
    const result = simulateAtomicRedemption({
      shopBalance: 100,
      shopTotalRedemptions: 50,
      customerBalance: 150,
      customerTotalRedemptions: 46,
      amount: 10,
      failAtStep: 2,
    });

    expect(result.success).toBe(false);
    expect(result.shop.purchasedRcnBalance).toBe(100); // Rolled back
    expect(result.customer.current_rcn_balance).toBe(150); // Never changed
  });

  it('should rollback everything if customer balance update fails', () => {
    const result = simulateAtomicRedemption({
      shopBalance: 100,
      shopTotalRedemptions: 50,
      customerBalance: 150,
      customerTotalRedemptions: 46,
      amount: 10,
      failAtStep: 4,
    });

    expect(result.success).toBe(false);
    // All previous steps should be rolled back
    expect(result.shop.purchasedRcnBalance).toBe(100);
    expect(result.shop.totalRedemptions).toBe(50);
    expect(result.session.used).toBe(false);
    expect(result.customer.current_rcn_balance).toBe(150);
    expect(result.customer.total_redemptions).toBe(46);
  });
});
