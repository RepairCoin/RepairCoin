# RepairCoin API Documentation

## Table of Contents
- [Authentication](#authentication)
- [Admin Endpoints](#admin-endpoints)
- [Customer Endpoints](#customer-endpoints)
- [Shop Endpoints](#shop-endpoints)
- [Token Endpoints](#token-endpoints)
- [Webhook Endpoints](#webhook-endpoints)
- [Error Responses](#error-responses)

---

## Authentication

### Generate Admin JWT Token
```http
POST /api/auth/admin
```

**Request Body:**
```json
{
  "address": "0x1234567890abcdef..."
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "1",
    "address": "0x1234567890abcdef...",
    "name": "Admin Name",
    "isSuperAdmin": true,
    "permissions": ["*"]
  }
}
```

### Check User Type
```http
POST /api/auth/check-user
```

**Request Body:**
```json
{
  "address": "0x1234567890abcdef..."
}
```

**Response:**
```json
{
  "type": "admin" | "customer" | "shop",
  "user": {
    "id": "1",
    "address": "0x1234567890abcdef...",
    "role": "admin"
  }
}
```

---

## Admin Endpoints

All admin endpoints require JWT Bearer token authentication.

### Get Admin Profile
```http
GET /api/admin/me
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "walletAddress": "0x1234...",
    "name": "Admin Name",
    "email": "admin@example.com",
    "permissions": ["manage_shops", "manage_customers"],
    "isSuperAdmin": false,
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

### Platform Statistics
```http
GET /api/admin/stats
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalCustomers": 150,
    "totalShops": 25,
    "totalTransactions": 1200,
    "totalTokensIssued": 50000,
    "totalRedemptions": 15000,
    "totalSupply": 1000000000,
    "totalTokensInCirculation": 50000,
    "recentActivity": {
      "newCustomersToday": 5,
      "transactionsToday": 45,
      "tokensIssuedToday": 500
    }
  }
}
```

### Admin Management (Super Admin Only)

#### Get All Admins
```http
GET /api/admin/admins
Authorization: Bearer <token>
```
**Required Permission:** Super Admin

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "walletAddress": "0x1234...",
      "name": "Admin Name",
      "email": "admin@example.com",
      "permissions": ["manage_shops", "manage_customers"],
      "isSuperAdmin": false,
      "isActive": true,
      "lastLogin": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### Create Admin
```http
POST /api/admin/create-admin
Authorization: Bearer <token>
```
**Required Permission:** Super Admin

**Request Body:**
```json
{
  "walletAddress": "0x1234567890abcdef...",
  "name": "New Admin",
  "email": "newadmin@example.com",
  "permissions": ["manage_shops", "view_analytics"]
}
```

**Available Permissions:**
- `manage_customers` - Customer management operations
- `manage_shops` - Shop management operations
- `manage_treasury` - Treasury management
- `view_analytics` - View analytics data
- `manage_admins` - Admin management (usually for super admin)
- `*` - All permissions (super admin)

**Response:**
```json
{
  "success": true,
  "message": "Admin created successfully",
  "data": {
    "id": 2,
    "walletAddress": "0x1234567890abcdef...",
    "name": "New Admin"
  }
}
```

#### Update Admin
```http
PUT /api/admin/admins/:adminId
Authorization: Bearer <token>
```
**Required Permission:** Super Admin

**Request Body:**
```json
{
  "name": "Updated Name",
  "email": "updated@example.com",
  "isActive": true
}
```

#### Update Admin Permissions
```http
PUT /api/admin/admins/:adminId/permissions
Authorization: Bearer <token>
```
**Required Permission:** Super Admin

**Request Body:**
```json
{
  "permissions": ["manage_shops", "manage_customers", "view_analytics"]
}
```

#### Delete Admin
```http
DELETE /api/admin/admins/:adminId
Authorization: Bearer <token>
```
**Required Permission:** Super Admin

---

### Customer Management

#### Get Customers
```http
GET /api/admin/customers
Authorization: Bearer <token>
```
**Required Permission:** `manage_customers`

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 50)
- `tier` (string): Filter by tier (BRONZE, SILVER, GOLD)
- `active` (boolean): Filter by active status

**Response:**
```json
{
  "success": true,
  "data": {
    "customers": [
      {
        "address": "0x1234...",
        "name": "John Doe",
        "tier": "GOLD",
        "lifetimeEarnings": 1500,
        "currentBalance": 250,
        "isActive": true,
        "joinDate": "2024-01-01T00:00:00Z",
        "lastEarnedDate": "2024-03-15T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 150,
      "totalPages": 3
    }
  }
}
```

#### Suspend Customer
```http
POST /api/admin/customers/:address/suspend
Authorization: Bearer <token>
```
**Required Permission:** `manage_customers`

**Request Body:**
```json
{
  "reason": "Violation of terms of service"
}
```

#### Unsuspend Customer
```http
POST /api/admin/customers/:address/unsuspend
Authorization: Bearer <token>
```
**Required Permission:** `manage_customers`

#### Manual Token Mint
```http
POST /api/admin/mint
Authorization: Bearer <token>
```
**Required Permission:** Admin

**Request Body:**
```json
{
  "customerAddress": "0x1234567890abcdef...",
  "amount": 100,
  "reason": "Compensation for service issue"
}
```

---

### Shop Management

#### Get Shops
```http
GET /api/admin/shops
Authorization: Bearer <token>
```
**Required Permission:** `manage_shops`

**Query Parameters:**
- `active` (string): "true", "false", or "all"
- `verified` (string): "true", "false", or "all"

**Response:**
```json
{
  "success": true,
  "data": {
    "shops": [
      {
        "shopId": "SHOP001",
        "name": "Joe's Repair Shop",
        "walletAddress": "0x5678...",
        "active": true,
        "verified": true,
        "purchasedRcnBalance": 5000,
        "totalTokensIssued": 3500,
        "crossShopEnabled": true,
        "joinDate": "2024-01-15T00:00:00Z"
      }
    ]
  }
}
```

#### Create Shop
```http
POST /api/admin/create-shop
Authorization: Bearer <token>
```
**Required Permission:** `manage_shops`

**Request Body:**
```json
{
  "shop_id": "SHOP002",
  "name": "Premium Auto Repair",
  "address": "123 Main St, City",
  "phone": "+1234567890",
  "email": "shop@example.com",
  "wallet_address": "0xabcd...",
  "reimbursement_address": "0xefgh...",
  "verified": true,
  "active": true,
  "cross_shop_enabled": true,
  "fixflow_shop_id": "FF123",
  "location_lat": "40.7128",
  "location_lng": "-74.0060",
  "location_city": "New York",
  "location_state": "NY",
  "location_zip_code": "10001"
}
```

#### Approve Shop
```http
POST /api/admin/shops/:shopId/approve
Authorization: Bearer <token>
```
**Required Permission:** `manage_shops`

#### Verify Shop
```http
POST /api/admin/shops/:shopId/verify
Authorization: Bearer <token>
```
**Required Permission:** `manage_shops`

#### Update Shop
```http
PUT /api/admin/shops/:shopId
Authorization: Bearer <token>
```
**Required Permission:** `manage_shops`

**Request Body:**
```json
{
  "name": "Updated Shop Name",
  "email": "newemail@example.com",
  "crossShopEnabled": true
}
```

#### Suspend Shop
```http
POST /api/admin/shops/:shopId/suspend
Authorization: Bearer <token>
```
**Required Permission:** `manage_shops`

**Request Body:**
```json
{
  "reason": "Non-compliance with platform policies"
}
```

#### Unsuspend Shop
```http
POST /api/admin/shops/:shopId/unsuspend
Authorization: Bearer <token>
```
**Required Permission:** `manage_shops`

#### Mint Shop Balance
```http
POST /api/admin/shops/:shopId/mint-balance
Authorization: Bearer <token>
```
**Required Permission:** `manage_shops`

Mints the shop's purchased RCN balance to the blockchain.

---

### Treasury Management

#### Get Treasury Statistics
```http
GET /api/admin/treasury
Authorization: Bearer <token>
```
**Required Permission:** `manage_treasury`

**Response:**
```json
{
  "success": true,
  "data": {
    "totalSupply": 1000000000,
    "totalSoldToShops": 150000,
    "availableForSale": 999850000,
    "totalRevenue": 15000,
    "averagePricePerToken": 0.10
  }
}
```

#### Update Treasury After Sale
```http
POST /api/admin/treasury/update
Authorization: Bearer <token>
```
**Required Permission:** `manage_treasury`

**Request Body:**
```json
{
  "shopId": "SHOP001",
  "amount": 1000,
  "paymentReference": "TXN123456"
}
```

---

### Analytics

#### Get Activity Logs
```http
GET /api/admin/analytics/activity-logs
Authorization: Bearer <token>
```
**Required Permission:** `view_analytics`

**Query Parameters:**
- `limit` (number): Number of logs to retrieve (default: 10)
- `offset` (number): Offset for pagination

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "adminAddress": "0x1234...",
      "action": "shop_approval",
      "targetId": "SHOP001",
      "details": {
        "shopName": "Joe's Repair Shop"
      },
      "timestamp": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

### System Maintenance

#### Get Failed Webhooks
```http
GET /api/admin/webhooks/failed
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (number): Number of webhooks to retrieve (default: 20)

#### Cleanup Webhook Logs
```http
POST /api/admin/maintenance/cleanup-webhooks
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "daysOld": 30
}
```

#### Archive Transactions
```http
POST /api/admin/maintenance/archive-transactions
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "daysOld": 365
}
```

---

### Contract Management

#### Pause Contract
```http
POST /api/admin/contract/pause
Authorization: Bearer <token>
```
**Required Permission:** Super Admin

#### Unpause Contract
```http
POST /api/admin/contract/unpause
Authorization: Bearer <token>
```
**Required Permission:** Super Admin

---

### Unsuspend Requests

#### Get Unsuspend Requests
```http
GET /api/admin/unsuspend-requests
Authorization: Bearer <token>
```

**Query Parameters:**
- `status` (string): "pending", "approved", "rejected"
- `entityType` (string): "customer" or "shop"

#### Approve Unsuspend Request
```http
POST /api/admin/unsuspend-requests/:requestId/approve
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "notes": "Request reviewed and approved"
}
```

#### Reject Unsuspend Request
```http
POST /api/admin/unsuspend-requests/:requestId/reject
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "notes": "Request denied due to repeated violations"
}
```

---

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "success": false,
  "error": "Invalid request parameters"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": "Permission denied. Required permission: manage_shops"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Resource not found"
}
```

### 409 Conflict
```json
{
  "success": false,
  "error": "This wallet address is already registered as a customer",
  "conflictingRole": "customer"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal server error"
}
```

---

## Rate Limiting

API endpoints are rate-limited to prevent abuse:
- **Authentication endpoints**: 5 requests per minute per IP
- **Read endpoints**: 100 requests per minute per token
- **Write endpoints**: 20 requests per minute per token

---

## Webhook Events

The system emits the following events that can trigger webhooks:

- `admin.created` - New admin created
- `admin.updated` - Admin details updated
- `admin.deleted` - Admin removed
- `customer.suspended` - Customer account suspended
- `customer.unsuspended` - Customer account reactivated
- `shop.approved` - Shop application approved
- `shop.verified` - Shop verification completed
- `shop.suspended` - Shop account suspended
- `shop.unsuspended` - Shop account reactivated
- `token.minted` - Tokens minted to address
- `treasury.updated` - Treasury balance updated

---

## Testing

### Base URLs
- **Development**: `http://localhost:3000/api`
- **Staging**: `https://staging-api.repaircoin.com/api`
- **Production**: `https://api.repaircoin.com/api`

### Test Credentials
For development environment only:
```json
{
  "superAdmin": "0x3d2bd8836dff844987e85beb103c21613c7964a8",
  "testAdmin": "0x4a163e55532d2df732f6a332e00c5db3f1a39b55",
  "testShop": "0x5678...",
  "testCustomer": "0x9abc..."
}
```

---

## SDK Examples

### JavaScript/TypeScript
```typescript
// Initialize client
const repairCoinAPI = new RepairCoinAPI({
  baseURL: 'http://localhost:3000/api',
  adminToken: 'your-jwt-token'
});

// Get admin profile
const profile = await repairCoinAPI.admin.getProfile();

// Create new admin (super admin only)
const newAdmin = await repairCoinAPI.admin.create({
  walletAddress: '0x1234...',
  name: 'New Admin',
  permissions: ['manage_shops']
});

// Get shops with filters
const shops = await repairCoinAPI.shops.list({
  verified: true,
  active: true
});
```

### cURL Examples
```bash
# Authenticate as admin
curl -X POST http://localhost:3000/api/auth/admin \
  -H "Content-Type: application/json" \
  -d '{"address":"0x3d2bd8836dff844987e85beb103c21613c7964a8"}'

# Get admin profile
curl -X GET http://localhost:3000/api/admin/me \
  -H "Authorization: Bearer YOUR_TOKEN"

# Create new admin
curl -X POST http://localhost:3000/api/admin/create-admin \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"walletAddress":"0x123...","name":"Admin","permissions":["manage_shops"]}'
```

---

## Changelog

### Version 2.0.0 (Current)
- Added permission-based access control
- Implemented admin management endpoints
- Added treasury management
- Enhanced analytics endpoints
- Improved error responses

### Version 1.0.0
- Initial API release
- Basic CRUD operations
- Authentication system

---

## Support

For API support and questions:
- Email: api-support@repaircoin.com
- Documentation: https://docs.repaircoin.com
- Status Page: https://status.repaircoin.com