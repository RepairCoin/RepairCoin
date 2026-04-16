---
description: Create a new React Native component with NativeWind styling
---

Create a new React Native component for the mobile app.

## Component Specification

$ARGUMENTS

## Guidelines

### 1. **Determine Placement**

- **Shared component** (used across features) → `shared/components/`
- **Feature-specific component** → `feature/{name}/components/`

### 2. **Component Structure**

```typescript
import React from 'react';
import { View, Text, Pressable } from 'react-native';

interface ComponentNameProps {
  // typed props
}

export function ComponentName({ }: ComponentNameProps) {
  return (
    <View className="...">
      {/* component content */}
    </View>
  );
}
```

### 3. **Styling**

- Use NativeWind (Tailwind classes) via `className` prop
- Use React Native core components (`View`, `Text`, `Pressable`, `ScrollView`, etc.)
- Avoid inline style objects when NativeWind classes suffice
- Support dark mode with `dark:` prefix if applicable

### 4. **TypeScript**

- Define props interface
- No `any` types
- Use proper React Native types (`ViewStyle`, `TextStyle`, etc.) when needed

### 5. **Best Practices**

- Keep components small and focused
- Extract complex logic to custom hooks
- Use `Pressable` over `TouchableOpacity` for interactive elements
- Support loading/error/empty states where appropriate
- Follow existing component patterns in the codebase

## What to Generate

1. **Component file** with TypeScript
2. **Props interface** fully typed
3. **Example usage** showing how to import and use

Check existing components in the codebase for style reference.
