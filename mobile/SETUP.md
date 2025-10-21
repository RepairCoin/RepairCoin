# RepairCoin Mobile App Setup Guide

## Prerequisites

- **Node.js**: v22.13.1 (required)
- **Android Studio**: Latest version with Android SDK
- **Java Development Kit (JDK)**: Version 17 or higher
- **Android Device or Emulator**: API level 23+ (Android 6.0+)

## Initial Setup Steps

### 1. Clean Previous Installation

Remove any existing dependencies and lock files to ensure a clean installation:

```bash
rm -rf node_modules
rm -rf package-lock.json
rm -rf yarn.lock
```

### 2. Install Dependencies

Install all required npm packages:

```bash
npm install
```

### 3. Prebuild Native Projects

Generate native Android and iOS projects:

```bash
npx expo prebuild --clean
```

The `--clean` flag ensures that any existing native directories are cleared before generating new ones.

### 4. Run on Android

Start the app on Android device or emulator:

```bash
npx expo run:android
```

## Alternative Commands

### Run on iOS (macOS only)

```bash
npx expo run:ios
```

### Start Development Server

For development with Expo Go app:

```bash
npx expo start
```

### Build APK for Testing

```bash
cd android
./gradlew assembleRelease
```

The APK will be available at `android/app/build/outputs/apk/release/`

## Troubleshooting

### Common Issues

#### 1. Android Build Errors

If you encounter build errors, try:

```bash
cd android
./gradlew clean
cd ..
npx expo prebuild --clean
npx expo run:android
```

#### 2. Metro Bundler Issues

Clear Metro cache:

```bash
npx expo start --clear
```

#### 3. Gradle Daemon Issues

Stop all Gradle daemons:

```bash
cd android
./gradlew --stop
cd ..
```

#### 4. Java Version Mismatch

Ensure you're using Java 17:

```bash
java -version
```

If not, set JAVA_HOME to point to Java 17 installation.

#### 5. Android SDK Issues

Ensure Android SDK is properly configured:

- Open Android Studio
- Go to Settings > Appearance & Behavior > System Settings > Android SDK
- Install required SDK platforms (API 33+ recommended)
- Install Android SDK Build-Tools

### Port Conflicts

If Metro bundler port (8081) is in use:

```bash
npx expo start --port 8082
```

## Environment Variables

Create `.env` file in the mobile directory if needed:

```bash
cp .env.example .env
```

Configure required environment variables for your mobile app.

## Development Workflow

### Hot Reload

The app supports hot reload by default. Save your changes and they will automatically reflect in the running app.

### Debugging

#### React Native Debugger

1. Shake device or press `Cmd+D` (iOS) / `Cmd+M` (Android emulator)
2. Select "Debug with Chrome" or "Debug with React Native Debugger"

#### Console Logs

View logs in terminal:

```bash
npx expo start --dev-client
```

### Testing on Physical Device

#### Android

1. Enable Developer Mode on your Android device
2. Enable USB Debugging
3. Connect device via USB
4. Run `adb devices` to verify connection
5. Run `npx expo run:android`

## Build for Production

### Android (APK)

```bash
npx expo build:android -t apk
```

### Android (App Bundle)

```bash
npx expo build:android -t app-bundle
```

### iOS (macOS only)

```bash
npx expo build:ios -t archive
```

## Additional Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [Android Studio Setup](https://developer.android.com/studio/install)

## Support

For issues specific to RepairCoin mobile app, please check the main project documentation or contact the development team.