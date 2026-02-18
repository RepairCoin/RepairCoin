# Production Contract Deployment Guide

## Overview

Deploy new RCN and RCG token contracts for production (Base mainnet) so all users start with 0 balance.

**Created**: February 11, 2026
**Status**: Ready to Deploy
**Priority**: High
**Method**: Thirdweb Dashboard (same as staging)

---

## Current Contracts (Staging - Base Sepolia)

| Token | Address | Network | Status |
|-------|---------|---------|--------|
| RCN | `0xBFE793d78B6B83859b528F191bd6F2b8555D951C` | Base Sepolia | Has test balances |
| RCG | `0xdaFCC0552d976339cA28EF2e84ca1c6561379c9D` | Base Sepolia | Has test balances |

---

## New Contracts (Production)

| Token | Address | Network | Status |
|-------|---------|---------|--------|
| RCN | `_________________________` | Base Mainnet | To be deployed |
| RCG | `_________________________` | Base Mainnet | To be deployed |

---

## Thirdweb Credentials (From Codebase)

### RCN Token Credentials
| Setting | Value |
|---------|-------|
| Client ID | `1969ac335e07ba13ad0f8d1a1de4f6ab` |
| Secret Key | `dGGJojl6-TnNiUd5p1IYxYa5LmjW5Tx1hVFK0KdvfNlHZrfMehJKGZ0pD7V2xHXvPbLQvBV3p8I5hMnR8SRP1g` |

### RCG Token Credentials
| Setting | Value |
|---------|-------|
| Client ID | `99f01d5781fadab9f6a42660090e824b` |
| Secret Key | `d6R5rpbrGvZY3NIy1YGwa2gmRyP3y3HjscFJFH-8uUDJPuXyka8nRZWUn2_NZnIsETH4ClP_jLAOKcfl3t0DbQ` |

### Backend Wallet (Minter)
| Setting | Value |
|---------|-------|
| Address | `0x761E5E59485ec6feb263320f5d636042bD9EBc8c` |
| Private Key | `1967843a7fc16cfd9de2e0ad71fffd86501166978c0decb2e9bd1694bd75d140` |

> **Note:** The same Thirdweb Client IDs and Secret Keys can be reused for production contracts. They are tied to the Thirdweb account, not specific contracts.

---

## Prerequisites

### 1. Backend Wallet with ETH on Base Mainnet

The backend wallet needs ETH on Base mainnet to pay for deployment and minting gas fees.

**Wallet Address:** `0x761E5E59485ec6feb263320f5d636042bD9EBc8c`

**Check balance:**
- https://basescan.org/address/0x761E5E59485ec6feb263320f5d636042bD9EBc8c
- Need at least 0.01 ETH

**If you need ETH on Base:**
- Bridge from Ethereum mainnet: https://bridge.base.org
- Or buy directly on Coinbase
- Or transfer from another wallet

### 2. Access to Thirdweb Dashboard

- Go to https://thirdweb.com/dashboard
- Connect wallet: `0x761E5E59485ec6feb263320f5d636042bD9EBc8c`
- Or connect the wallet that originally created the Thirdweb projects
- Verify you can see the existing RCN/RCG contracts on Base Sepolia

---

## Step-by-Step Deployment

### Step 1: Deploy RCN Token (Utility Token)

1. **Go to Thirdweb Dashboard**
   - URL: https://thirdweb.com/dashboard
   - Connect your admin wallet

2. **Click "Deploy" button**

3. **Select Contract Type**
   - Search for "Token"
   - Select **"Token"** (ERC20 standard token)
   - NOT "Token Drop" - we want mintable token

4. **Configure Contract**
   ```
   Name: RepairCoin
   Symbol: RCN
   Description: RepairCoin utility token for rewards
   Network: Base (mainnet) ← IMPORTANT: Not Base Sepolia!
   ```

5. **Deploy**
   - Click "Deploy Now"
   - Confirm transaction in wallet
   - Wait for deployment (~30 seconds)

6. **Copy Contract Address**
   - After deployment, copy the contract address
   - Save it: `RCN_CONTRACT_ADDRESS = ___________________`

---

### Step 2: Deploy RCG Token (Governance Token)

1. **Stay in Thirdweb Dashboard**

2. **Click "Deploy" again**

3. **Select Contract Type**
   - Search for "Token"
   - Select **"Token"** (ERC20 standard token)

4. **Configure Contract**
   ```
   Name: RepairCoin Governance
   Symbol: RCG
   Description: RepairCoin governance token
   Network: Base (mainnet) ← Same network as RCN
   ```

5. **Deploy**
   - Click "Deploy Now"
   - Confirm transaction in wallet
   - Wait for deployment

6. **Copy Contract Address**
   - Save it: `RCG_CONTRACT_ADDRESS = ___________________`

7. **Mint Initial Supply (100M RCG)**
   - Go to the deployed RCG contract in Thirdweb
   - Click "Tokens" tab
   - Click "Mint"
   - Amount: `100000000` (100 million)
   - To: Your admin wallet address
   - Click "Mint Tokens"

---

### Step 3: Grant Minter Role for RCN

The backend wallet needs permission to mint RCN tokens.

1. **Go to RCN contract in Thirdweb Dashboard**

2. **Click "Permissions" tab**

3. **Add Minter**
   - Click "Grant Role"
   - Role: Minter
   - Address: Your backend wallet address (from `PRIVATE_KEY`)
   - Click "Grant"

4. **Verify**
   - The backend wallet should now show as "Minter"

---

### Step 4: Verify Contracts on BaseScan

1. **Go to BaseScan**
   - RCN: `https://basescan.org/address/[RCN_ADDRESS]`
   - RCG: `https://basescan.org/address/[RCG_ADDRESS]`

