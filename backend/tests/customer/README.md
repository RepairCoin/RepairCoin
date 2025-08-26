# Customer Feature Test Suite

This directory contains comprehensive test cases for all customer-related features in the RepairCoin backend.

## Test Files

1. **customer.comprehensive.test.ts** - Main test suite covering all customer features
2. **customer.edge-cases.test.ts** - Edge cases and error scenarios
3. **customer.registration.test.ts** - Original registration tests
4. **customer.earnings.test.ts** - Original earnings tests

## Feature Coverage

### 1. Registration & Profile Management ✓
- **Registration**
  - ✓ New customer registration
  - ✓ Role conflict validation (prevents wallet from being shop/admin)
  - ✓ Referral code processing during registration
  - ✓ Input validation (wallet address, email, phone)
  - ✓ Duplicate registration prevention
- **Profile Management**
  - ✓ Get customer profile
  - ✓ Update customer profile (name, email, phone)
  - ✓ Authorization checks (can only update own profile)

### 2. Tier System & Bonuses ✓
- **Tier Progression**
  - ✓ Bronze tier identification (0-199 RCN)
  - ✓ Silver tier identification (200-999 RCN)
  - ✓ Gold tier identification (1000+ RCN)
  - ✓ Tier boundary edge cases
- **Tier Bonuses**
  - ✓ +10 RCN bonus for Bronze tier
  - ✓ +20 RCN bonus for Silver tier
  - ✓ +30 RCN bonus for Gold tier

### 3. Transaction & Earnings ✓
- **Transaction History**
  - ✓ Get all transactions
  - ✓ Filter transactions by type (mint, redeem, transfer)
  - ✓ Pagination support
- **Earning Limits**
  - ✓ Daily earning limit enforcement (50 RCN)
  - ✓ Monthly earning limit enforcement (500 RCN)
  - ✓ Daily limit reset after midnight
  - ✓ Monthly limit reset after month change
- **Analytics**
  - ✓ Customer analytics (total earned, spent, transaction count)
  - ✓ Earning trends
  - ✓ Favorite shop identification

### 4. Referral System ✓
- **Referral Code**
  - ✓ Unique 8-character code generation
  - ✓ Case-insensitive referral code matching
  - ✓ Self-referral prevention
  - ✓ Invalid referral code handling
- **Referral Tracking**
  - ✓ Referral statistics (successful, pending, total earned)
  - ✓ Two-phase rewards (pending → completed)
  - ✓ Referral completion on first repair
- **Rewards**
  - ✓ 25 RCN for referrer
  - ✓ 10 RCN bonus for referee

### 5. Cross-Shop Features ✓
- **Cross-Shop Verification**
  - ✓ 20% balance limit for cross-shop redemptions
  - ✓ Exact percentage calculations
  - ✓ Fractional RCN handling
- **Home Shop Detection**
  - ✓ Home shop identification for 100% redemption
  - ✓ Cross-shop vs home shop distinction

### 6. Redemption Sessions ✓
- **Session Creation**
  - ✓ Get active redemption sessions
  - ✓ Session expiration (5 minutes)
- **Session Management**
  - ✓ Approve redemption session
  - ✓ Reject redemption session
  - ✓ Authorization checks

### 7. Data Export ✓
- **Export Functionality**
  - ✓ Export customer data (profile, transactions, referrals)
  - ✓ Authorization checks (can only export own data)
  - ✓ Export date tracking

### 8. Suspension & Activation ✓
- **Account Status**
  - ✓ Suspended account detection
  - ✓ Block suspended customers from authentication
  - ✓ Suspension reason tracking

### 9. Earning Source Tracking ✓
- **Earning Breakdown**
  - ✓ Breakdown by source (repairs, referrals, tier bonuses, promotions)
  - ✓ Earned vs market-bought distinction
- **Shop Sources**
  - ✓ Earning sources by shop
  - ✓ Primary shop identification

## Edge Cases Covered

### Input Validation
- ✓ Invalid wallet address formats
- ✓ Short wallet addresses
- ✓ Invalid email formats
- ✓ Missing required fields
- ✓ Extremely long input strings
- ✓ Various phone number formats
- ✓ Invalid phone number formats

### Referral Edge Cases
- ✓ Case variations in referral codes
- ✓ Self-referral attempts
- ✓ Non-existent referral codes
- ✓ Already referred customers

### Earning & Limit Edge Cases
- ✓ Customers at daily limit edge (49/50 RCN)
- ✓ Customers at monthly limit edge (499/500 RCN)
- ✓ Daily earnings reset after midnight
- ✓ Monthly earnings reset after month change

### Tier Progression Edge Cases
- ✓ Exact tier boundaries (199/200, 999/1000)
- ✓ Missing tier data handling
- ✓ Tier calculation from earnings

### Redemption Edge Cases
- ✓ Exact 20% cross-shop limit
- ✓ Redemptions exceeding cross-shop limit
- ✓ Fractional RCN amounts
- ✓ Market vs earned token redemption

### Concurrency Edge Cases
- ✓ Simultaneous registration attempts
- ✓ Race condition handling

### Data Integrity Edge Cases
- ✓ Missing or null tier data
- ✓ Null values in optional fields
- ✓ Corrupted data handling

## Running Tests

```bash
# Run all customer tests
npm test tests/customer

# Run specific test file
npm test tests/customer/customer.comprehensive.test.ts

# Run with coverage
npm test -- --coverage tests/customer

# Run in watch mode
npm test -- --watch tests/customer
```

## Test Structure

Each test file follows a consistent structure:
1. Setup and mocks
2. Feature-specific test suites
3. Edge cases and error scenarios
4. Cleanup

## Mock Data

The tests use consistent mock customer data:
- **Bronze Customer**: 150 lifetime earnings, 0 referrals
- **Silver Customer**: 500 lifetime earnings, 2 referrals
- **Gold Customer**: 1500 lifetime earnings, 5 referrals

## Authentication

Tests include proper JWT authentication setup for protected endpoints.

## Coverage Goals

- Unit test coverage: > 80%
- Integration test coverage: > 70%
- Edge case coverage: Comprehensive

## Contributing

When adding new customer features:
1. Add tests to `customer.comprehensive.test.ts`
2. Add edge cases to `customer.edge-cases.test.ts`
3. Update this README with new coverage
4. Ensure all tests pass before committing