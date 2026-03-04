# RepairCoin Mobile App - Build & Deployment Guide

This guide covers how to build, deploy, and distribute the RepairCoin mobile app for iOS.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Running in Development](#running-in-development)
3. [Building for Staging (Preview)](#building-for-staging-preview)
4. [Building for TestFlight](#building-for-testflight)
5. [Submitting to TestFlight](#submitting-to-testflight)
6. [Building for Production](#building-for-production)
7. [Installing on Device](#installing-on-device)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

- **Node.js** v20+
- **Xcode** (latest version from Mac App Store)
- **EAS CLI**: `npm install -g eas-cli`
- **Fastlane** (for local builds): `brew install fastlane`
- **CocoaPods**: `sudo gem install cocoapods`

### Required Accounts

- **Apple Developer Account** ($99/year) - https://developer.apple.com
- **Expo Account** (free) - https://expo.dev

### Login to EAS

```bash
eas login
```

---

## Running in Development

### Option 1: Development Build (Recommended)

Build a development client for your device:

```bash
cd mobile
eas build --profile development --platform ios --local
```

Install on device, then start the development server:

```bash
npx expo start --dev-client
```

### Option 2: Expo Go (Limited Features)

```bash
cd mobile
npx expo start
```

Scan the QR code with Expo Go app. Note: Some native features may not work.

---

## Building for Staging (Preview)

Staging builds use `distribution: internal` (Ad Hoc) and connect to the staging API.

### Option A: Local Build (Unlimited, Free)

```bash
cd mobile
eas build --profile preview --platform ios --local
```

**Requirements:**
- Xcode installed
- Fastlane installed
- ~15-20 minutes build time

### Option B: Cloud Build (30/month free)

```bash
cd mobile
eas build --profile preview --platform ios
```

### Environment Variables

Staging builds automatically use these environment variables (configured in `eas.json`):

```
EXPO_PUBLIC_API_URL=https://api-staging.repaircoin.ai/api
APP_ENV=preview
```

### Installing Staging Build

For Ad Hoc (preview) builds, devices must be registered:

1. Register device:
   ```bash
   eas device:create
   ```
2. Send the link to testers
3. Rebuild after device registration
4. Install via Xcode or Diawi

---

## Building for TestFlight

TestFlight builds use `distribution: store` and can be distributed without device registration.

### Step 1: Create App in App Store Connect (First Time Only)

1. Go to https://appstoreconnect.apple.com
2. Click **My Apps** → **+** → **New App**
3. Fill in:
   - **Platform:** iOS
   - **Name:** RepairCoin
   - **Bundle ID:** com.repaircoin.staging
   - **SKU:** repaircoin-staging
4. Note the **Apple ID** number (found in App Information)

### Step 2: Update eas.json (First Time Only)

Update the `submit.testflight` section with your credentials:

```json
"submit": {
  "testflight": {
    "ios": {
      "appleId": "your@email.com",
      "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID"
    }
  }
}
```

### Step 3: Build for TestFlight

**Cloud Build (Recommended for TestFlight):**

```bash
cd mobile
eas build --profile testflight --platform ios
```

**Local Build:**

```bash
cd mobile
eas build --profile testflight --platform ios --local
```

---

## Submitting to TestFlight

### Step 1: Submit the Build

```bash
eas submit --profile testflight --platform ios
```

When prompted:
1. Select **"Select a build from EAS"**
2. Choose your TestFlight build (most recent)

### Step 2: Handle Export Compliance

In App Store Connect, you'll see "Missing Compliance". Click **Manage** and answer:

1. **"Does your app use encryption?"** → **Yes**
2. **"What type of encryption algorithms?"** → **None of the algorithms mentioned above**
3. Save

### Step 3: Add Testers

1. Go to App Store Connect → Your App → **TestFlight**
2. Wait for build to finish processing (~15-30 min)
3. Click **External Testing** → **+** → Create a group
4. Add tester email addresses
5. Click **Submit for Review** (first external build only, ~24-48 hours)

### Step 4: Testers Install the App

Testers will:
1. Receive an email invite
2. Download **TestFlight** app from App Store
3. Accept invite and install your app

---

## Building for Production

Production builds are for App Store release.

### Step 1: Update Environment (if needed)

Ensure `eas.json` production profile has correct environment variables:

```json
"production": {
  "env": {
    "EXPO_PUBLIC_API_URL": "https://api.repaircoin.ai/api",
    "APP_ENV": "production"
  }
}
```

### Step 2: Build

```bash
cd mobile
eas build --profile production --platform ios
```

### Step 3: Submit to App Store

```bash
eas submit --profile production --platform ios
```

---

## Installing on Device

### For Ad Hoc Builds (Preview/Staging)

#### Option 1: Xcode

1. Connect iPhone via USB
2. Open Xcode → **Window** → **Devices and Simulators**
3. Select your device
4. Drag and drop the `.ipa` file

**Note:** Device must have Developer Mode enabled:
- Settings → Privacy & Security → Developer Mode → ON

#### Option 2: Diawi (Share with others)

1. Go to https://www.diawi.com
2. Upload your `.ipa` file
3. Share the link/QR code with testers

#### Option 3: Command Line

```bash
brew install ideviceinstaller
ideviceinstaller -i /path/to/your-app.ipa
```

### For TestFlight Builds

No manual installation needed. Testers use the TestFlight app.

---

## Troubleshooting

### "Device needs to be prepared for development"

Enable Developer Mode on iPhone:
1. Settings → Privacy & Security → Developer Mode → ON
2. Restart device
3. Connect to Xcode and wait for preparation

### "ENOTEMPTY: directory not empty, rmdir .git"

Clear EAS cache and retry:

```bash
rm -rf /var/folders/*/T/eas-build-local-nodejs
rm -rf /var/folders/*/T/eas-cli-nodejs
eas build --profile <profile> --platform ios --local --clear-cache
```

Or use cloud build instead:

```bash
eas build --profile <profile> --platform ios
```

### "Ad Hoc Provisioning Profile" error when submitting

You're submitting a preview build instead of a TestFlight build. Rebuild with:

```bash
eas build --profile testflight --platform ios
```

### TypeScript Errors During Build

Check for errors before building:

```bash
cd mobile
npx tsc --noEmit
```

### Missing Fastlane

Install Fastlane:

```bash
brew install fastlane
```

### Missing eas-cli-local-build-plugin

Install the plugin:

```bash
npm install -g eas-cli-local-build-plugin
```

---

## Build Profiles Summary

| Profile | Distribution | Use Case | Device Registration |
|---------|-------------|----------|---------------------|
| `development` | Internal | Development with hot reload | Required |
| `preview` | Internal | Staging/QA testing | Required |
| `testflight` | Store | Beta testing via TestFlight | Not required |
| `production` | Store | App Store release | Not required |

---

## EAS Build Limits

| Plan | Builds/Month | Queue |
|------|--------------|-------|
| Free | 30 | Standard |
| Production ($99/mo) | Unlimited | Priority |

**Tips to save builds:**
- Use `--local` for unlimited local builds
- Use `eas update` for JS-only changes (unlimited)
- Test thoroughly in development before building

---

## Quick Reference Commands

```bash
# Development
npx expo start --dev-client

# Staging (local)
eas build --profile preview --platform ios --local

# Staging (cloud)
eas build --profile preview --platform ios

# TestFlight (cloud - recommended)
eas build --profile testflight --platform ios

# Submit to TestFlight
eas submit --profile testflight --platform ios

# Production
eas build --profile production --platform ios

# Submit to App Store
eas submit --profile production --platform ios

# Register test device
eas device:create

# Check build status
eas build:list
```

---

## Push Notifications

Push notifications are automatically configured through EAS. When you build with EAS:
- APNs credentials are managed automatically
- Expo Push Service handles delivery
- No manual certificate management needed

Just ensure:
1. `expo-notifications` plugin is in `app.json` ✓ (already configured)
2. Build with EAS (not bare Xcode)
3. Grant notification permissions when prompted in app

---

*Last updated: March 2026*
