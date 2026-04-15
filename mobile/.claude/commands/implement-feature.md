---
description: Implement a new feature in the mobile app end-to-end
---

Implement the following feature in the mobile app.

## Feature

$ARGUMENTS

## Process

### 1. Plan
- Understand the requirements
- Identify which feature module this belongs to (existing or new)
- List all files to create/modify
- Check existing patterns for reference

### 2. Implement (follow feature module pattern)

**Types** → `feature/{name}/types.ts`
- Define interfaces for data models, params, props

**Services** → `shared/services/` or `feature/{name}/services/`
- API calls using axios from `shared/utilities/axios.ts`

**Hooks** → `feature/{name}/hooks/`
- `queries/` for data fetching (useQuery)
- `mutations/` for data changes (useMutation)
- `ui/` for UI logic

**Components** → `feature/{name}/components/`
- Feature-specific UI components with NativeWind styling

**Screens** → `feature/{name}/screens/`
- Screen components composing hooks + components

**Routes** → `app/`
- Expo Router route files importing from feature screens

### 3. Integration
- Wire up navigation
- Connect to existing state/stores if needed
- Handle loading, error, and empty states

### 4. Verify
- List manual testing steps
- Note edge cases to check

## Guidelines
- Use NativeWind for styling
- Use TanStack React Query for server state
- Follow existing code patterns — check similar features first
- Keep components small and focused
- No `any` types
