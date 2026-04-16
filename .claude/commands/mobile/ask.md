---
description: Ask questions about the mobile codebase and get detailed answers
---

Answer the following question about the mobile codebase.

## Question

$ARGUMENTS

## Guidelines

1. **Search** the codebase to find relevant files and code
2. **Read** the actual source code — don't guess
3. **Explain** clearly with file paths and line references
4. **Show** code snippets where helpful
5. **Suggest** related files or patterns the user might want to look at

Focus on the mobile app at `mobile/`. Reference the feature module pattern:
- Screens: `feature/{name}/screens/`
- Components: `feature/{name}/components/` or `shared/components/`
- Hooks: `feature/{name}/hooks/queries/` and `mutations/`
- Services: `shared/services/` or `feature/{name}/services/`
- State: `shared/store/` (Zustand)
- Routes: `app/` (Expo Router)
