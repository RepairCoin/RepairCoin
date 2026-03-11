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

**Tech Stack**: Expo (React Native) + TypeScript + Zustand + NativeWind + Thirdweb SDK v5

### Directory Structure

```
app/                    # Expo Router pages (file-based routing)
├── (auth)/            # Auth screens (login, register)
├── (dashboard)/       # Main app screens (tabs)
└── (onboarding)/      # Onboarding flow

feature/               # Feature modules (self-contained)
├── booking/           # Service booking
├── customer/          # Customer management (shop view)
├── home/              # Dashboard home
├── service/           # Service marketplace
└── ...

shared/                # Shared code across features
├── components/        # Reusable UI components
├── hooks/             # Custom React hooks
├── interfaces/        # TypeScript interfaces
├── services/          # API service functions
├── store/             # Zustand stores
└── utilities/         # Helper functions
```

## Development Guidelines

- **Feature isolation**: Keep feature code in `feature/{name}/`, shared code in `shared/`
- **API calls**: Use existing services in `shared/services/*.services.ts`
- **State**: Zustand stores in `shared/store/` for global state
- **Styling**: NativeWind (Tailwind classes) - use `className` prop
- **Types**: Define interfaces in `shared/interfaces/`

## Task Tracking

Tasks are tracked in `docs/tasks/`:
- `week-YYYY-MM-DD.md` - Weekly summary
- `bugs/` - Bug reports
- `features/` - Feature specs
- `refactor/` - Refactor tasks

## API Integration

Backend runs on port 4000. Base URL configured in `shared/utilities/axios.ts`.

Key services:
- `auth.services.ts` - Authentication
- `customer.services.ts` - Customer data
- `shop.services.ts` - Shop operations
- `booking.services.ts` - Service orders
