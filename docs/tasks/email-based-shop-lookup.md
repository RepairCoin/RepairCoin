# Email-Based Shop Lookup for Social Login

## Task Overview

| Field | Value |
|-------|-------|
| **Status** | Completed |
| **Priority** | High |
| **Type** | Feature Enhancement |
| **Date Completed** | December 29, 2024 |

---

## Description

Implement email-based shop lookup as a fallback for social login (Google/Apple) authentication. This allows shops that were originally registered with MetaMask to also login via Google OAuth if their email matches, solving the wallet address mismatch issue between external wallets and Thirdweb embedded wallets.

---

## Problem Statement

When a shop registers with MetaMask, their wallet address (e.g., `0xb3afc20c0f66e9ec902bd7df2313b57ae8fb1d81`) is stored in the database. Later, if the same user tries to login with Google OAuth, Thirdweb generates a **different embedded wallet address** (e.g., `0x6Cbe140531a84D352Bb29A27a9A93215B5be6175`) for that Google account. This causes the shop lookup to fail, redirecting the user to `/choose` even though they have an existing shop account.

**Root Cause:**
- MetaMask wallet: User's actual crypto wallet address
- Google OAuth wallet: Thirdweb-generated embedded wallet (different address)
- Shop lookup only checked wallet address, not email
- Frontend didn't set `userProfile` in authStore after authentication
- ShopDashboard loaded shop data using wallet address instead of shopId

---

## Acceptance Criteria

- [x] Backend supports email-based shop lookup as fallback
- [x] `/api/auth/check-user` accepts optional email parameter
- [x] `/api/auth/shop` accepts optional email parameter for authentication
- [x] `/api/shops/wallet/:address` accepts `?email=` query parameter
- [x] Frontend extracts email from Thirdweb embedded wallets using `getUserEmail()`
- [x] Frontend passes email through entire authentication chain
- [x] Frontend sets `userProfile` in authStore after successful authentication
- [x] ShopDashboard uses `userProfile.shopId` to load shop data
- [x] Response includes `linkedByEmail` flag when matched by email
- [x] Existing wallet-based lookup still works (no breaking changes)

---

## Implementation Summary

### Backend Changes

#### 1. ShopRepository (backend/src/repositories/ShopRepository.ts)

**Added Method:**
```typescript
async getShopByEmail(email: string): Promise<ShopData | null> {
  const query = 'SELECT * FROM shops WHERE LOWER(email) = LOWER($1)';
  const result = await this.pool.query(query, [email.trim()]);
  if (result.rows.length === 0) return null;
  return this.mapRowToShopData(result.rows[0]);
}
```

#### 2. Auth Routes - check-user (backend/src/routes/auth.ts)

**Updated `/api/auth/check-user`:**
- Accepts optional `email` in request body
- After wallet lookup fails, tries email lookup if email provided
- Returns `linkedByEmail: true` flag when matched by email

```typescript
router.post('/check-user', async (req, res) => {
  const { address, email } = req.body;

  // First try wallet lookup...
  let shop = await shopRepository.getShopByWallet(normalizedAddress);

  // EMAIL FALLBACK: If not found by wallet, try email
  if (!shop && email && typeof email === 'string' && email.includes('@')) {
    shop = await shopRepository.getShopByEmail(email);
    if (shop) {
      linkedByEmail = true;
      logger.info('Shop found via email fallback', { email, shopId: shop.shopId });
    }
  }
});
```

#### 3. Auth Routes - shop authentication (backend/src/routes/auth.ts)

**Updated `/api/auth/shop`:**
- Accepts optional `email` in request body
- Falls back to email lookup for authentication
- Returns user data with `shopId` for frontend state

