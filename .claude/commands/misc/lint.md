# Run Linting (RepairCoin)

Run ESLint and TypeScript checks on RepairCoin codebase to find and fix code quality issues.

## Target

$ARGUMENTS

---

## RepairCoin Linting Commands

### Backend Linting

```bash
# Lint all TypeScript files
cd backend && npm run lint

# Auto-fix linting issues
cd backend && npm run lint:fix

# Type checking only
cd backend && npm run typecheck
```

### Frontend Linting

```bash
# Next.js linting
cd frontend && npm run lint

# Build-time type checking
cd frontend && npm run build
```

---

## ESLint Configuration

RepairCoin backend uses TypeScript ESLint with strict rules:

```json
{
  "parser": "@typescript-eslint/parser",
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": "error",
    "no-console": "off"
  }
}
```

**Key Rules:**
- ❌ **No `any` types** - Must use proper TypeScript types
- ❌ **No unused variables** - Clean code only
- ✅ **Console allowed** - For logging via Winston

---

## Common Linting Issues in RepairCoin

### 1. The `any` Type (BANNED)

**❌ Bad:**
```typescript
async function processData(data: any) {
  return data.map((item: any) => item.value);
}
```

**✅ Good:**
```typescript
interface DataItem {
  value: number;
  name: string;
}

async function processData(data: DataItem[]): number[] {
  return data.map((item) => item.value);
}
```

### 2. Unused Variables

**❌ Bad:**
```typescript
import { Request, Response, NextFunction } from 'express';

export function handler(req: Request, res: Response, next: NextFunction) {
  return res.json({ success: true });
  // next is unused
}
```

**✅ Good:**
```typescript
import { Request, Response } from 'express';

export function handler(req: Request, res: Response) {
  return res.json({ success: true });
}
```

### 3. Missing Return Types

**❌ Bad:**
```typescript
async function getCustomer(address: string) {
  const customer = await repository.find(address);
  return customer;
}
```

**✅ Good:**
```typescript
async function getCustomer(address: string): Promise<Customer | null> {
  const customer = await repository.find(address);
  return customer;
}
```

### 4. Error Handling Without Types

**❌ Bad:**
```typescript
try {
  await operation();
} catch (error) {
  logger.error(error.message);  // error is 'any'
}
```

**✅ Good:**
```typescript
try {
  await operation();
} catch (error: unknown) {
  const err = error as Error;
  logger.error(err.message);
}
```

---

## Auto-Fix Strategy

### Step 1: Run Auto-Fix

```bash
# Backend
cd backend && npm run lint:fix

# Frontend
cd frontend && npm run lint
```

### Step 2: Check What Remains

```bash
# Backend - see remaining issues
cd backend && npm run lint

# Type check
cd backend && npm run typecheck
```

### Step 3: Manual Fixes

Focus on:
1. **Replace `any` with proper types**
2. **Remove unused imports/variables**
3. **Add missing return types**
4. **Fix error handling types**

---

## Domain-Specific Patterns

### Controllers

```typescript
import { Request, Response } from 'express';
import { CustomerService } from '../services/CustomerService';
import { ResponseHelper } from '../../../utils/responseHelper';

export class CustomerController {
  constructor(private customerService: CustomerService) {}

  async getCustomer(req: Request, res: Response): Promise<void> {
    try {
      const { address } = req.params;
      const result = await this.customerService.getCustomerDetails(address);
      ResponseHelper.success(res, result);
    } catch (error: unknown) {
      const err = error as Error;
      if (err.message === 'Customer not found') {
        ResponseHelper.notFound(res, err.message);
      } else {
        ResponseHelper.error(res, err.message, 500);
      }
    }
  }
}
```

### Services

