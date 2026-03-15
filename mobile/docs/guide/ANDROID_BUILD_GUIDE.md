# Android Build & Deployment Guide

## Overview

This guide covers building and deploying the RepairCoin Android app to Google Play Console.

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

3. **google-services.json** - Firebase config file at `mobile/google-services.json`

4. **Google Play Service Account** (for auto-submit) - `mobile/google-play-service-account.json`

---

## Build Profiles

| Profile | Environment | Output | Distribution | Use Case |
|---------|-------------|--------|--------------|----------|
| `development` | Development | APK | Internal | Local testing with dev client |
| `preview` | Staging | APK | Internal | QA testing (installable APK) |
| `testflight` | Staging | AAB | Store | Internal Testing on Play Console |
| `production` | Production | AAB | Store | Production release |

---

## Staging Build (Internal Testing)

### Step 1: Build AAB

```bash
cd mobile
eas build --profile testflight --platform android
```

This will:
- Build an Android App Bundle (AAB)
- Auto-increment version code
- Use staging API: `https://api-staging.repaircoin.ai/api`
- Use Base Sepolia testnet

### Step 2: Submit to Play Console

**Option A: Auto-submit (requires service account)**
```bash
eas submit --profile testflight --platform android --latest
```

**Option B: Manual upload**
1. Download AAB from Expo build page
2. Go to [Google Play Console](https://play.google.com/console)
3. Select app → **Testing** → **Internal testing**
4. Click **Create new release**
5. Upload the `.aab` file
6. Add release notes
7. Click **Review release** → **Start rollout**

---

## Production Build

### Step 1: Build AAB

```bash
cd mobile
eas build --profile production --platform android
```

This will:
- Build an Android App Bundle (AAB)
- Auto-increment version code
- Use production environment variables

### Step 2: Submit to Play Console

**Option A: Auto-submit**
```bash
eas submit --profile production --platform android --latest
```

**Option B: Manual upload**
1. Download AAB from Expo build page
2. Go to Play Console → **Production** track
3. Create new release and upload

---

## Development/Preview Builds (APK)

For quick testing without Play Console:

```bash
# Development build (with dev client)
eas build --profile development --platform android

# Preview build (release APK for QA)
eas build --profile preview --platform android
```

These create APK files that can be installed directly via:
- Download link from Expo
- `adb install app.apk`
- Direct device installation

---

## Useful Commands

```bash
# Check build status
eas build:list --platform android --limit 5

# View specific build
eas build:view <BUILD_ID>

# Cancel a build
eas build:cancel <BUILD_ID>

# Check credentials
eas credentials --platform android

# Run diagnostics
eas diagnostics
```

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

### Build fails with "google-services.json missing"
- Ensure `google-services.json` is at `mobile/google-services.json`
- Ensure it's tracked in git (not gitignored)
- Package name must match: `com.repaircoin.staging`

### Auto-submit fails
- Ensure `google-play-service-account.json` exists
- Service account must have Play Console permissions

### Version code conflict
- EAS auto-increments, but if conflict occurs:
  ```bash
  eas build:version:set --platform android
  ```

---

## Release Checklist

- [ ] Code merged to correct branch
- [ ] Environment variables configured in eas.json
- [ ] google-services.json up to date
- [ ] Run build command
- [ ] Verify build succeeds on Expo dashboard
- [ ] Download and test APK/AAB if needed
- [ ] Submit to Play Console
- [ ] Add testers (Internal testing)
- [ ] Notify QA team

---

## Links

- [Expo Build Dashboard](https://expo.dev/accounts/repaircoin/projects/repaircoin-app/builds)
- [Google Play Console](https://play.google.com/console)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
