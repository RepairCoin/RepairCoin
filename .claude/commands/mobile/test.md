---
description: Write or run tests for mobile app code
---

Handle testing for the following mobile app code.

## Target

$ARGUMENTS

## Guidelines

### 1. Determine What's Needed

- **Write tests** — Create new test files for untested code
- **Run tests** — Execute existing tests and report results
- **Fix tests** — Diagnose and fix failing tests

### 2. Test Structure

Place tests next to the code they test or in a `__tests__/` directory:
```
feature/{name}/
├── hooks/
│   ├── queries/
│   │   ├── useExampleQuery.ts
│   │   └── __tests__/
│   │       └── useExampleQuery.test.ts
├── utils/
│   ├── helpers.ts
│   └── __tests__/
│       └── helpers.test.ts
```

### 3. What to Test

**Utility functions** — Pure logic, edge cases, error handling
**Custom hooks** — Query behavior, state changes, side effects
**Components** — Rendering, user interactions, conditional display

### 4. Test Patterns

```typescript
import { renderHook, waitFor } from '@testing-library/react-native';

describe('useExampleQuery', () => {
  it('should fetch data successfully', async () => {
    // arrange, act, assert
  });

  it('should handle error state', async () => {
    // test error case
  });
});
```

### 5. Running Tests

```bash
cd mobile && npm test                    # Run all tests
cd mobile && npm test -- --watch         # Watch mode
cd mobile && npm test -- path/to/file    # Specific file
```

## Output

1. Test files created or updated
2. Test results if running
3. Explanation of what's covered and any gaps