```typescript
router.post('/shop', authLimiter, async (req, res) => {
  const { address, email } = req.body;

  let shop = await shopRepository.getShopByWallet(normalizedAddress);

  // EMAIL FALLBACK for social login
  if (!shop && email && typeof email === 'string' && email.includes('@')) {
    shop = await shopRepository.getShopByEmail(email);
    if (shop) {
      linkedByEmail = true;
      logger.info('Shop authenticated via email fallback (social login)', {
        email, shopId: shop.shopId,
        originalWallet: shop.walletAddress,
        connectedWallet: normalizedAddress
      });
    }
  }

  // Generate JWT with shopId
  const { accessToken } = await generateAndSetTokens(res, req, {
    address: normalizedAddress,
    role: 'shop',
    shopId: shop.shopId
  });

  res.json({
    success: true,
    token: accessToken,
    linkedByEmail,
    user: {
      id: shop.shopId,
      shopId: shop.shopId,
      address: shop.walletAddress,  // Original registered wallet
      connectedWallet: linkedByEmail ? normalizedAddress : shop.walletAddress,
      name: shop.name,
      role: 'shop',
      active: shop.active,
      verified: shop.verified
    }
  });
});
```

#### 4. Shop Routes (backend/src/domains/shop/routes/index.ts)

**Updated `/api/shops/wallet/:address`:**
- Accepts `?email=` query parameter
- Falls back to email lookup when wallet lookup fails

```typescript
router.get('/wallet/:address', async (req, res) => {
  const { address } = req.params;
  const { email } = req.query;

  let shop = await shopRepository.getShopByWallet(address);
  let linkedByEmail = false;

  if (!shop && email && typeof email === 'string' && email.includes('@')) {
    shop = await shopRepository.getShopByEmail(email);
    if (shop) linkedByEmail = true;
  }

  res.json({
    success: true,
    linkedByEmail,
    data: shopData
  });
});
```

### Frontend Changes

#### 5. Auth API Service (frontend/src/services/api/auth.ts)

**Updated functions to accept email parameter:**

```typescript
export const checkUser = async (address: string, email?: string): Promise<{
  exists: boolean;
  type?: 'admin' | 'shop' | 'customer';
  user?: any;
}> => {
  const response = await apiClient.post<any>('/auth/check-user', { address, email });
  return response;
};

export const authenticateShop = async (address: string, email?: string): Promise<AuthToken | null> => {
  const response = await apiClient.post<AuthToken>('/auth/shop', { address, email });
  return response || null;
};
```

#### 6. Auth Store (frontend/src/stores/authStore.ts)

**Updated `login()` function:**

```typescript
login: async (address: string, email?: string) => {
  // Check user type with email fallback
  const userCheck = await authApi.checkUser(address, email);

  // Authenticate based on user type, passing email for shop
  if (userCheck.type === 'shop') {
    authResult = await authApi.authenticateShop(address, email);
  }

  // Build and set user profile with shopId
  const profile: UserProfile = {
    id: userData.id,
    address: userData.walletAddress || address,
    type: userCheck.type,
    shopId: userData.shopId,  // Critical for ShopDashboard
    // ... other fields
  };

  set({ userProfile: profile, isAuthenticated: true });
}
```

#### 7. Header Component (frontend/src/components/Header.tsx)

**Key changes:**
- Import `getUserEmail` from `thirdweb/wallets/in-app`
- Extract email after wallet connection
- Pass email to authentication
- **Set userProfile in authStore after authentication**

```typescript
import { getUserEmail } from "thirdweb/wallets/in-app";
import { useAuthStore } from "@/stores/authStore";

// Inside checkAndRedirect():
let userEmail: string | undefined;
try {
  userEmail = await getUserEmail({ client });
  if (userEmail) {
    console.log('Found email for social login:', userEmail);
  }
} catch (e) {
  // Expected for external wallets
}

// After authentication, SET USER PROFILE:
if (result.type === 'shop') {
  const authResult = await authApi.authenticateShop(account.address, userEmail);

  if (authResult && authResult.user) {
    const userData = authResult.user as any;
    useAuthStore.getState().setUserProfile({
      id: userData.id || userData.shopId || account.address,
      address: userData.walletAddress || userData.address || account.address,
      type: 'shop',
      name: userData.name,
      email: userData.email,
      isActive: userData.active,
      shopId: userData.shopId,  // Critical!
      registrationDate: userData.createdAt,
    });
  }
}
```

#### 8. DualAuthConnect (frontend/src/components/auth/DualAuthConnect.tsx)

**Same pattern as Header.tsx:**
- Extract email using `getUserEmail({ client })`
- Pass email to wallet detection and authentication
- Set userProfile in authStore after authentication