```typescript
import { logger } from '../../../utils/logger';
import { CustomerRepository } from '../../../repositories/CustomerRepository';

interface GetCustomerInput {
  address: string;
  includeTransactions?: boolean;
}

interface CustomerDetails {
  address: string;
  email: string;
  tier: string;
  balance: number;
}

export class CustomerService {
  private customerRepository: CustomerRepository;

  constructor() {
    this.customerRepository = new CustomerRepository();
  }

  async getCustomerDetails(input: GetCustomerInput): Promise<CustomerDetails> {
    logger.info('CustomerService.getCustomerDetails called', { input });

    const customer = await this.customerRepository.findByAddress(input.address);

    if (!customer) {
      throw new Error('Customer not found');
    }

    return {
      address: customer.walletAddress,
      email: customer.email,
      tier: customer.tier,
      balance: customer.balance
    };
  }
}
```

### Routes

```typescript
import { Router } from 'express';
import { authMiddleware, requireRole } from '../../../middleware/auth';
import { validateRequired, validateEthereumAddress, asyncHandler } from '../../../middleware/errorHandler';
import { CustomerController } from '../controllers/CustomerController';
import { CustomerService } from '../services/CustomerService';

const router = Router();

const customerService = new CustomerService();
const customerController = new CustomerController(customerService);

router.get('/:address',
  validateEthereumAddress('address'),
  asyncHandler(customerController.getCustomer.bind(customerController))
);

export default router;
```

---

## TypeScript Strict Mode

RepairCoin uses TypeScript strict mode. Ensure:

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

---

## Pre-Commit Checklist

Before committing:

- [ ] Run `npm run lint:fix` (backend)
- [ ] Run `npm run typecheck` (backend)
- [ ] Run `npm run lint` (frontend)
- [ ] Fix all `any` types
- [ ] Remove unused imports
- [ ] Add missing return types
- [ ] Fix error handling types
- [ ] Verify no TypeScript errors

---

## Common Commands

```bash
# Backend full check
cd backend && npm run lint && npm run typecheck

# Frontend full check
cd frontend && npm run lint && npm run build

# Fix backend issues
cd backend && npm run lint:fix

# Run tests (also checks types)
cd backend && npm test
```

---

## VSCode Integration

Add to `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

---

## Fixing Type Errors

### Database Query Results

**❌ Bad:**
```typescript
const result = await pool.query('SELECT * FROM customers WHERE address = $1', [address]);
return result.rows[0];  // Type is 'any'
```

**✅ Good:**
```typescript
interface CustomerRow {
  wallet_address: string;
  email: string;
  tier: string;
  balance: number;
}

const result = await pool.query<CustomerRow>(
  'SELECT * FROM customers WHERE address = $1',
  [address]
);
return result.rows[0];  // Type is CustomerRow
```

### Request Body

**❌ Bad:**
```typescript
const { field1, field2 } = req.body;  // Types are 'any'
```

**✅ Good:**
```typescript
interface RequestBody {
  field1: string;
  field2: number;
}

const { field1, field2 } = req.body as RequestBody;
```

### Event Handlers

**❌ Bad:**
```typescript
eventBus.subscribe('token.minted', (event) => {
  // event is 'any'
  console.log(event.data);
});
```

**✅ Good:**
```typescript
interface TokenMintedEvent {
  type: 'token.minted';
  aggregateId: string;
  data: {
    amount: number;
    customerAddress: string;
  };
}

eventBus.subscribe('token.minted', (event: TokenMintedEvent) => {
  console.log(event.data.amount);
});
```

---

## Priority Fixes

**🔴 Critical (Fix Immediately):**
- TypeScript errors blocking build
- `any` types (project rule)
- Unused variables in production code

**🟡 Important (Fix Before Commit):**
- Missing return types
- Untyped error handling
- Unused imports

**🟢 Nice to Have:**
- Code formatting
- Comment improvements
- TODO items

---

## Testing After Lint Fixes

```bash
# Ensure everything still works
cd backend && npm run lint && npm run typecheck && npm test

# Or use the full test suite
cd backend && npm run test:coverage
```

---

## Examples

- Customer domain: `backend/src/domains/customer/`
- Shop domain: `backend/src/domains/shop/`
- Admin domain: `backend/src/domains/admin/`

All follow strict TypeScript typing with no `any` usage.
