---
description: Plan and execute data or schema migrations for the mobile app
---

Handle the following migration for the mobile app.

## Migration

$ARGUMENTS

## Types of Migration

### API/Backend Changes
- Identify affected services in `shared/services/`
- Update TypeScript interfaces in `shared/interfaces/` or `feature/{name}/types.ts`
- Update React Query hooks that consume changed endpoints
- Handle backward compatibility if API versions coexist
- Update any hardcoded values or constants

### State/Store Migration
- Update Zustand stores in `shared/store/`
- Handle persisted state (AsyncStorage) migration
- Clear stale cache if data shape changed

### Navigation/Route Migration
- Update Expo Router files in `app/`
- Handle deep link changes
- Update any hardcoded route references

### Dependency Migration
- Check compatibility with Expo SDK version
- Update import paths if package APIs changed
- Run `npx expo install --fix` for version alignment

## Process

1. **Assess** — What's changing and what depends on it
2. **Plan** — List all files that need updates
3. **Execute** — Make changes systematically
4. **Verify** — Ensure nothing breaks, list testing steps