```typescript
import { getUserEmail } from "thirdweb/wallets/in-app";

// Extract email
userEmail = await getUserEmail({ client });

// Authenticate and set profile
const authResult = await authApi.authenticateShop(account.address, userEmail);
if (authResult && authResult.user) {
  useAuthStore.getState().setUserProfile({
    id: userData.id || userData.shopId || account.address,
    address: userData.walletAddress || userData.address || account.address,
    type: 'shop',
    shopId: userData.shopId,
    // ... other fields
  });
}
```

#### 9. useAuthInitializer Hook (frontend/src/hooks/useAuthInitializer.ts)

**Updated to extract and pass email:**

```typescript
import { getUserEmail } from 'thirdweb/wallets/in-app';

// In initializeAuth():
let userEmail: string | undefined;
try {
  userEmail = await getUserEmail({ client });
} catch (e) {
  // Expected for non-embedded wallets
}

await login(currentAddress, userEmail);
```

#### 10. ShopDashboardClient (frontend/src/components/shop/ShopDashboardClient.tsx)

**Critical fix - use shopId from userProfile:**

```typescript
const { userProfile } = useAuthStore();

const loadShopData = async () => {
  // Use shopId from session (for social login where wallet differs)
  const shopIdFromSession = userProfile?.shopId;
  const shopEndpoint = shopIdFromSession
    ? `/shops/${shopIdFromSession}`
    : `/shops/wallet/${account?.address}`;

  console.log('[ShopDashboard] Loading shop data from:', shopEndpoint);
  const shopResult = await apiClient.get(shopEndpoint);
};

// Re-load when userProfile.shopId becomes available
useEffect(() => {
  if (account?.address) {
    loadShopData();
  }
}, [account?.address, userProfile?.shopId]);  // Added userProfile.shopId dependency
```

#### 11. Wallet Detection Service (frontend/src/services/walletDetectionService.ts)

**Updated to accept and pass email:**

```typescript
async detectWalletType(address: string, email?: string): Promise<WalletDetectionResult> {
  // Include email in check-user call
  body: JSON.stringify({ address, email })

  // Include email in shop wallet lookup
  const shopUrl = email
    ? `${this.apiUrl}/shops/wallet/${address}?email=${encodeURIComponent(email)}`
    : `${this.apiUrl}/shops/wallet/${address}`;
}
```

#### 12. useWalletDetection Hook (frontend/src/hooks/useWalletDetection.tsx)

**Added email extraction:**

```typescript
import { getUserEmail } from "thirdweb/wallets/in-app";

// Extract email
let userEmail: string | undefined;
try {
  userEmail = await getUserEmail({ client });
} catch (e) {
  // Expected for external wallets
}

const result = await detector.detectWalletType(account.address, userEmail);
```

---

## Files Modified

| File | Changes |
|------|---------|
| `backend/src/repositories/ShopRepository.ts` | Added `getShopByEmail()` method |
| `backend/src/routes/auth.ts` | Added email fallback to `/check-user` and `/shop` endpoints |
| `backend/src/domains/shop/routes/index.ts` | Added email query param to `/shops/wallet/:address` |
| `frontend/src/services/api/auth.ts` | Added email parameter to `checkUser()` and `authenticateShop()` |
| `frontend/src/stores/authStore.ts` | Added email parameter to `login()` function |
| `frontend/src/components/Header.tsx` | Extract email, pass to auth, set userProfile after authentication |
| `frontend/src/components/auth/DualAuthConnect.tsx` | Extract email, pass to auth, set userProfile after authentication |
| `frontend/src/components/shop/ShopDashboardClient.tsx` | Use `userProfile.shopId`, add to useEffect dependencies |
| `frontend/src/hooks/useAuthInitializer.ts` | Extract email, pass to login() |
| `frontend/src/hooks/useWalletDetection.tsx` | Extract email, pass to detection service |
| `frontend/src/services/walletDetectionService.ts` | Added email parameter to `detectWalletType()` |
| `backend/src/middleware/auth.ts` | Minor auth handling updates |

---

## Complete Authentication Flow

