---
description: Create a new React Query hook (query or mutation) for data fetching
---

Create a new TanStack React Query hook for the mobile app.

## Hook Specification

$ARGUMENTS

## Guidelines

### 1. **Hook Types**

**Query Hook** (fetching data) → `feature/{name}/hooks/queries/`
```typescript
import { useQuery } from '@tanstack/react-query';

export const useExampleQuery = (params?: ExampleParams) => {
  return useQuery({
    queryKey: ['example', params],
    queryFn: () => exampleService.getExample(params),
    enabled: !!params?.id, // conditional fetching
  });
};
```

**Mutation Hook** (creating/updating/deleting) → `feature/{name}/hooks/mutations/`
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useExampleMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ExampleInput) => exampleService.createExample(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['example'] });
    },
  });
};
```

### 2. **API Services**

- Use existing services from `shared/services/*.services.ts`
- Or create feature-specific services in `feature/{name}/services/`
- API calls use axios configured in `shared/utilities/axios.ts`

### 3. **Query Keys**

- Use descriptive, hierarchical keys: `['feature', 'entity', params]`
- Keep consistent with existing patterns in the codebase

### 4. **Best Practices**

- Set `enabled` option for conditional fetching
- Invalidate related queries on mutation success
- Handle optimistic updates where appropriate
- Add proper TypeScript types for params and return data
- Use `select` to transform data when needed

## What to Generate

1. **Hook file** in the appropriate directory
2. **Service function** if a new API call is needed
3. **Types** for request/response data
4. **Example usage** in a component

Check existing hooks in the codebase for patterns and query key conventions.
