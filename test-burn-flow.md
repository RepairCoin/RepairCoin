# Test Burn Flow Instructions

## How to Test the New Token Burn Feature

### Prerequisites
- Shop dashboard open with authenticated shop
- Customer dashboard open with authenticated customer
- Customer has RCN tokens in their wallet

### Test Flow

1. **Shop initiates redemption**:
   - Go to shop dashboard → Redeem tab
   - Select "Two-Factor Approval"
   - Select or enter customer address
   - Enter redemption amount (e.g., 10 RCN)
   - Click "Request Redemption"

2. **Customer receives request**:
   - Go to customer dashboard → Redemption Approvals
   - You should see a pending redemption request
   - Notice the new "Burn X RCN" button (orange)

3. **Customer burns tokens**:
   - Click "Burn X RCN" button
   - Metamask will open asking to transfer tokens to burn address
   - Confirm the transaction
   - Wait for transaction to complete
   - Button will change to show "Approve" once burn is successful

4. **Customer approves redemption**:
   - Click "Approve" button (now green)
   - This sends approval with burn transaction hash

5. **Shop completes redemption**:
   - Refresh shop dashboard
   - Status should show "Customer Approved"
   - Click "Complete Redemption"

## What's New

### Security Enhancement
- Customers must burn tokens BEFORE approving redemptions
- Burn address: `0x000000000000000000000000000000000000dEaD`
- Two-step process ensures tokens are permanently removed

### UI Changes
- Customer sees burn button first, then approve button
- Shop sees info about new security process
- Transaction includes burn transaction hash for verification

### Backend Changes
- Redemption approval now accepts optional `transactionHash` parameter
- Service tracks burn transaction for audit trail

## Troubleshooting

### "Transaction cancelled" error
- User rejected the Metamask transaction
- Try again and approve in Metamask

### "Insufficient RCN balance" error
- Customer doesn't have enough tokens
- Check balance and try with lower amount

### Burn successful but approve fails
- Tokens are already burned (permanent)
- Contact support for manual resolution

## Notes
- This is a temporary solution until customer app implements proper signing
- In production, the mobile app will handle this flow seamlessly
- Burn transactions are permanent and cannot be reversed