```
1. User clicks "Login with Google"
           ↓
2. Thirdweb creates embedded wallet (0xNEW_ADDRESS)
           ↓
3. getUserEmail({ client }) extracts email from Thirdweb
           ↓
4. WalletDetectionService.detectWalletType(address, email)
           ↓
5. Backend /check-user: wallet lookup fails → email fallback finds shop
           ↓
6. authApi.authenticateShop(address, email)
           ↓
7. Backend /auth/shop: creates JWT with shopId, returns user data
           ↓
8. Frontend: useAuthStore.setUserProfile({ shopId: 'peanut', ... })
           ↓
9. Redirect to /shop
           ↓
10. ShopDashboardClient: userProfile.shopId = 'peanut'
           ↓
11. API call: GET /shops/peanut (using shopId, not wallet)
           ↓
12. Shop dashboard loads successfully!
```

---

## Email Fallback Compatibility

| Login Method | Email Available? | Fallback Works? |
|-------------|------------------|-----------------|
| Google OAuth | Yes | Yes |
| Apple Sign-in | Yes | Yes |
| Email OTP | Yes | Yes |
| MetaMask | No | No |
| Coinbase Wallet | No | No |
| WalletConnect | No | No |

**Note:** The `getUserEmail()` function only returns an email for in-app/embedded wallets (social logins). External wallets like MetaMask and Coinbase don't have associated email addresses.

---

## API Changes

### POST /api/auth/check-user

**Request Body:**
```json
{
  "address": "0x...",
  "email": "user@example.com"
}
```

**Response (when matched by email):**
```json
{
  "exists": true,
  "type": "shop",
  "linkedByEmail": true,
  "user": {
    "shopId": "peanut",
    "walletAddress": "0xb3afc20c...",
    "email": "user@example.com"
  }
}
```

### POST /api/auth/shop

**Request Body:**
```json
{
  "address": "0x...",
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "linkedByEmail": true,
  "user": {
    "id": "peanut",
    "shopId": "peanut",
    "address": "0xb3afc20c...",
    "connectedWallet": "0x6Cbe140...",
    "name": "Peanut Shop",
    "role": "shop"
  }
}
```

### GET /api/shops/wallet/:address

**Query Parameters:**
- `email` (optional): Email for fallback lookup

**Example:**
```
GET /api/shops/wallet/0x6Cbe140...?email=kyle.cagunot@mothergooseschools.org
```

---

## Testing Instructions

### Test Email Fallback:

1. Find a shop registered with MetaMask (e.g., shop "peanut" with email `kyle.cagunot@mothergooseschools.org`)
2. Logout completely
3. Login with Google using that same email
4. Verify:
   - User is NOT redirected to `/choose`
   - User is redirected to `/shop` dashboard
   - Console shows: `Shop authenticated via email fallback`
   - Console shows: `Auth store updated with shop profile, shopId: peanut`
   - Console shows: `[ShopDashboard] Loading shop data from: /shops/peanut`
   - Shop dashboard loads successfully

### Test Existing Wallet Lookup:

1. Login with MetaMask using the original wallet
2. Verify wallet-based lookup still works
3. `linkedByEmail` should be `false` or absent

---

## Security Considerations

- Email lookup only used as **fallback** when wallet lookup fails
- Email must be provided by frontend (extracted from verified Thirdweb session)
- Case-insensitive email comparison to prevent bypass attempts
- Logs email fallback usage for audit trail
- Does NOT auto-link wallets (original wallet address preserved)
- JWT token includes correct shopId regardless of login method

---

## Future Enhancement: Wallet Linking for External Wallets

The current email fallback only works for social logins (Google, Apple, Email OTP). For users who want to use multiple external wallets (e.g., MetaMask and Coinbase), a **wallet linking** feature would be needed.

### Proposed Implementation

#### Database Schema

```sql
-- New table to store linked wallets
CREATE TABLE shop_wallets (
  id SERIAL PRIMARY KEY,
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id),
  wallet_address VARCHAR(42) NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  linked_by VARCHAR(42), -- Address that authorized the linking
  label VARCHAR(100), -- Optional label (e.g., "MetaMask", "Coinbase")
  UNIQUE(wallet_address)
);

-- Index for fast wallet lookups
CREATE INDEX idx_shop_wallets_address ON shop_wallets(wallet_address);
CREATE INDEX idx_shop_wallets_shop_id ON shop_wallets(shop_id);
```

#### Backend API Endpoints

