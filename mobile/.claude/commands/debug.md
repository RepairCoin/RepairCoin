---
description: Diagnose and fix common mobile app issues
---

Diagnose and help fix the following mobile app issue.

## Issue

$ARGUMENTS

## Diagnostic Steps

### 1. **Identify the Problem Category**

- **Build error** → Check native project config, dependencies, Expo config
- **Runtime crash** → Check error boundaries, null checks, async handling
- **UI bug** → Check NativeWind styles, layout, platform differences
- **Data issue** → Check React Query hooks, API services, Zustand stores
- **Navigation issue** → Check Expo Router config, route files, deep links
- **Performance** → Check re-renders, list optimization, image loading

### 2. **Common Fixes**

**Metro/Cache Issues**
```bash
npx expo start --clear
```

**Native Build Issues**
```bash
npx expo prebuild --clean
cd android && ./gradlew clean
```

**Dependency Issues**
```bash
rm -rf node_modules && npm install
npx expo install --fix  # Fix version mismatches
```

**TypeScript Errors**
```bash
npx tsc --noEmit
```

### 3. **Investigation Approach**

1. Read the error message carefully
2. Find the relevant source files
3. Check recent changes that may have caused it
4. Look at similar working code for reference
5. Propose a minimal fix

## What to Do

1. **Analyze** the error/issue described
2. **Find** the relevant files in the codebase
3. **Diagnose** the root cause
4. **Fix** the issue with minimal changes
5. **Explain** what went wrong and why the fix works
