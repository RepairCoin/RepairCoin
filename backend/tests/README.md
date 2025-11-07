# RepairCoin Backend Tests

This directory contains comprehensive test suites for the RepairCoin backend, organized by user perspective and test type.

## Test Structure

```
tests/
├── admin/               # Admin-specific tests
│   ├── admin.auth.test.ts
│   ├── admin.shop-management.test.ts
│   └── admin.treasury.test.ts
├── shop/                # Shop-specific tests
│   ├── shop.registration.test.ts
│   └── shop.operations.test.ts
├── customer/            # Customer-specific tests
│   ├── customer.registration.test.ts
│   ├── customer.earnings.test.ts
│   ├── customer.edge-cases.test.ts
│   └── customer.comprehensive.test.ts
├── integration/         # End-to-end integration tests
│   └── full-flow.test.ts
├── unit/                # Unit tests for specific features
│   └── wallet-detection.test.ts
└── setup.ts            # Global test setup
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific test suite
npm test -- admin.auth
npm test -- shop.registration
npm test -- customer.earnings

# Run tests for a specific role
npm test -- tests/admin
npm test -- tests/shop
npm test -- tests/customer
```

## Test Coverage Areas

### Admin Tests
- **Authentication**: Admin JWT generation, role validation
- **Shop Management**: Shop approval, listing, RCN sales
- **Treasury Management**: Stats, transactions, alerts
- **Analytics**: Platform metrics, monitoring

### Shop Tests
- **Registration**: New shop signup, role exclusivity
- **Operations**: Issue rewards, process redemptions
- **Customer Management**: List customers, analytics
- **RCN Management**: Purchase tracking, balance checks

### Customer Tests
- **Registration**: New customer signup, referrals
- **Earnings**: Repair rewards, tier bonuses, limits
- **Redemptions**: Home vs cross-shop, session approval
- **Analytics**: Transaction history, tier progression

## Key Testing Patterns

### 1. Role Exclusivity Testing
Every registration test verifies that wallets can only have one role:
```typescript
it('should reject registration if wallet is already a customer', async () => {
  // Test implementation
});
```

### 2. Daily/Monthly Limit Testing
Tests verify the 50 RCN daily and 500 RCN monthly limits:
```typescript
it('should enforce daily earning limit', async () => {
  // Customer has earned 45 RCN today
  // Trying to earn 25 more should fail
});
```

### 3. Tier Bonus Testing
Tests verify correct tier bonuses are applied:
- Bronze: +10 RCN per repair
- Silver: +20 RCN per repair
- Gold: +30 RCN per repair

### 4. Cross-Shop Redemption Testing
Tests verify the 20% cross-shop redemption limit:
```typescript
it('should enforce 20% limit for cross-shop redemption', async () => {
  // Customer with 100 earned RCN
  // Can only redeem 20 RCN at non-home shop
});
```

### 5. Referral System Testing
Tests verify the two-stage referral process:
- Referral tracked on registration
- Rewards distributed after first repair

## Mock Strategy

All external dependencies are mocked:
- Database repositories
- Blockchain services (Thirdweb)
- Token operations
- Transaction logging

## Environment Variables

Test-specific environment variables can be set in `.env.test`:
```
NODE_ENV=test
JWT_SECRET=test-secret
ADMIN_ADDRESSES=0x742d35Cc6634C0532925a3b844Bc9e7595f1234
```

## Writing New Tests

When adding new tests:
1. Follow the existing file naming convention
2. Group related tests in describe blocks
3. Use clear, descriptive test names
4. Mock all external dependencies
5. Test both success and failure cases
6. Verify error messages and status codes

Example structure:
```typescript
describe('Feature Name', () => {
  describe('POST /api/endpoint', () => {
    it('should handle success case', async () => {
      // Arrange
      // Act
      // Assert
    });
    
    it('should handle validation error', async () => {
      // Test validation
    });
    
    it('should handle authorization error', async () => {
      // Test auth
    });
  });
});
```

## Coverage Goals

- Minimum 80% line coverage
- Minimum 80% function coverage
- Minimum 70% branch coverage
- Focus on critical business logic

## Continuous Integration

These tests are designed to run in CI/CD pipelines:
- Fast execution (< 5 minutes)
- No external dependencies
- Deterministic results
- Clear failure messages