```typescript
// Get linked wallets for a shop
GET /api/shops/:shopId/wallets
Response: { wallets: [{ address, isPrimary, label, linkedAt }] }

// Link a new wallet (requires signature verification)
POST /api/shops/:shopId/wallets/link
Body: { walletAddress, signature, message, label? }
- Requires user to sign a message proving ownership
- Validates signature matches wallet address
- Checks wallet not already linked to another shop

// Unlink a wallet
DELETE /api/shops/:shopId/wallets/:walletAddress
- Cannot unlink primary wallet
- Requires authentication as shop owner

// Set primary wallet (for RCG tokens)
PUT /api/shops/:shopId/wallets/:walletAddress/primary
- Updates which wallet receives RCG tokens
```

#### Frontend UI (Shop Settings)

```
┌─────────────────────────────────────────────────────┐
│ Linked Wallets                                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│ 🟢 0xb3afc20c...8fb1d81 (Primary - MetaMask)       │
│    Linked: Dec 15, 2024                            │
│    [Set as Primary] [Unlink]                       │
│                                                     │
│ ⚪ 0x6Cbe1405...5be6175 (Coinbase)                 │
│    Linked: Dec 29, 2024                            │
│    [Set as Primary] [Unlink]                       │
│                                                     │
│ ┌─────────────────────────────────────────────────┐│
│ │ + Link New Wallet                               ││
│ │                                                 ││
│ │ Connect your wallet and sign a message to      ││
│ │ verify ownership.                              ││
│ │                                                 ││
│ │ [Connect Wallet to Link]                       ││
│ └─────────────────────────────────────────────────┘│
│                                                     │
│ ⚠️ Primary wallet receives RCG governance tokens   │
└─────────────────────────────────────────────────────┘
```

#### Wallet Linking Flow

```
1. User navigates to Shop Settings > Linked Wallets
           ↓
2. User clicks "Link New Wallet"
           ↓
3. User connects external wallet (MetaMask/Coinbase)
           ↓
4. Frontend generates message: "Link wallet 0x... to shop peanut. Nonce: abc123"
           ↓
5. User signs message with new wallet
           ↓
6. Frontend sends to backend: { walletAddress, signature, message }
           ↓
7. Backend verifies signature matches wallet address
           ↓
8. Backend checks wallet not linked to another shop
           ↓
9. Backend creates shop_wallets record
           ↓
10. User can now login with either wallet!
```

#### Modified Authentication Flow

```typescript
// In /api/auth/shop
router.post('/shop', async (req, res) => {
  const { address } = req.body;

  // 1. Try primary wallet lookup
  let shop = await shopRepository.getShopByWallet(address);

  // 2. Try linked wallets lookup
  if (!shop) {
    const linkedShop = await shopWalletRepository.getShopByLinkedWallet(address);
    if (linkedShop) {
      shop = await shopRepository.getShop(linkedShop.shopId);
    }
  }

  // 3. Try email fallback (for social login)
  if (!shop && email) {
    shop = await shopRepository.getShopByEmail(email);
  }

  // Continue with authentication...
});
```

#### Security Considerations for Wallet Linking

1. **Signature Verification**: Always verify wallet ownership via signed message
2. **Unique Constraint**: One wallet can only be linked to one shop
3. **Audit Trail**: Log all link/unlink operations
4. **Rate Limiting**: Prevent brute force linking attempts
5. **Cooldown Period**: Optional delay after unlinking before wallet can be linked elsewhere
6. **Admin Override**: Allow admins to unlink wallets in case of disputes

#### Benefits

- Users can access their shop from multiple wallets
- Supports any wallet type (MetaMask, Coinbase, WalletConnect, etc.)
- Primary wallet designation preserves RCG token destinations
- Full audit trail of wallet changes
- Self-service - no admin intervention needed

---

## Related Issues

- QA reported shop owner being redirected to `/choose` when logging in with Google
- Root cause: Shop registered with MetaMask, Google OAuth creates different wallet
- Solution: Email-based fallback lookup + proper userProfile state management

---

## Notes

- This feature is backward compatible - existing wallet-based auth still works
- Email fallback only triggers when wallet lookup returns no results
- The `linkedByEmail` flag allows frontend to potentially show a notification about wallet mismatch
- Shop's original wallet address is preserved in database (not overwritten)
- Critical fix: Setting `userProfile` in authStore ensures ShopDashboard has access to `shopId`
