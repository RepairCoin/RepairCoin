---
description: Analyze or design mobile app architecture for a feature or system area
---

Analyze or design the architecture for a mobile app feature or system area.

## Target

$ARGUMENTS

## Analysis Framework

### 1. **Current State Assessment**

- Map existing files, components, hooks, services, and stores involved
- Identify data flow: UI → hooks → services → API → backend
- Document state management approach (Zustand stores vs React Query cache)
- Note any technical debt or architectural issues

### 2. **Component Architecture**

```
Screen (app/ route)
└── Feature Screen (feature/{name}/screens/)
    ├── Feature Components (feature/{name}/components/)
    │   ├── Presentational (UI only)
    │   └── Container (data + logic)
    ├── Shared Components (shared/components/)
    └── Hooks
        ├── Queries (feature/{name}/hooks/queries/)
        ├── Mutations (feature/{name}/hooks/mutations/)
        └── UI Logic (feature/{name}/hooks/ui/)
```

- Identify component boundaries and responsibilities
- Map parent-child relationships and prop drilling
- Flag components that should be split or merged

### 3. **Data Flow Diagram**

```
User Action → Screen → Hook → Service → API (port 4000) → Response
                ↕                                              ↓
          Zustand Store ← React Query Cache ← Transformed Data
```

- Trace each data path end-to-end
- Identify caching strategy (React Query stale times, invalidation)
- Map optimistic updates and error recovery

### 4. **Feature Module Boundaries**

- What belongs in `feature/{name}/` vs `shared/`?
- Cross-feature dependencies (should go through shared modules)
- API service layer organization
- Type definitions placement (`feature/{name}/types.ts` vs `shared/interfaces/`)

### 5. **State Management Strategy**

- **Server state**: React Query (queries, mutations, invalidation)
- **Global client state**: Zustand stores (`shared/store/`)
- **Local UI state**: useState/useReducer within components
- Identify any state that's in the wrong layer

### 6. **Navigation & Routing**

- Expo Router file-based routes in `app/`
- Route groups: `(auth)/`, `(dashboard)/customer/`, `(dashboard)/shop/`
- Deep linking considerations
- Screen params and navigation flow

## Output Format

### Architecture Overview

- High-level diagram of the feature/system area
- Key files and their responsibilities

### Component Tree

- Visual hierarchy of screens and components
- Data dependencies between components

### Data Flow

- API endpoints consumed
- React Query hooks and cache keys
- Zustand store interactions

### Identified Issues

- Architectural violations (cross-feature imports, wrong layer)
- Missing abstractions or over-abstractions
- Performance concerns (unnecessary re-renders, missing memoization)
- Type safety gaps

### Recommendations

- Specific changes with file paths
- Migration steps if refactoring is needed
- Priority order (critical → nice-to-have)

Read the relevant code before providing analysis. Reference specific files and line numbers.
