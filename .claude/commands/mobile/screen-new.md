---
description: Create a new screen in a feature module with proper routing setup
---

Create a new screen for the mobile app following the feature module pattern.

## Screen Specification

$ARGUMENTS

## Guidelines

### 1. **Feature Module Pattern**

Screens live inside their feature module:

```
feature/{name}/
├── screens/           # Screen components
├── components/        # Feature-specific UI components
├── hooks/
│   ├── queries/       # React Query hooks
│   ├── mutations/     # Mutation hooks
│   └── ui/            # UI state hooks
├── constants/
├── types.ts
└── utils/
```

### 2. **Screen Structure**

```typescript
import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ScreenNameProps {
  // typed props
}

export default function ScreenName({ }: ScreenNameProps) {
  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Screen content */}
    </SafeAreaView>
  );
}
```

### 3. **Routing**

- Screens are exported to `app/` directory routes via Expo Router
- Use file-based routing: `app/(dashboard)/customer/screen-name.tsx` or `app/(dashboard)/shop/screen-name.tsx`
- The route file should import and re-export the screen from the feature module

### 4. **Styling**

- Use NativeWind (Tailwind classes) via `className` prop
- Use `SafeAreaView` for top-level container
- Follow existing screen patterns in the codebase

### 5. **Data Fetching**

- Use TanStack React Query hooks from `feature/{name}/hooks/queries/`
- Create new query/mutation hooks if needed
- Use existing services from `shared/services/` or create feature-specific ones

### 6. **State**

- Zustand stores in `shared/store/` for global state
- React Query for server state
- Local `useState` for UI-only state

## What to Generate

1. **Screen component** in `feature/{name}/screens/`
2. **Route file** in `app/` directory
3. **Any needed hooks** (queries/mutations)
4. **Any needed components** (feature-specific)
5. **Types** if new interfaces are needed

Follow existing patterns in the codebase. Check similar screens for reference.
