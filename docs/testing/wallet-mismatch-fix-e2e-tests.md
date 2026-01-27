# End-to-End Testing: Wallet Mismatch Fix

## Overview

These tests verify that the wallet mismatch fix prevents unwanted account switching when Thirdweb auto-connects to a different wallet than the user's active session.

## Prerequisites

### Test Accounts Required

1. **Shop Account (MetaMask)**
   - Shop ID: `peanut` (or any shop registered with MetaMask)
   - Wallet: External wallet (MetaMask)
   - Email: Must match the email used for Google login

2. **Google Account**
   - Email: Same as shop's registered email (e.g., `kyle.cagunot@mothergooseschools.org`)
   - This creates an embedded wallet with a DIFFERENT address than MetaMask

### Browser Setup

- Use Chrome with DevTools open (F12)
- Console tab to see logs
- Application tab to view localStorage

---

## Test Scenarios

### Test 1: Valid Session + Wrong Wallet Auto-Connect

**Purpose:** Verify that when a valid session exists and Thirdweb auto-connects to a different wallet, the system blocks the switch.

**Steps:**

1. **Clear all state first:**
   ```
   - Open DevTools → Application → Local Storage
   - Delete all keys starting with "thirdweb"
   - Delete cookies for repaircoin.ai
   ```

2. **Login with MetaMask:**
   ```
   - Go to https://repaircoin.ai
   - Click "Sign In"
   - Select "Crypto Wallet" tab
   - Connect with MetaMask (peanut shop wallet)
   - Verify redirected to /shop dashboard
   - Verify console shows: "[AuthInitializer] ✅ Login completed"
   ```

3. **Simulate embedded wallet auto-connect:**
   ```
   - Open a new tab
   - Go to https://repaircoin.ai
   - Click "Sign In"
   - Select "Email" tab
   - Login with Google (same email as shop)
   - This creates/activates the embedded wallet
   - Close this tab
   ```

4. **Return to original shop dashboard:**
   ```
   - Go back to the /shop tab
   - Reload the page (F5)
   ```

5. **Expected Result:**
   ```
   ✅ Console shows: "[AuthInitializer] ⚠️ Wallet mismatch detected!"
   ✅ Toast appears: "Your wallet changed unexpectedly..."
   ✅ Console shows: "[AuthProvider] Clearing localStorage key: thirdweb..."
   ✅ Page reloads after ~3 seconds
   ✅ User is prompted to sign in again (not auto-logged into wrong account)
   ```

**Failure Indicators:**
- ❌ No mismatch warning shown
- ❌ User automatically switched to embedded wallet account
- ❌ Rate limit errors (429) in console
- ❌ Data not loading properly

---

### Test 2: Expired Session + Embedded Wallet on Protected Route

**Purpose:** Verify that when session expires and embedded wallet auto-connects on a protected route, email fallback is blocked.

**Steps:**

1. **Setup:**
   ```
   - Login with MetaMask as peanut shop
   - Navigate to /shop dashboard
   - Note the session expiry (check Network tab for cookie expiry)
   ```

2. **Simulate session expiry:**
   ```
   - Open DevTools → Application → Cookies
   - Delete the "auth_token" and "refresh_token" cookies
   - DO NOT clear localStorage (keep Thirdweb wallet state)
   ```

3. **Ensure embedded wallet will auto-connect:**
   ```
   - In a separate session, login with Google (same email)
   - This ensures embedded wallet state is in localStorage
   ```

4. **Reload the protected route:**
   ```
   - Go to /shop dashboard
   - Reload page (F5)
   ```

5. **Expected Result:**
   ```
   ✅ Console shows: "[AuthInitializer] ⚠️ Blocking auto-login on protected route"
   ✅ Console shows reason: "Embedded wallet auto-connected but no previous session context"
   ✅ Toast appears: "Your session expired. Please sign in again..."
   ✅ Thirdweb localStorage cleared
   ✅ User NOT auto-logged in via email fallback
   ✅ User must explicitly sign in again
   ```

**Failure Indicators:**
- ❌ User automatically logged in via email fallback
- ❌ No blocking warning shown
- ❌ Console shows "[AuthInitializer] 🚀 Creating new session via login()"

---

### Test 3: Intentional Email Fallback Still Works

**Purpose:** Verify that legitimate social login with email fallback still works correctly.

**Steps:**

1. **Clear all state:**
   ```
   - Clear localStorage (all thirdweb keys)
   - Clear cookies
   ```

2. **Login with Google intentionally:**
   ```
   - Go to https://repaircoin.ai
   - Click "Sign In"
   - Select "Email" tab
   - Click "Continue with Email"
   - Choose Google login
   - Use email that matches a shop account
   ```

3. **Expected Result:**
   ```
   ✅ Console shows: "[AuthInitializer] 📧 Found email for social login: <email>"
   ✅ Console shows: "[AuthInitializer] 🚀 Creating new session via login()"
   ✅ User redirected to /shop dashboard
   ✅ Shop data loads correctly
   ✅ No mismatch warnings (this is intentional login)
   ```

**Failure Indicators:**
- ❌ Email fallback blocked incorrectly
- ❌ User redirected to /choose
- ❌ Shop data doesn't load

