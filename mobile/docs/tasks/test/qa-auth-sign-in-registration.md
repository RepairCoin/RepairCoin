# QA Test Guide: Mobile Authentication — Sign In & Registration

## Date: 2026-04-13
## Feature: Sign In, Registration, Wallet Connection, Session Management
## Platform: Mobile (React Native / Expo)
## Category: Comprehensive QA Guide

---

## Auth Flow Overview

```
App Launch → Splash Screen → Check stored session
  → If authenticated: route to dashboard
  → If not: route to Onboarding

Onboarding → Wallet Connection (Google / MetaMask / WalletConnect)
  → Backend: /auth/check-user
    → User exists + active: fetch JWT → route to dashboard
    → User exists + pending shop: route to /register/pending
    → User doesn't exist: route to Role Selection
      → "I'm a Customer" → Customer Registration (1 screen)
      → "I'm a Shop Owner" → Shop Registration (5 slides)
```

---

## Section 1: Wallet Connection (Onboarding Screen 3)

### Test 1.1: Google social login
1. Fresh install / logged out state
2. Tap through onboarding to screen 3
3. Tap "Connect" button
4. Select **Google** from wallet options
5. Complete Google OAuth flow
6. **Expected**: Wallet connects, loading spinner shows, then navigates to:
   - Dashboard (if existing user)
   - Role Selection (if new user)
7. **Verify**: No error toasts or blank screens

### Test 1.2: MetaMask wallet connection
1. Ensure MetaMask app is installed on device
2. Tap "Connect" → select **MetaMask**
3. MetaMask app should open for approval
4. Approve connection in MetaMask
5. **Expected**: Returns to RepairCoin app, wallet connected
6. **Verify**: Correct wallet address is shown in registration form

### Test 1.3: WalletConnect
> **NOT TESTABLE** — WalletConnect option is missing from the Connect Wallet modal.
> The handler exists in `OnboardingScreen3.tsx` but was never added to `WalletSelectionModal.tsx`.
> See: `mobile/docs/tasks/bugs/13-04-2026/bug-missing-wallet-options-in-connect-modal.md`

1. Tap "Connect" → select **WalletConnect**
2. Scan QR code or select wallet app
3. Approve connection
4. **Expected**: Wallet connected, navigation proceeds

### Test 1.4: Cancel during wallet connection
1. Tap "Connect" → select any wallet option
2. **Cancel** the connection (close MetaMask, dismiss Google popup)
3. **Expected**: Returns to onboarding screen cleanly, no error
4. **Expected**: "Connect" button is re-enabled and functional
5. **Verify**: No loading spinner stuck on screen

### Test 1.5: Connection cancelled / timeout (MetaMask)
1. Tap "Connect" → select MetaMask
2. MetaMask app opens with approval screen
3. Tap **"Cancel"** in MetaMask (do not approve)
4. Return to RepairCoin app
5. **Expected**: RepairCoin shows the wallet selection modal or Connect button — not stuck in loading
6. **Expected**: User can tap Connect again and retry
7. **Verify**: No loading spinner stuck on screen

**Alternative (timeout test):**
1. Tap "Connect" → select MetaMask
2. MetaMask opens → use phone's app switcher/home button to go back to RepairCoin without tapping Connect or Cancel in MetaMask
3. **Expected**: App should timeout or allow user to cancel
4. **Known Issue**: Currently no timeout — if MetaMask is left open without a response, RepairCoin may stay in a loading state indefinitely

### Test 1.6: No internet during connection
1. Turn off WiFi/mobile data

**Google:** 
2. Tap "Connect" → select Google
3. **Result: PASS** — Thirdweb's embedded wallet browser shows clear error: "Looks like you're not connected to a network. Check your settings and try again."

**MetaMask:**
2. Tap "Connect" → select MetaMask
3. **Result: FAIL** — MetaMask opens but keeps loading indefinitely with no error message or timeout
4. User has no feedback that there's no connection
5. Must manually switch back to RepairCoin via app switcher

---

## Section 2: Role Selection

### Test 2.1: Choose Customer role
1. Connect wallet as a new user (not in database)
2. Arrive at Role Selection screen
3. Tap "I'm a Customer"
4. **Expected**: Navigate to Customer Registration form
5. **Verify**: Wallet address is pre-filled and read-only

