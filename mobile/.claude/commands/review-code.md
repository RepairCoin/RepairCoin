---
description: Review mobile app code for issues, bugs, and improvements
---

Review the following code in the mobile app.

## Target

$ARGUMENTS

## Review Checklist

### Correctness
- Logic errors or edge cases
- Null/undefined handling
- Async/await correctness
- Race conditions

### TypeScript
- Any `any` types that should be typed
- Missing or incorrect type annotations
- Proper use of interfaces vs types

### React/React Native
- Missing dependencies in useEffect/useMemo/useCallback
- Memory leaks (unsubscribed listeners, timers)
- Unnecessary re-renders
- Proper key props in lists

### Data Fetching
- React Query hook usage (queryKey correctness, enabled conditions)
- Error handling for API calls
- Loading state handling
- Cache invalidation after mutations

### Mobile-Specific
- Safe area handling
- Keyboard avoidance
- Platform differences (iOS vs Android)
- Accessibility (labels, roles)
- Performance on low-end devices

### Security
- Sensitive data exposure
- Input validation
- Token/auth handling

## Output Format

For each issue found:
- **File:Line** — Description of issue
- **Severity**: Critical / Warning / Suggestion
- **Fix**: Recommended change

End with a summary: what's good, what needs attention.