2. **Verify Contract Source (Optional but recommended)**
   - In Thirdweb Dashboard, contracts are auto-verified
   - Check BaseScan shows "Contract Source Code Verified"

---

### Step 5: Update Production Backend Environment

**Location:** DigitalOcean → `repaircoin-prod` → Settings → Environment Variables

| Variable | Old Value | New Value |
|----------|-----------|-----------|
| `RCN_CONTRACT_ADDRESS` | `0xBFE793d78B6B83859b528F191bd6F2b8555D951C` | `[NEW RCN ADDRESS]` |
| `RCG_CONTRACT_ADDRESS` | `0xdaFCC0552d976339cA28EF2e84ca1c6561379c9D` | `[NEW RCG ADDRESS]` |
| `CHAIN_ID` | `84532` | `8453` |
| `NETWORK` | `base-sepolia` | `base` |
| `BLOCKCHAIN_NETWORK` | `base-sepolia` | `base` |

**Keep these the same (reuse for production):**
| Variable | Value (No Change) |
|----------|-------------------|
| `RCN_THIRDWEB_CLIENT_ID` | `1969ac335e07ba13ad0f8d1a1de4f6ab` |
| `RCN_THIRDWEB_SECRET_KEY` | `dGGJojl6-TnNiUd5p1IYxYa5LmjW5Tx1hVFK0KdvfNlHZrfMehJKGZ0pD7V2xHXvPbLQvBV3p8I5hMnR8SRP1g` |
| `RCG_THIRDWEB_CLIENT_ID` | `99f01d5781fadab9f6a42660090e824b` |
| `RCG_THIRDWEB_SECRET_KEY` | `d6R5rpbrGvZY3NIy1YGwa2gmRyP3y3HjscFJFH-8uUDJPuXyka8nRZWUn2_NZnIsETH4ClP_jLAOKcfl3t0DbQ` |
| `PRIVATE_KEY` | `1967843a7fc16cfd9de2e0ad71fffd86501166978c0decb2e9bd1694bd75d140` |

**Click "Save" and wait for auto-redeploy.**

---

### Step 6: Update Production Frontend Environment

**Location:** Vercel → Settings → Environment Variables → Production

| Variable | New Value |
|----------|-----------|
| `NEXT_PUBLIC_RCN_CONTRACT_ADDRESS` | `[NEW RCN ADDRESS]` |
| `NEXT_PUBLIC_RCG_CONTRACT_ADDRESS` | `[NEW RCG ADDRESS]` |
| `NEXT_PUBLIC_CHAIN_ID` | `8453` |

**Trigger redeploy after saving.**

---

### Step 7: Test Production Contracts

1. **Test RCN Minting**
   ```bash
   # Check backend health
   curl https://api.repaircoin.ai/api/health

   # Check system info shows new contracts
   curl https://api.repaircoin.ai/api/system/info
   ```

2. **Test in Browser**
   - Go to https://repaircoin.ai
   - Register a new test account
   - Verify balance shows 0 RCN

3. **Verify on BaseScan**
   - Check contract has 0 total supply initially
   - After first mint, verify transaction appears

---

## Deployment Checklist

### Pre-Deployment
- [ ] Admin wallet has ETH on Base mainnet (at least 0.01 ETH)
- [ ] Access to Thirdweb Dashboard confirmed
- [ ] Backend wallet address ready (for minter role)

### Deploy RCN
- [ ] Deploy RCN Token contract on Base mainnet
- [ ] Copy contract address: `___________________`
- [ ] Grant Minter role to backend wallet
- [ ] Verify on BaseScan

### Deploy RCG
- [ ] Deploy RCG Token contract on Base mainnet
- [ ] Copy contract address: `___________________`
- [ ] Mint 100M RCG to admin wallet
- [ ] Verify on BaseScan

### Update Environment
- [ ] Update backend env vars (DigitalOcean)
- [ ] Update frontend env vars (Vercel)
- [ ] Wait for redeployments

### Verify
- [ ] Backend health check passes
- [ ] System info shows new contract addresses
- [ ] New user registration shows 0 balance
- [ ] Test mint works (if applicable)

---

## Network Reference

| Setting | Staging | Production |
|---------|---------|------------|
| Network Name | Base Sepolia | Base |
| Chain ID | 84532 | 8453 |
| RPC URL | https://sepolia.base.org | https://mainnet.base.org |
| Explorer | sepolia.basescan.org | basescan.org |
| Currency | ETH (test) | ETH (real) |

---

## Rollback Plan

If issues occur after switching to new contracts:

1. **Revert Environment Variables**
   - Change contract addresses back to staging values
   - Change CHAIN_ID back to `84532`
   - Change NETWORK back to `base-sepolia`

2. **Redeploy**
   - Backend will auto-redeploy
   - Manually redeploy frontend in Vercel

**Note:** New contracts will remain deployed but unused. No funds are lost.

---

## Final Configuration

After successful deployment:

| Environment | RCN Contract | RCG Contract | Network |
|-------------|--------------|--------------|---------|
| **Staging** | `0xBFE793d78B6B83859b528F191bd6F2b8555D951C` | `0xdaFCC0552d976339cA28EF2e84ca1c6561379c9D` | Base Sepolia |
| **Production** | `[NEW ADDRESS]` | `[NEW ADDRESS]` | Base Mainnet |

---

## Estimated Time

| Task | Time |
|------|------|
| Deploy RCN contract | 2-3 min |
| Deploy RCG contract | 2-3 min |
| Mint RCG supply | 1 min |
| Grant minter role | 1 min |
| Update env vars | 5 min |
| Wait for redeploy | 5 min |
| Testing | 10 min |
| **Total** | **~30 minutes** |
