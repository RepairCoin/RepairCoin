# CLAUDE.md - Mobile App Guidelines

## Quick Commands

```bash
# Development
npm install                    # Install dependencies
npx expo start                 # Start dev server (Expo Go)
npx expo run:android           # Run on Android device/emulator
npx expo run:ios               # Run on iOS simulator (macOS)
npx expo prebuild --clean      # Regenerate native projects

# Building
npx eas build --profile tester --platform android
npx eas build --profile tester --platform ios

# Troubleshooting
npx expo start --clear         # Clear Metro cache
cd android && ./gradlew clean  # Clean Android build
```

## Architecture

**Tech Stack**: Expo (React Native) + TypeScript + Zustand + NativeWind + TanStack React Query + Thirdweb SDK v5

### Directory Structure

```
app/                    # Expo Router pages (file-based routing)
├── (auth)/            # Auth screens (login, register)
├── (dashboard)/       # Main app screens (tabs)
│   ├── customer/      # Customer role screens
│   └── shop/          # Shop role screens
└── (onboarding)/      # Onboarding flow

feature/               # Feature modules (self-contained)
├── analytics/         # Shop profit/loss analytics
├── appointment/       # Appointment calendar & availability
├── booking/           # Booking management (shop)
├── booking-analytics/ # Booking performance metrics
├── customer/          # Customer management (shop view)
├── home/              # Dashboard home
├── messages/          # In-app messaging
├── service/           # Service marketplace & management
├── service-orders/    # Detailed order list (shop)
└── ...                # See feature/ for full list

shared/                # Shared code across features
├── components/        # Reusable UI components
├── config/            # Query client, app config
├── hooks/             # Custom React hooks (React Query)
├── interfaces/        # TypeScript interfaces
├── services/          # API service functions
├── store/             # Zustand stores
└── utilities/         # Helper functions (axios, calendar, format, etc.)
```

### Feature Module Pattern

Each feature follows this structure:

```
feature/{name}/
├── screens/           # Screen components (exported to app/ routes)
├── components/        # Feature-specific UI components
├── hooks/
│   ├── queries/       # React Query hooks (useXxxQuery)
│   ├── mutations/     # React Query mutation hooks
│   └── ui/            # UI state/logic hooks
├── constants/         # Feature constants
├── services/          # Feature-specific API services (if needed)
├── utils/             # Feature utilities
└── types.ts           # TypeScript types for this feature
```

## Development Guidelines

- **Feature isolation**: Keep feature code in `feature/{name}/`, shared code in `shared/`
- **API calls**: Use existing services in `shared/services/*.services.ts` or `feature/{name}/services/`
- **Data fetching**: Use TanStack React Query via hooks in `feature/{name}/hooks/queries/`
- **State**: Zustand stores in `shared/store/` for global state, React Query for server state
- **Styling**: NativeWind (Tailwind classes) - use `className` prop
- **Types**: Shared interfaces in `shared/interfaces/`, feature types in `feature/{name}/types.ts`
- **Shared utilities**: Common helpers in `shared/utilities/` (calendar, format, etc.) — avoid duplicating across features

## Task Tracking

Tasks are tracked in `docs/tasks/` — see `docs/tasks/RULES.md` for full format guidelines.

```
docs/tasks/
├── RULES.md               # Format rules and templates
├── week-YYYY-MM-DD.md     # Weekly summaries (Monday date)
├── bugs/                  # Bug reports
├── enhancements/          # Features, improvements, refactors
└── completed/             # All finished tasks (moved here when done)
```

Key rules:
- Every new task must have a file in `enhancements/` or `bugs/`
- When completed, move the file to `completed/` and update the weekly summary
- Follow the standard header format defined in RULES.md

## API Integration

Backend runs on port 4000. Base URL configured in `shared/utilities/axios.ts`.

Key services:
- `auth.services.ts` - Authentication
- `customer.services.ts` - Customer data
- `shop.services.ts` - Shop operations
- `booking.services.ts` - Service orders
- `appointment.services.ts` - Appointment scheduling & management
- `notification.services.ts` - Notifications