### Test 2.2: Choose Shop Owner role
1. Connect wallet as a new user
2. Tap "I'm a Shop Owner"
3. **Expected**: Navigate to Shop Registration (slide 1 of 5)
4. **Verify**: Wallet address is pre-filled and read-only

### Test 2.3: Logout from role selection
1. On Role Selection screen, tap "Logout"
2. **Expected**: Clears auth state, returns to Onboarding screen 1
3. **Verify**: Wallet is disconnected (no stale connection)

### Test 2.4: Back navigation from role selection
1. On Role Selection screen, tap device back button
2. **Expected**: Should either go back to onboarding or stay (not crash)
3. **Verify**: No blank screen or navigation error

---

## Section 3: Customer Registration

### Test 3.1: Successful registration
1. Arrive at Customer Registration form
2. Fill in:
   - Full Name: "Test Customer"
   - Email: "test@example.com"
3. Leave Referral Code empty
4. Tap "Register"
5. **Expected**: Loading state, then Success screen
6. **Expected**: Auto-fetches JWT token
7. **Expected**: Navigate to Customer Dashboard (home tab)
8. **Verify**: Customer profile visible in dashboard

### Test 3.2: Registration with referral code
1. Fill in valid registration details
2. Enter a referral code (e.g., existing customer's code)
3. Tap "Register"
4. **Expected**: Registration succeeds
5. **Known Issue**: Referral code is NOT validated before submission — invalid codes are silently accepted

### Test 3.3: Validation — empty fields
1. Leave Full Name empty → tap Register
2. **Expected**: Validation error "Full name is required" or similar
3. Leave Email empty → tap Register
4. **Expected**: Validation error for email
5. **Verify**: Error messages are visible and clear

### Test 3.4: Validation — invalid email
1. Enter email: "notanemail"
2. Tap Register
3. **Expected**: Validation error "Invalid email format"
4. Try: "test@", "@example.com", "test @example.com"
5. **Expected**: All rejected with clear error

### Test 3.5: Validation — short name
1. Enter Full Name: "A" (1 character)
2. **Expected**: Validation error (minimum 2 characters)

### Test 3.6: Duplicate registration
1. Register a customer successfully
2. Disconnect wallet, reconnect with same wallet
3. **Expected**: Should detect existing user and route to dashboard (not registration)
4. **Verify**: No duplicate account created

### Test 3.7: Registration with no internet
1. Fill in valid registration details
2. Turn off internet
3. Tap Register
4. **Expected**: Error message about network failure
5. **Verify**: Form data is NOT lost (user can retry without re-entering)

---

## Section 4: Shop Registration (5-Slide Form)

### Test 4.1: Complete registration flow
1. Fill Slide 1 (Personal Info):
   - First Name, Last Name, Email, Phone
2. Fill Slide 2 (Business Info):
   - Business Name, Company Size, Monthly Revenue
3. Fill Slide 3 (Location & Wallet):
   - Address, City, Country
   - Wallet address (read-only)
4. Fill Slide 4 (Social Media) — optional:
   - Facebook, Instagram, Twitter URLs
5. Slide 5 (Review & Submit):
   - Accept terms & conditions
   - Tap "Submit"
6. **Expected**: Navigate to Pending Approval screen
7. **Verify**: Shop status is "pending" (NOT active)

### Test 4.2: Slide validation — Personal Info
1. Try advancing from Slide 1 with empty fields
2. **Expected**: Validation errors for required fields
3. Enter invalid email → **Expected**: Rejected
4. Enter phone with less than 7 digits → **Expected**: Rejected

### Test 4.3: Slide validation — Business Info
1. Try advancing from Slide 2 with empty business name
2. **Expected**: Validation error
3. **Verify**: Company Size and Monthly Revenue dropdowns work

### Test 4.4: Slide validation — Location
1. Try advancing from Slide 3 with empty address
2. **Expected**: Validation error
3. Test optional reimbursement address:
   - Leave empty → **Expected**: Allowed
   - Enter invalid ETH address → **Expected**: Validation error
   - Enter valid ETH address → **Expected**: Accepted

### Test 4.5: Social Media URLs (optional)
1. Leave all social media fields empty → advance
2. **Expected**: Allowed (all optional)
3. Enter invalid URL (e.g., "not-a-url") in Facebook field
4. **Expected**: Validation error if URL is provided but invalid

### Test 4.6: Terms & conditions
1. On Slide 5, try submitting WITHOUT accepting terms
2. **Expected**: Submit button disabled or validation error
3. Accept terms → submit
4. **Expected**: Registration proceeds

### Test 4.7: Back navigation between slides
1. Advance to Slide 3
2. Tap back to return to Slide 2
3. **Verify**: Form data on Slide 2 is preserved (not cleared)
4. Navigate forward again
5. **Verify**: Slide 3 data also preserved

### Test 4.8: No progress indicator
1. During multi-slide registration, observe the UI
2. **Known Issue**: No visual indicator showing which slide you're on (e.g., "Step 3 of 5")
3. **Impact**: Users don't know how many steps remain

---

## Section 5: Sign In — Existing Users

### Test 5.1: Returning customer login
1. Register a customer (or use existing)
2. Force close app, reopen
3. **Expected**: Auto-login from stored session, route to customer dashboard
4. **Verify**: No login screen shown

### Test 5.2: Returning shop login
1. Use an approved shop account
2. Force close app, reopen
3. **Expected**: Auto-login, route to shop dashboard

### Test 5.3: Pending shop login
1. Use a shop account that is pending approval
2. Connect wallet
3. **Expected**: Route to Pending Approval screen (NOT dashboard)
4. **Verify**: No JWT token issued for pending shops

### Test 5.4: Google login to MetaMask-registered shop (email fallback)
1. Shop registered with MetaMask wallet + email "shop@example.com"
2. Login via Google using the same email "shop@example.com"
3. **Expected**: Backend matches by email, login succeeds
4. **Expected**: Shop dashboard accessible
5. **Security Concern**: If Google account is compromised, attacker can access shop

### Test 5.5: Login with wallet not in system
1. Connect a wallet address that has never been registered
2. **Expected**: Route to Role Selection (not error screen)
3. **Verify**: Clean UX flow to registration

### Test 5.6: Login after being suspended
1. Use a shop account that admin has suspended
2. Connect wallet
3. **Expected**: Clear message that account is suspended
4. **Verify**: Cannot access shop dashboard features

---

## Section 6: Token & Session Management

### Test 6.1: Token refresh (15-minute expiry)
1. Login successfully
2. Leave app open for 15+ minutes without interaction
3. Perform an action (load dashboard, fetch data)
4. **Expected**: Token refreshes silently in background, action succeeds
5. **Verify**: No logout or error shown to user

### Test 6.2: Session persistence across app restarts
1. Login, then force close the app
2. Reopen app
3. **Expected**: User is still logged in (tokens stored in SecureStore)
4. **Verify**: Dashboard loads without re-authentication

### Test 6.3: Session after 7 days (refresh token expiry)
1. Login, then don't use app for 7+ days
2. Reopen app
3. **Expected**: Refresh token expired, user must re-authenticate
4. **Expected**: Redirect to onboarding/wallet connection (not crash)

### Test 6.4: Concurrent API calls with expired token
1. Login, wait for token to expire (or simulate)
2. Trigger multiple API calls simultaneously (e.g., open dashboard)
3. **Expected**: Only ONE refresh request is made (queue mechanism)
4. **Verify**: All requests succeed after refresh (no 401 errors)

### Test 6.5: Offline then online
1. Login successfully
2. Turn off internet
3. Navigate around the app (cached screens should work)
4. Turn internet back on
5. Perform an API action
6. **Expected**: Reconnects and works normally
7. **Known Issue**: If token expired while offline, refresh may fail and log user out

---

## Section 7: Logout

### Test 7.1: Normal logout
1. Go to Settings or Profile
2. Tap "Logout"
3. **Expected**: Wallet disconnected, tokens cleared, route to Onboarding
4. **Verify**: Cannot navigate back to dashboard with device back button
5. **Verify**: No stale data visible

### Test 7.2: Login as different user after logout
1. Logout from Customer account
2. Connect a different wallet (or Google account)
3. **Expected**: Clean login flow for new user
4. **Verify**: No data from previous user visible (notifications, balance, etc.)

### Test 7.3: Logout then reopen app
1. Logout
2. Force close app
3. Reopen app
4. **Expected**: Onboarding screen shown (not dashboard)
5. **Verify**: SecureStore fully cleared (no auto-login)

---

## Section 8: Edge Cases & Security

### Test 8.1: Rapid connect/disconnect
1. Tap "Connect" → cancel immediately
2. Tap "Connect" again immediately
3. Repeat 5 times rapidly
4. **Expected**: No crash, no stuck loading state
5. **Verify**: Final connection attempt works normally

### Test 8.2: Switch accounts without logout
1. Login as Customer A
2. Without logging out, switch wallet in MetaMask to a different address
3. Reopen app
4. **Expected**: App should detect wallet mismatch and handle gracefully
5. **Verify**: No data leakage between accounts

### Test 8.3: Registration with special characters
1. Register customer with name: "O'Brien-Smith Jr."
2. **Expected**: Name accepted and saved correctly
3. Register with email containing "+": "test+tag@example.com"
4. **Expected**: Email accepted

### Test 8.4: Very long form inputs
1. Enter a 500-character business name in shop registration
2. **Expected**: Either truncated or validation error (not crash)
3. Enter a very long address
4. **Expected**: Handled gracefully

### Test 8.5: App killed during registration
1. Start customer registration, fill in name and email
2. Kill the app (swipe away from recent apps)
3. Reopen app
4. **Expected**: Returns to appropriate screen (not stuck mid-registration)
5. **Known Issue**: Form data is lost — user must start over

### Test 8.6: Double-tap submit
1. On customer registration, fill valid data
2. Double-tap "Register" button quickly
3. **Expected**: Only ONE registration request sent (button disabled after first tap)
4. **Verify**: No duplicate account created

---

## Section 9: Error Handling & UX

### Test 9.1: Backend server down
1. Disconnect backend (or point to wrong URL)
2. Try to connect wallet and login
3. **Expected**: User-friendly error message (not technical error)
4. **Known Issue**: Auth errors are mostly logged to console with no user-facing feedback

### Test 9.2: Slow network (3G simulation)
1. Throttle network to 3G speeds
2. Go through entire auth flow (connect → register → login)
3. **Expected**: Loading indicators shown during each step
4. **Verify**: No timeout errors on slow but working connections

### Test 9.3: Rate limiting
1. Rapidly attempt 50+ login requests (via automated testing or manual rapid taps)
2. **Expected**: After hitting rate limit, clear message "Too many attempts, try again later"
3. **Backend**: Rate limit is 50 requests per 15 minutes in production

---

## Known Bugs & Issues Summary

| # | Issue | Severity | File |
|---|-------|----------|------|
| 1 | No timeout on wallet connection — user left waiting indefinitely | High | OnboardingScreen3.tsx |
| 2 | Auth errors fail silently — no toast/alert shown to user | High | useAuth.ts |
| 3 | Token expiry race condition — `errorCode !== 'TOKEN_EXPIRED'` logic may prevent proper logout | High | axios.ts:224 |
| 4 | No email verification for customers — fake/typo emails accepted permanently | High | customer registration flow |
| 5 | Referral codes not validated before submission — invalid codes silently accepted | Medium | useCustomerRegister.ts |
| 6 | Email fallback account linking — Google login can access MetaMask-registered shop without confirmation | Medium | backend auth.ts:243 |
| 7 | Shop registration has no progress indicator (step X of 5) | Medium | ShopRegisterScreen.tsx |
| 8 | Multiple SecureStore key names — potential stale data on logout | Medium | auth.store.ts:154 |
| 9 | No offline recovery — token refresh fails while offline, user logged out | Medium | axios.ts:114 |
| 10 | Form data lost if app killed during registration | Low | Registration screens |
| 11 | No loading indicator on splash/init screen | Low | app/index.tsx |
| 12 | ErrorBoundary shows technical error messages to users | Low | ErrorBoundaryProvider.tsx |
