# Treasury API 500 Error Fixes

## Issues Found and Fixed

### 1. **Column Name Mismatches in TreasuryRepository**

**Problem**: The `updateTreasuryAfterSale` method was trying to insert/update columns that don't exist in the `admin_treasury` table.

**Incorrect columns used**:
- `total_sold_to_shops` → should be `total_sold`
- `available_balance` → should be `available_supply`  
- `updated_by` → this column doesn't exist in the table

**Fix Applied**: Updated the SQL queries in `TreasuryRepository.ts` lines 229-242 to use the correct column names.

### 2. **Type Conversion Error in getTreasuryData**

**Problem**: The method was trying to `parseFloat` on string values 'unlimited'.

**Fix Applied**: Added conditional checks to return `Infinity` for 'unlimited' values instead of trying to parse them as floats (lines 174-176).

### 3. **Missing Week RCN Calculation in Treasury Update**

**Problem**: The `/treasury/update` endpoint was inserting 0 for `total_rcn_sold` without calculating the actual weekly sales.

**Fix Applied**: Added a query to calculate weekly RCN sales before inserting into `revenue_distributions` table (lines 213-220).

## Database Schema Reference

### admin_treasury table columns:
- `id` (INT4)
- `total_supply` (NUMERIC) - NULL for unlimited
- `available_supply` (NUMERIC) - NULL for unlimited
- `total_sold` (NUMERIC) - NOT `total_sold_to_shops`
- `total_revenue` (NUMERIC)
- `last_updated` (TIMESTAMP)
- `supply_model` (VARCHAR) - 'unlimited'
- `circulating_supply` (NUMERIC)
- `notes` (TEXT)

### revenue_distributions table:
- Has UNIQUE constraint on (week_start, week_end)
- Requires all numeric fields to be properly calculated

## Test Script

Created `scripts/test-treasury-endpoints.js` to test all treasury endpoints locally. Run with:

```bash
cd backend
ADMIN_WALLET=your_admin_wallet node scripts/test-treasury-endpoints.js
```

## Remaining Considerations

1. **Environment Variables**: Ensure these are set in production:
   - `RCG_CONTRACT_ADDRESS`
   - `RCG_THIRDWEB_CLIENT_ID` or `THIRDWEB_CLIENT_ID`
   - `RCG_THIRDWEB_SECRET_KEY` or `THIRDWEB_SECRET_KEY`

2. **Database Migration**: Ensure the production database has:
   - `admin_treasury` table with correct schema
   - `revenue_distributions` table
   - `shop_rcn_purchases` table

3. **Error Logging**: The fixes include better error details in responses to help diagnose any remaining issues.

## How to Deploy Fixes

1. Deploy the updated `TreasuryRepository.ts` file
2. Deploy the updated `treasury.ts` routes file
3. Restart the backend service
4. Run the test script to verify endpoints work correctly