---

### Test 4: MetaMask Login Without Email Still Works

**Purpose:** Verify that normal MetaMask login without email fallback still works.

**Steps:**

1. **Clear all state:**
   ```
   - Clear localStorage
   - Clear cookies
   ```

2. **Login with MetaMask:**
   ```
   - Go to https://repaircoin.ai
   - Click "Sign In"
   - Select "Crypto Wallet" tab
   - Connect with MetaMask
   ```

3. **Expected Result:**
   ```
   ✅ Console shows: "[AuthInitializer] No email available (expected for external wallets)"
   ✅ Console shows: "[AuthInitializer] 🚀 Creating new session via login()"
   ✅ User redirected to correct dashboard
   ✅ No mismatch warnings
   ```

---

### Test 5: Rate Limiting Prevention

**Purpose:** Verify that the fix prevents the cascade of 401 errors that led to rate limiting.

**Steps:**

1. **Setup the mismatch scenario:**
   ```
   - Login with MetaMask
   - In another tab, login with Google (same email)
   - Return to MetaMask session tab
   ```

2. **Monitor network requests:**
   ```
   - Open DevTools → Network tab
   - Filter by "api" or your API domain
   - Reload the page
   ```

3. **Expected Result:**
   ```
   ✅ Mismatch detected quickly (< 3 API calls)
   ✅ No flood of 401 errors
   ✅ No 429 (rate limit) errors
   ✅ Page handles mismatch gracefully
   ```

**Failure Indicators:**
- ❌ Multiple 401 errors in quick succession
- ❌ 429 rate limit errors
- ❌ Console shows repeated retry attempts

---

## Console Log Patterns

### Successful Mismatch Detection
```
[AuthInitializer] Account connected: 0x6Cbe...
[AuthInitializer] 🔍 Checking for existing session...
[AuthInitializer] Session check result: {isValid: true, user: {...}}
[AuthInitializer] ⚠️ Wallet mismatch detected!
  sessionWallet: 0xb3afc...
  connectedWallet: 0x6Cbe...
[AuthProvider] ⚠️ Wallet mismatch detected
[AuthProvider] Clearing localStorage key: thirdweb:...
[AuthProvider] ✅ Disconnected mismatched wallet
[AuthProvider] Reloading page after wallet mismatch
```

### Successful Blocking on Protected Route
```
[AuthInitializer] Account connected: 0x6Cbe...
[AuthInitializer] 🔍 Checking for existing session...
[AuthInitializer] Session check failed: 401
[AuthInitializer] 📧 Found email for social login: kyle@...
[AuthInitializer] ⚠️ Blocking auto-login on protected route
  reason: Embedded wallet auto-connected but no previous session context
[AuthProvider] ⚠️ Wallet mismatch detected
```

### Normal Login (No Mismatch)
```
[AuthInitializer] Account connected: 0xb3afc...
[AuthInitializer] 🔍 Checking for existing session...
[AuthInitializer] Session invalid or not found, creating new session
[AuthInitializer] No email available (expected for external wallets)
[AuthInitializer] 🚀 Creating new session via login()
[AuthInitializer] ✅ Login completed
```

---

## Automated Test Script

Run this in browser console to check localStorage state:

```javascript
// Check Thirdweb wallet state
const checkWalletState = () => {
  const keys = Object.keys(localStorage).filter(k => k.includes('thirdweb'));
  console.log('=== Thirdweb localStorage keys ===');
  keys.forEach(key => {
    console.log(`${key}:`, localStorage.getItem(key));
  });

  if (keys.length === 0) {
    console.log('No Thirdweb state found (clean state)');
  }
};

// Clear Thirdweb state
const clearWalletState = () => {
  const keys = Object.keys(localStorage).filter(k =>
    k.includes('thirdweb') || k.includes('walletconnect') || k.includes('WALLET_')
  );
  keys.forEach(key => {
    console.log('Removing:', key);
    localStorage.removeItem(key);
  });
  console.log(`Cleared ${keys.length} keys`);
};

// Run checks
checkWalletState();
// To clear: clearWalletState();
```

---

## Troubleshooting

### Mismatch not detected
1. Check if session cookies exist (auth_token, refresh_token)
2. Verify session is valid by calling `/api/auth/session` in console
3. Check if both wallet addresses are different

### Email fallback still triggering
1. Verify the `isProtectedRoute` check is working
2. Check if `userEmail` is being extracted correctly
3. Look for `[AuthInitializer] 📧 Found email` in console

### Page not reloading after mismatch
1. Check for errors in AuthProvider's handleWalletMismatch
2. Verify the event is being dispatched correctly
3. Check if setTimeout is being blocked

---

## Sign-Off

| Test | Passed | Tester | Date |
|------|--------|--------|------|
| Test 1: Valid Session + Wrong Wallet | ⬜ | | |
| Test 2: Expired Session + Embedded Wallet | ⬜ | | |
| Test 3: Intentional Email Fallback | ⬜ | | |
| Test 4: MetaMask Login Without Email | ⬜ | | |
| Test 5: Rate Limiting Prevention | ⬜ | | |
