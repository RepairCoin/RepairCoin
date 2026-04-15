---
description: Scaffold a new feature module with standard directory structure
---

Scaffold a new feature module for the mobile app.

## Feature Specification

$ARGUMENTS

## Feature Module Structure

Create the following directory structure under `feature/{name}/`:

```
feature/{name}/
├── screens/              # Screen components (exported to app/ routes)
│   └── index.ts          # Barrel export
├── components/           # Feature-specific UI components
│   └── index.ts          # Barrel export
├── hooks/
│   ├── queries/          # React Query fetch hooks
│   ├── mutations/        # React Query mutation hooks
│   └── ui/               # UI state/logic hooks
├── constants/            # Feature constants
│   └── index.ts
├── services/             # Feature-specific API services (if needed)
├── utils/                # Feature utilities
├── types.ts              # TypeScript types for this feature
└── index.ts              # Main barrel export
```

## Guidelines

### 1. **Feature Isolation**

- Keep all feature-specific code inside `feature/{name}/`
- Import shared code from `shared/` (components, hooks, services, utilities)
- Do NOT import from other features directly — use shared modules

### 2. **Naming Conventions**

- Feature directory: kebab-case (`booking-analytics`)
- Screen files: PascalCase (`BookingAnalyticsScreen.tsx`)
- Component files: PascalCase (`BookingCard.tsx`)
- Hook files: camelCase with `use` prefix (`useBookingQuery.ts`)
- Service files: kebab-case with `.services.ts` suffix
- Type files: `types.ts`

### 3. **Routing Integration**

- Create route files in `app/` that import from the feature screens
- Follow Expo Router file-based routing conventions
- Place under appropriate group: `(auth)/`, `(dashboard)/customer/`, `(dashboard)/shop/`

### 4. **Types**

Define feature types in `types.ts`:
```typescript
export interface FeatureEntity {
  id: string;
  // ...
}

export interface FeatureParams {
  // query params
}
```

## What to Generate

1. **Directory structure** with all folders
2. **types.ts** with initial interfaces based on the feature description
3. **Barrel exports** (index.ts files)
4. **Initial screen** if feature purpose is clear
5. **Route file** in `app/`

Look at existing features in `feature/` for reference patterns.
