# iOS Build & Deployment Guide

## Overview

This guide covers building and deploying the RepairCoin iOS app to TestFlight and App Store.

---

## Prerequisites

1. **EAS CLI installed:**
   ```bash
   npm install -g eas-cli
   ```

2. **Logged into Expo:**
   ```bash
   eas login
   ```

3. **Apple Developer Account** with:
   - App Store Connect access
   - Valid distribution certificate
   - Provisioning profiles (EAS can manage these)

4. **GoogleService-Info.plist** - Firebase config for iOS (if using Firebase)

---

## Build Profiles

| Profile | Environment | Distribution | Use Case |
|---------|-------------|--------------|----------|
| `development` | Development | Internal | Local testing with dev client |
| `preview` | Staging | Internal | QA testing (Ad-hoc) |
| `testflight` | Staging | Store | TestFlight internal/external testing |
| `production` | Production | Store | App Store release |

---

## Staging Build (TestFlight)

### Step 1: Build IPA

```bash
cd mobile
eas build --profile testflight --platform ios
```

This will:
- Build an iOS archive (IPA)
- Auto-increment build number
- Use staging API: `https://api-staging.repaircoin.ai/api`
- Use Base Sepolia testnet

### Step 2: Submit to TestFlight

**Option A: Auto-submit**
```bash
eas submit --profile testflight --platform ios --latest
```

You'll need:
- Apple ID: `sanggoyodk8@gmail.com` (configured in eas.json)
- App Store Connect App ID: `6759975798`
- App-specific password (generate at appleid.apple.com)

**Option B: Manual upload via Transporter**
1. Download IPA from Expo build page
2. Open **Transporter** app (from Mac App Store)
3. Sign in with Apple ID
4. Drag and drop the IPA
5. Click **Deliver**

**Option C: Manual upload via Xcode**
1. Download IPA from Expo
2. Open Xcode → **Window** → **Organizer**
3. Click **+** and select the IPA
4. Click **Distribute App**

### Step 3: TestFlight Setup

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select your app → **TestFlight** tab
3. Wait for build processing (5-30 minutes)
4. Add testers:
   - **Internal testers**: Up to 100, immediate access
   - **External testers**: Requires Beta App Review

---

## Production Build (App Store)

### Step 1: Build IPA

```bash
cd mobile
eas build --profile production --platform ios
```

### Step 2: Submit to App Store

```bash
eas submit --profile production --platform ios --latest
```

### Step 3: App Store Connect

1. Go to App Store Connect
2. Select app → **App Store** tab
3. Create new version
4. Select the build
5. Fill in metadata, screenshots, description
6. Submit for review

---

## Development/Preview Builds

For internal testing without App Store:

```bash
# Development build (with dev client, simulator support)
eas build --profile development --platform ios

# Preview build (Ad-hoc for physical devices)
eas build --profile preview --platform ios
```

**Note:** Preview builds require devices to be registered in Apple Developer Portal.

### Register a device:
```bash
eas device:create
```

---

## Useful Commands

```bash
# Check build status
eas build:list --platform ios --limit 5

# View specific build
eas build:view <BUILD_ID>

# Cancel a build
eas build:cancel <BUILD_ID>

# Check/manage credentials
eas credentials --platform ios

# Register test devices
eas device:create

# Run diagnostics
eas diagnostics
```

---

## Credentials Management

EAS can manage iOS credentials automatically, or you can use your own:

```bash
# View current credentials
eas credentials --platform ios

# Sync credentials from Apple
eas credentials --platform ios
# Select: "Fetch distribution certificate and provisioning profile from Apple"
```

### Required credentials:
- **Distribution Certificate** - Signs the app
- **Provisioning Profile** - Links certificate + app ID + devices
- **Push Notification Key** - For push notifications (APNs)

---

## Environment Variables

Staging (`testflight` profile):
- `EXPO_PUBLIC_API_URL`: https://api-staging.repaircoin.ai/api
- `EXPO_PUBLIC_NETWORK`: base-sepolia
- `EXPO_PUBLIC_CHAIN_ID`: 84532

Production (`production` profile):
- Configure in eas.json under `production.env`

---

## Troubleshooting

### Build fails with signing error
```bash
# Reset credentials and let EAS regenerate
eas credentials --platform ios
# Select: "Remove Distribution Certificate"
# Then rebuild - EAS will create new certificate
```

### "No matching provisioning profile"
```bash
eas credentials --platform ios
# Select: "Set up a new provisioning profile"
```

### TestFlight build stuck in "Processing"
- Usually takes 5-30 minutes
- Check App Store Connect for any compliance issues
- Ensure bundle ID matches

### App-specific password required
1. Go to https://appleid.apple.com
2. Sign in → **Security** → **App-Specific Passwords**
3. Generate new password
4. Use when prompted by EAS submit

---

## Push Notifications Setup

To enable push notifications:

1. **Generate APNs Key:**
   - Apple Developer Portal → **Keys** → **Create Key**
   - Enable "Apple Push Notifications service (APNs)"
   - Download the `.p8` file

2. **Upload to Expo:**
   ```bash
   eas credentials --platform ios
   # Select: "Push Notifications: Manage your Apple Push Notifications Key"
   # Upload the .p8 file
   ```

---

## Release Checklist

- [ ] Code merged to correct branch
- [ ] Environment variables configured in eas.json
- [ ] Run build command
- [ ] Verify build succeeds on Expo dashboard
- [ ] Submit to TestFlight/App Store
- [ ] Wait for processing to complete
- [ ] Add testers (TestFlight)
- [ ] For App Store: Complete metadata, screenshots
- [ ] Submit for review (production only)
- [ ] Notify QA team

---

## App Store Connect Configuration

Current settings in eas.json:
```json
{
  "submit": {
    "testflight": {
      "ios": {
        "appleId": "sanggoyodk8@gmail.com",
        "ascAppId": "6759975798"
      }
    }
  }
}
```

---

## Links

- [Expo Build Dashboard](https://expo.dev/accounts/repaircoin/projects/repaircoin-app/builds)
- [App Store Connect](https://appstoreconnect.apple.com)
- [Apple Developer Portal](https://developer.apple.com)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [EAS Submit Documentation](https://docs.expo.dev/submit/introduction/)
