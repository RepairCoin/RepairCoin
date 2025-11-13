# RepairCoin Mainnet Deployment & Multi-Sig Plan

**Document Version:** 1.0
**Created:** 2025-10-29
**Status:** PLANNING
**Risk Level:** 🔴 CRITICAL

---

## Table of Contents

1. [Overview](#overview)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Smart Contract Deployment Plan](#smart-contract-deployment-plan)
4. [Multi-Sig Wallet Setup](#multi-sig-wallet-setup)
5. [Security Audit Requirements](#security-audit-requirements)
6. [Testing Strategy](#testing-strategy)
7. [Migration Plan](#migration-plan)
8. [Rollback Procedures](#rollback-procedures)
9. [Post-Deployment Monitoring](#post-deployment-monitoring)

---

## Overview

### Current State
- **Network:** Base Sepolia (Testnet)
- **RCN Contract:** `0xBFE793d78B6B83859b528F191bd6F2b8555D951C`
- **RCG Contract:** `0xdaFCC0552d976339cA28EF2e84ca1c6561379c9D`
- **Admin Wallet:** Single private key (HIGH RISK)
- **Total Value:** Currently testnet only

### Target State
- **Network:** Base Mainnet
- **RCN Contract:** New deployment (mainnet)
- **RCG Contract:** New deployment (mainnet)
- **Admin Wallet:** Gnosis Safe Multi-Sig (3/5 or 4/7)
- **Total Value:** Real money - REQUIRES SECURITY

---

## Pre-Deployment Checklist

### ✅ MUST COMPLETE BEFORE DEPLOYMENT

#### 1. Security Audit
- [ ] **Professional security audit** of all smart contracts
  - Recommended: OpenZeppelin, Trail of Bits, or Consensys Diligence
  - Minimum: Self-audit + community review
  - Cost: $10k-$50k (professional) or free (community)
- [ ] **Fix all critical and high severity issues**
- [ ] **Document all medium/low findings** and accept risks

#### 2. Testing
- [ ] **100% test coverage** on smart contracts
  - Unit tests (Hardhat/Foundry)
  - Integration tests
  - Fuzz testing
  - Gas optimization tests
- [ ] **Mainnet fork testing**
  - Test all functions on Base Mainnet fork
  - Verify gas costs are acceptable
  - Test edge cases
- [ ] **End-to-end testing**
  - Complete user flows (earn, redeem, transfer)
  - Multi-sig operations
  - Emergency pause scenarios

#### 3. Documentation
- [ ] **Contract documentation** complete
- [ ] **Deployment runbook** created
- [ ] **Emergency procedures** documented
- [ ] **Multi-sig operations guide** written
- [ ] **User migration guide** prepared

#### 4. Legal & Compliance
- [ ] **Legal review** of token economics
- [ ] **Terms of service** updated
- [ ] **Privacy policy** updated
- [ ] **Regulatory compliance** verified (if applicable)

#### 5. Infrastructure
- [ ] **Backup systems** in place
- [ ] **Monitoring alerts** configured
- [ ] **Incident response plan** ready
- [ ] **Multiple RPC endpoints** configured

---

## Smart Contract Deployment Plan

### Phase 1: Contract Preparation

#### Step 1.1: Contract Finalization
```solidity
// contracts/RepairCoinV2.sol (RCN - Utility Token)
// Current version is good, but consider:

1. Add AccessControl instead of simple Ownable
   - MINTER_ROLE for backend
   - PAUSER_ROLE for emergency
   - ADMIN_ROLE for multi-sig

2. Add rate limiting for minting
   - Prevent accidental large mints
   - Daily/hourly limits

3. Add comprehensive events
   - MintRateChanged
   - ShopAuthorized
   - EmergencyPaused

4. Consider upgradability (optional)
   - Use UUPS or Transparent Proxy
   - Allows bug fixes post-deployment
   - Adds complexity
```

```solidity
// contracts/RepairCoinGovernance.sol (RCG - Governance Token)
// Need to create or verify this exists

1. Fixed supply: 100,000,000 RCG
2. No minting after initial supply
3. Burnable (optional)
4. Governance features:
   - Vote delegation
   - Snapshot functionality
5. Staking contract integration
```

#### Step 1.2: Gas Optimization
```bash
# Run gas reports
npx hardhat test --gas-reporter

# Optimize critical functions:
- mint() - Used frequently
- burn() - Used for redemptions
- transfer() - Used for shop payments

# Target: < 50k gas per operation
```

#### Step 1.3: Contract Compilation
```bash
# Ensure latest Solidity version
# RepairCoinV2.sol uses ^0.8.20 - GOOD

npx hardhat compile --force

# Verify:
✓ No compiler warnings
✓ No unused variables
✓ Optimizations enabled (runs: 200)
```

---

### Phase 2: Testnet Deployment (Base Sepolia)

#### Step 2.1: Deploy Contracts
```bash
# Deploy RCN
npx hardhat run scripts/deploy-rcn-mainnet.ts --network base-sepolia

# Deploy RCG
npx hardhat run scripts/deploy-rcg-mainnet.ts --network base-sepolia

# Deploy Gnosis Safe (or use existing)
# We'll use Safe's official deployment
```

#### Step 2.2: Verify Contracts
```bash
# Verify RCN on BaseScan
npx hardhat verify --network base-sepolia <RCN_ADDRESS> <INITIAL_OWNER>

# Verify RCG on BaseScan
npx hardhat verify --network base-sepolia <RCG_ADDRESS> <INITIAL_OWNER>
```

#### Step 2.3: Test All Functionality
```bash
# Test minting
npx hardhat run scripts/test-mint.ts --network base-sepolia

# Test burning
npx hardhat run scripts/test-burn.ts --network base-sepolia

# Test transfers
npx hardhat run scripts/test-transfer.ts --network base-sepolia

# Test pause/unpause
npx hardhat run scripts/test-pause.ts --network base-sepolia

# Test multi-sig operations
npx hardhat run scripts/test-multisig.ts --network base-sepolia
```

---

### Phase 3: Mainnet Deployment

#### Step 3.1: Pre-Deployment Final Checks
```bash
# Create deployment checklist
□ Security audit complete
□ All tests passing
□ Gas costs reviewed
□ Multi-sig wallet ready
□ RPC endpoints configured
□ Backup systems online
□ Team notified
□ Documentation updated
```

#### Step 3.2: Deploy to Base Mainnet

**🚨 CRITICAL: This costs real money. Double-check everything! 🚨**

```typescript
// scripts/deploy-rcn-mainnet.ts
import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying RepairCoin (RCN) to Base Mainnet...");

  // IMPORTANT: Use multi-sig address as initial owner
  const MULTISIG_ADDRESS = "0x..."; // Gnosis Safe address

  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log("Deploying from:", deployer.address);

  // Check balance
  const balance = await deployer.getBalance();
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  if (balance < ethers.parseEther("0.01")) {
    throw new Error("Insufficient ETH for deployment");
  }

  // Deploy RCN
  const RepairCoin = await ethers.getContractFactory("RepairCoinV2");
  const rcn = await RepairCoin.deploy(MULTISIG_ADDRESS);

  await rcn.waitForDeployment();
  const rcnAddress = await rcn.getAddress();

  console.log("✅ RCN deployed to:", rcnAddress);
  console.log("📝 Owner:", MULTISIG_ADDRESS);

  // Wait for block confirmations
  console.log("⏳ Waiting for 5 confirmations...");
  await rcn.deploymentTransaction()?.wait(5);

  console.log("✅ Deployment confirmed!");

  return {
    rcn: rcnAddress,
    owner: MULTISIG_ADDRESS
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

```typescript
// scripts/deploy-rcg-mainnet.ts
async function main() {
  console.log("🚀 Deploying RepairCoin Governance (RCG) to Base Mainnet...");

  const MULTISIG_ADDRESS = "0x...";
  const INITIAL_SUPPLY = ethers.parseEther("100000000"); // 100M RCG

  const [deployer] = await ethers.getSigners();

  // Deploy RCG
  const RepairCoinGov = await ethers.getContractFactory("RepairCoinGovernance");
  const rcg = await RepairCoinGov.deploy(
    MULTISIG_ADDRESS,
    INITIAL_SUPPLY
  );

  await rcg.waitForDeployment();
  const rcgAddress = await rcg.getAddress();

  console.log("✅ RCG deployed to:", rcgAddress);
  console.log("📝 Total Supply:", ethers.formatEther(INITIAL_SUPPLY));

  // Wait for confirmations
  await rcg.deploymentTransaction()?.wait(5);

  return {
    rcg: rcgAddress,
    supply: INITIAL_SUPPLY
  };
}
```

#### Step 3.3: Verify on BaseScan
```bash
# Verify RCN
npx hardhat verify --network base-mainnet \
  <RCN_ADDRESS> \
  <MULTISIG_ADDRESS>

# Verify RCG
npx hardhat verify --network base-mainnet \
  <RCG_ADDRESS> \
  <MULTISIG_ADDRESS> \
  "100000000000000000000000000" # 100M with 18 decimals
```

#### Step 3.4: Configure Backend
```bash
# Update .env
RCN_CONTRACT_ADDRESS=0x... # New mainnet address
RCG_CONTRACT_ADDRESS=0x... # New mainnet address
CHAIN_ID=8453 # Base Mainnet
RPC_URL=https://mainnet.base.org

# Update frontend .env
NEXT_PUBLIC_RCN_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_RCG_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_CHAIN_ID=8453
```

---

## Multi-Sig Wallet Setup

### Why Multi-Sig?

**Current Risk (Single Wallet):**
- ❌ Private key compromise = total loss
- ❌ Single point of failure
- ❌ No approval process
- ❌ No audit trail
- ❌ Cannot be recovered if lost

**With Multi-Sig:**
- ✅ Multiple signers required (3/5, 4/7)
- ✅ Distributed trust
- ✅ Approval workflow
- ✅ Full audit trail
- ✅ Recoverable (if some keys lost)

---

### Phase 1: Gnosis Safe Setup

#### Step 1.1: Choose Signers

**Recommended: 4-of-7 Multi-Sig**

Signers should include:
1. **Founder 1** - Primary decision maker
2. **Founder 2** - Secondary decision maker
3. **Technical Lead** - Understands smart contracts
4. **Operations Lead** - Manages day-to-day
5. **Legal Advisor** - Compliance oversight
6. **Trusted Advisor 1** - External oversight
7. **Trusted Advisor 2** - External oversight

**Signature Threshold:** 4/7
- Requires majority approval
- Prevents single point of failure
- Allows for 3 signers to be unavailable

**Alternative: 3-of-5 Multi-Sig** (Smaller team)
- 3 core team members
- 2 trusted advisors
- Requires 3 signatures

#### Step 1.2: Create Gnosis Safe

**Option A: Use Safe UI (Recommended)**
```
1. Go to https://app.safe.global
2. Connect wallet (deployer wallet)
3. Select "Base" network
4. Click "Create Safe"
5. Add all signer addresses
6. Set threshold (3/5 or 4/7)
7. Review and deploy
8. Cost: ~$5-20 in gas fees
```

**Option B: Programmatic Deployment**
```typescript
// scripts/deploy-safe.ts
import Safe, { EthersAdapter } from '@safe-global/protocol-kit';
import { ethers } from 'hardhat';

async function deploySafe() {
  const [deployer] = await ethers.getSigners();

  const ethAdapter = new EthersAdapter({
    ethers,
    signerOrProvider: deployer
  });

  const safeFactory = await Safe.create({ ethAdapter });

  const owners = [
    "0x...", // Signer 1
    "0x...", // Signer 2
    "0x...", // Signer 3
    "0x...", // Signer 4
    "0x..."  // Signer 5
  ];

  const threshold = 3; // 3 of 5

  const safeAccountConfig = {
    owners,
    threshold
  };

  const safeSdk = await safeFactory.deploySafe({ safeAccountConfig });
  const safeAddress = await safeSdk.getAddress();

  console.log("✅ Safe deployed:", safeAddress);
  console.log("📝 Owners:", owners);
  console.log("🔐 Threshold:", threshold);

  return safeAddress;
}
```

#### Step 1.3: Fund the Safe
```bash
# Send ETH for gas fees
# Minimum: 0.1 ETH
# Recommended: 0.5 ETH

# From deployer wallet:
cast send <SAFE_ADDRESS> \
  --value 0.5ether \
  --private-key <DEPLOYER_KEY>
```

---

### Phase 2: Transfer Ownership to Multi-Sig

#### Step 2.1: Transfer RCN Ownership

```typescript
// scripts/transfer-rcn-ownership.ts
import { ethers } from "hardhat";

async function transferOwnership() {
  const RCN_ADDRESS = "0x..."; // Deployed RCN
  const SAFE_ADDRESS = "0x..."; // Gnosis Safe

  const [deployer] = await ethers.getSigners();
  const rcn = await ethers.getContractAt("RepairCoinV2", RCN_ADDRESS);

  // Check current owner
  const currentOwner = await rcn.owner();
  console.log("Current owner:", currentOwner);
  console.log("Deployer:", deployer.address);

  if (currentOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error("Deployer is not the current owner!");
  }

  console.log("🔄 Transferring ownership to Safe:", SAFE_ADDRESS);

  // Transfer ownership
  const tx = await rcn.transferOwnership(SAFE_ADDRESS);
  console.log("📝 Transaction:", tx.hash);

  await tx.wait(3);
  console.log("✅ Confirmed!");

  // Verify
  const newOwner = await rcn.owner();
  console.log("✅ New owner:", newOwner);

  if (newOwner.toLowerCase() !== SAFE_ADDRESS.toLowerCase()) {
    throw new Error("Ownership transfer failed!");
  }

  console.log("🎉 RCN ownership transferred to multi-sig!");
}
```

#### Step 2.2: Transfer RCG Ownership
```typescript
// Same process for RCG
// scripts/transfer-rcg-ownership.ts
```

#### Step 2.3: Verify Ownership
```bash
# Check RCN owner
cast call <RCN_ADDRESS> "owner()(address)" --rpc-url <BASE_RPC>

# Should return: <SAFE_ADDRESS>

# Check RCG owner
cast call <RCG_ADDRESS> "owner()(address)" --rpc-url <BASE_RPC>

# Should return: <SAFE_ADDRESS>
```

---

### Phase 3: Configure Multi-Sig Operations

#### Step 3.1: Grant Backend Minting Role

**Problem:** Backend needs to mint tokens, but can't do full transactions

**Solution:** Grant MINTER_ROLE to backend wallet

```solidity
// Update RepairCoinV2.sol to use AccessControl
import "@openzeppelin/contracts/access/AccessControl.sol";

contract RepairCoinV2 is ERC20, ERC20Burnable, AccessControl, Pausable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function mint(address to, uint256 amount, string memory reason)
        public
        onlyRole(MINTER_ROLE)
        whenNotPaused
    {
        _mint(to, amount);
        totalMinted += amount;
        emit TokensMinted(to, amount, reason);
    }
}
```

**Via Multi-Sig:**
```typescript
// scripts/grant-minter-role.ts
// This transaction MUST be proposed through Gnosis Safe

const BACKEND_WALLET = "0x..."; // Backend wallet address
const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));

// Encode the function call
const rcn = await ethers.getContractAt("RepairCoinV2", RCN_ADDRESS);
const data = rcn.interface.encodeFunctionData("grantRole", [
  MINTER_ROLE,
  BACKEND_WALLET
]);

// Submit to Safe (via Safe UI or SDK)
console.log("📝 Propose this transaction in Safe:");
console.log("To:", RCN_ADDRESS);
console.log("Data:", data);
console.log("Value: 0");

// Signers approve in Safe UI
// Requires 3/5 or 4/7 signatures
```

#### Step 3.2: Set Up Daily Spending Limits (Optional)

```solidity
// Use Gnosis Safe's allowance module
// Allows backend to mint up to X RCN per day without multi-sig

// Not recommended for initial launch
// Add later once system is proven
```

---

### Phase 4: Multi-Sig Operation Procedures

#### Standard Minting Operation
```
1. Backend detects need to mint (customer reward)
2. Backend calls mint() with MINTER_ROLE
3. Transaction executes immediately (no multi-sig needed)
4. Multi-sig owners can revoke MINTER_ROLE if compromised
```

#### Emergency Pause
```
1. Any signer detects issue
2. Proposes pause() transaction in Safe
3. Other signers review and approve (4/7 needed)
4. Once threshold reached, executor submits transaction
5. Contract paused immediately
```

#### Ownership Changes
```
1. Decision made to change ownership/roles
2. Transaction proposed in Safe with details
3. Minimum 4/7 signatures required
4. 24-48 hour timelock (optional, recommended)
5. Transaction executed
```

---

## Security Audit Requirements

### Critical Items to Audit

#### 1. Smart Contracts
```
✓ RepairCoinV2.sol (RCN)
  - Minting logic
  - Burning logic
  - Pause mechanism
  - Access control
  - Event emissions

✓ RepairCoinGovernance.sol (RCG)
  - Fixed supply enforcement
  - Transfer restrictions
  - Governance features
  - Staking compatibility

✓ Any associated contracts
  - Staking contract (if exists)
  - Treasury contract (if exists)
  - Vesting contract (if exists)
```

#### 2. Common Vulnerabilities to Check
```
□ Reentrancy attacks
□ Integer overflow/underflow
□ Front-running
□ Access control bypasses
□ Flash loan attacks
□ Denial of service
□ Gas manipulation
□ Timestamp dependence
□ Centralization risks
□ Upgrade vulnerabilities
```

### Audit Checklist

#### Self-Audit (Before Professional)
```bash
# Run Slither
slither contracts/

# Run Mythril
myth analyze contracts/RepairCoinV2.sol

# Run Echidna (fuzz testing)
echidna contracts/RepairCoinV2.sol

# Manual code review checklist:
□ All functions have access control
□ All state changes emit events
□ No unchecked external calls
□ Proper error handling
□ Gas optimization reviewed
□ Documentation complete
```

#### Professional Audit
```
Recommended firms:
1. OpenZeppelin (Tier 1)
   - Cost: $40k-$80k
   - Timeline: 4-6 weeks
   - Contact: security@openzeppelin.com

2. Trail of Bits (Tier 1)
   - Cost: $50k-$100k
   - Timeline: 4-8 weeks
   - Contact: info@trailofbits.com

3. Consensys Diligence (Tier 1)
   - Cost: $30k-$60k
   - Timeline: 3-5 weeks

Budget Options:
4. Code4rena (Competitive audit)
   - Cost: $20k-$40k
   - Timeline: 2-3 weeks
   - Community-driven

5. Sherlock Protocol
   - Cost: $15k-$30k
   - Timeline: 2-4 weeks
```

---

## Testing Strategy

### Test Coverage Requirements

#### Unit Tests (Hardhat/Foundry)
```typescript
// test/RepairCoinV2.test.ts

describe("RepairCoinV2", function () {
  // Deployment tests
  it("Should deploy with correct name and symbol");
  it("Should set correct initial owner");
  it("Should start with zero supply");

  // Minting tests
  it("Should allow owner to mint");
  it("Should not allow non-owner to mint");
  it("Should emit TokensMinted event");
  it("Should update totalMinted correctly");
  it("Should fail minting when paused");
  it("Should fail minting with invalid addresses");
  it("Should fail minting zero amount");

  // Burning tests
  it("Should allow anyone to burn their tokens");
  it("Should emit TokensBurned event");
  it("Should update totalBurned correctly");
  it("Should fail burning more than balance");
  it("Should fail burning when paused");

  // Transfer tests
  it("Should allow transfers when not paused");
  it("Should fail transfers when paused");
  it("Should update balances correctly");

  // Pause tests
  it("Should allow owner to pause");
  it("Should allow owner to unpause");
  it("Should not allow non-owner to pause");
  it("Should block all operations when paused");

  // Access control tests
  it("Should grant and revoke roles correctly");
  it("Should enforce role requirements");

  // Edge cases
  it("Should handle maximum uint256 amounts");
  it("Should handle gas-intensive operations");
  it("Should prevent reentrancy");
});

// Target: 100% coverage
```

#### Integration Tests
```typescript
// test/integration/EndToEnd.test.ts

describe("RepairCoin End-to-End", function () {
  it("Complete user flow: earn, hold, redeem");
  it("Shop flow: purchase RCN, issue rewards");
  it("Multi-sig flow: propose, approve, execute");
  it("Emergency flow: detect issue, pause, fix, unpause");
  it("Governance flow: stake, vote, execute");
});
```

#### Mainnet Fork Tests
```bash
# Test on Base Mainnet fork
npx hardhat test --network hardhat --fork https://mainnet.base.org

# Tests:
□ Deployment costs (actual gas prices)
□ Contract interactions
□ Multi-sig operations
□ Large transfers
□ Edge cases with real data
```

---

## Migration Plan

### Step-by-Step Migration

#### Step 1: Testnet Migration (Dry Run)
```
1. Deploy new contracts on Base Sepolia
2. Migrate 10 test users
3. Verify all balances correct
4. Test all user operations
5. Document any issues
6. Repeat until perfect
```

#### Step 2: User Communication
```
Email/Announcement:
"RepairCoin is upgrading to Base Mainnet!

What this means:
- Your RCN balance will be migrated automatically
- No action required from you
- Downtime: ~1 hour on [DATE]
- Your earned RCN is safe

Timeline:
- [DATE] 9:00 AM: Freeze testnet operations
- [DATE] 9:30 AM: Deploy mainnet contracts
- [DATE] 10:00 AM: Migrate balances
- [DATE] 10:30 AM: Resume operations

Questions? Contact support@repaircoin.com"
```

#### Step 3: Freeze Testnet (D-Day)
```bash
# 9:00 AM: Freeze all operations
ENABLE_BLOCKCHAIN_MINTING=false
MAINTENANCE_MODE=true

# Database backup
pg_dump repaircoin_prod > backup-$(date +%Y%m%d).sql

# Snapshot all balances
npm run scripts:snapshot-balances
```

#### Step 4: Deploy Mainnet Contracts
```bash
# 9:30 AM: Deploy (already tested!)
npx hardhat run scripts/deploy-mainnet.ts --network base-mainnet

# Verify
npx hardhat verify --network base-mainnet ...
```

#### Step 5: Migrate Balances
```typescript
// scripts/migrate-balances.ts

// Option A: Snapshot migration (Recommended)
// Mint equivalent amounts on mainnet based on testnet snapshot

const snapshot = await loadSnapshot(); // From database
const rcn = await ethers.getContractAt("RepairCoinV2", RCN_ADDRESS);

for (const user of snapshot.users) {
  if (user.balance > 0) {
    console.log(`Minting ${user.balance} RCN to ${user.address}`);

    const tx = await rcn.mint(
      user.address,
      user.balance,
      "Testnet migration"
    );

    await tx.wait();
    console.log(`✅ Migrated ${user.address}`);
  }
}

// Option B: Airdrop (if balances are large)
// Use Merkle tree for gas efficiency
```

#### Step 6: Update Backend
```bash
# Update .env
RCN_CONTRACT_ADDRESS=<new-mainnet-address>
RCG_CONTRACT_ADDRESS=<new-mainnet-address>
CHAIN_ID=8453

# Restart backend
pm2 restart repaircoin-backend
```

#### Step 7: Verify Migration
```bash
# Check random samples
npm run scripts:verify-migration

# Compare totals
Testnet supply: X RCN
Mainnet supply: X RCN
✓ Match!
```

#### Step 8: Resume Operations
```bash
# 10:30 AM: Go live
ENABLE_BLOCKCHAIN_MINTING=true
MAINTENANCE_MODE=false

# Monitor for 1 hour
# Check all systems green
```

---

## Rollback Procedures

### If Deployment Fails

#### Scenario 1: Contract Deploy Fails
```
Problem: Contract won't deploy or has errors

Action:
1. Don't panic - nothing deployed yet
2. Review error messages
3. Fix contracts
4. Redeploy to testnet
5. Test thoroughly
6. Retry mainnet deployment

Loss: Gas fees only (~$50-200)
```

#### Scenario 2: Migration Fails Midway
```
Problem: Some users migrated, some didn't

Action:
1. Pause new operations
2. Document which users migrated
3. Complete remaining migrations
4. Verify all balances
5. Resume operations

Loss: Downtime (extra 1-2 hours)
```

#### Scenario 3: Critical Bug Found Post-Deploy
```
Problem: Security issue discovered after mainnet deploy

Action:
1. Pause contract immediately (if pausable)
2. Assess severity
3. If CRITICAL:
   a. Keep paused
   b. Deploy fixed version
   c. Migrate to new contract
4. If NOT CRITICAL:
   a. Add to upgrade plan
   b. Monitor closely
   c. Fix in next version

Loss: Depends on severity
```

### Emergency Pause Procedure
```
1. Any signer detects critical issue
2. Immediately proposes pause() in Safe
3. Alert all other signers (phone/Telegram)
4. Fast-track approval (get 4/7 ASAP)
5. Execute pause
6. Assess situation
7. Plan fix
8. Test fix on testnet
9. Deploy fix on mainnet
10. Unpause

Target: Pause within 15 minutes of detection
```

---

## Post-Deployment Monitoring

### Metrics to Monitor

#### Real-time Alerts
```yaml
Contract Events:
  - TokensMinted > 10000 RCN in single transaction
  - TokensBurned > 5000 RCN in single transaction
  - Paused event triggered
  - Ownership changed
  - Role granted/revoked

Transaction Failures:
  - Mint failures > 3 in 1 hour
  - Burn failures > 5 in 1 hour
  - Any revert reason containing "security"

Multi-Sig Activity:
  - New transaction proposed
  - Transaction approved (track threshold)
  - Transaction executed
  - Threshold changed
  - Owner added/removed

Gas Prices:
  - Base fee > 50 gwei (high gas alert)
  - Transaction pending > 10 minutes

Balances:
  - Multi-sig ETH balance < 0.05 ETH
  - Backend wallet ETH balance < 0.01 ETH
  - RCN circulating supply vs database mismatch > 1%
```

#### Daily Reports
```
Contract Health:
- Total RCN minted (24h)
- Total RCN burned (24h)
- Net circulation change
- Number of holders
- Number of transactions
- Average transaction size
- Gas costs (total and average)

Multi-Sig Activity:
- Pending transactions
- Executed transactions
- Failed transactions
- Signer activity

System Health:
- RPC endpoint uptime
- Backend wallet balance
- Multi-sig balance
- Contract pause status
```

### Monitoring Setup

#### Option 1: Tenderly
```bash
# Best for smart contract monitoring
# https://tenderly.co

1. Create Tenderly account
2. Add contracts (RCN, RCG, Safe)
3. Set up alerts:
   - Large mints
   - Emergency pause
   - Ownership changes
   - Failed transactions
4. Configure webhooks to Slack/Discord
5. Review dashboards daily
```

#### Option 2: OpenZeppelin Defender
```bash
# Best for automated operations
# https://defender.openzeppelin.com

1. Create Defender account
2. Add contracts
3. Set up Sentinels (monitors):
   - Monitor mint events
   - Monitor pause events
   - Monitor multi-sig transactions
4. Set up Autotasks:
   - Auto-pause on suspicious activity
   - Auto-alert on thresholds
5. Configure Relay for backend
```

#### Option 3: Custom Monitoring
```typescript
// services/ContractMonitor.ts
import { ethers } from 'ethers';

class ContractMonitor {
  async monitorEvents() {
    const rcn = new ethers.Contract(RCN_ADDRESS, ABI, provider);

    // Listen for large mints
    rcn.on("TokensMinted", (to, amount, reason) => {
      if (amount > ethers.parseEther("10000")) {
        sendAlert({
          type: "LARGE_MINT",
          amount: ethers.formatEther(amount),
          to,
          reason
        });
      }
    });

    // Listen for pause
    rcn.on("Paused", (account) => {
      sendAlert({
        type: "CONTRACT_PAUSED",
        account,
        severity: "CRITICAL"
      });
    });
  }
}
```

---

## Timeline & Costs

### Estimated Timeline

```
Week 1-2: Preparation
- Security audit begins
- Test coverage to 100%
- Documentation complete
- Multi-sig signer coordination

Week 3-4: Audit & Fixes
- Audit findings received
- Critical issues fixed
- Re-test everything
- Audit sign-off

Week 5: Multi-Sig Setup
- Deploy Gnosis Safe
- Add all signers
- Test operations
- Document procedures

Week 6: Testnet Migration
- Deploy to Base Sepolia
- Dry run migration
- Fix any issues
- Final testing

Week 7: Mainnet Deployment
- Deploy contracts
- Transfer ownership
- Configure roles
- Monitor

Week 8: User Migration
- Communicate with users
- Freeze testnet
- Migrate balances
- Go live

Total: 8 weeks minimum
```

### Estimated Costs

```
Security Audit:
- Professional (Tier 1): $40k-$80k
- Community (Code4rena): $20k-$40k
- Self-audit: $0 (HIGH RISK)

Contract Deployment:
- RCN deployment: ~$50-200 (gas)
- RCG deployment: ~$50-200 (gas)
- Safe deployment: ~$50-100 (gas)
- Contract verification: Free

Migration:
- Balance migration gas: ~$500-2000
  (Depends on number of users)
- Monitoring tools: $0-500/month
- Buffer for emergencies: $1000

Total (with professional audit): $42k-$84k
Total (with community audit): $22k-$44k
Total (self-audit - NOT RECOMMENDED): $2k-$4k
```

---

## Decision Points

### Key Decisions Needed

#### 1. Audit Strategy
```
Option A: Professional Tier 1 Audit
✓ Highest confidence
✓ Insurance/compliance
✗ Expensive ($40k-80k)
✗ 4-6 week timeline

Option B: Community Audit
✓ Cost effective ($20k-40k)
✓ Transparent
✗ Less comprehensive
✗ May miss edge cases

Option C: Self-Audit Only
✓ Free
✓ Fast
✗ HIGH RISK
✗ Not recommended for real money

RECOMMENDATION: Option B (Community) minimum
                 Option A (Professional) if budget allows
```

#### 2. Multi-Sig Configuration
```
Option A: 3-of-5
✓ Easier to coordinate
✓ Faster decisions
✗ Less redundancy
✗ Higher centralization risk

Option B: 4-of-7
✓ Better security
✓ More redundancy
✗ Harder to coordinate
✗ Slower decisions

RECOMMENDATION: Start with 3-of-5
                Upgrade to 4-of-7 as team grows
```

#### 3. Contract Upgradability
```
Option A: Non-Upgradable
✓ Simpler
✓ More secure
✗ Can't fix bugs
✗ Can't add features

Option B: Upgradable (UUPS/Transparent Proxy)
✓ Can fix bugs
✓ Can add features
✗ More complex
✗ Additional attack surface
✗ Requires audit of upgrade mechanism

RECOMMENDATION: Start non-upgradable
                Add upgradeability in V3 if needed
```

---

## Success Criteria

### Deployment Success
```
✓ Contracts deployed successfully
✓ Ownership transferred to multi-sig
✓ All roles configured correctly
✓ Backend can mint tokens
✓ Multi-sig can execute operations
✓ Contracts verified on BaseScan
✓ No critical issues found
✓ Monitoring active
✓ Team trained on procedures
```

### Migration Success
```
✓ All balances migrated correctly
✓ Total supply matches
✓ No user funds lost
✓ Downtime < 2 hours
✓ All systems operational
✓ User complaints < 1%
✓ No critical bugs discovered
```

---

## Next Steps

1. **Review this plan** with team
2. **Make decisions** on key points (audit, multi-sig, etc.)
3. **Create timeline** based on decisions
4. **Budget allocation** for audit and costs
5. **Assign responsibilities** to team members
6. **Begin preparation** (tests, docs, etc.)

---

## Resources

### Tools
- **Hardhat:** https://hardhat.org
- **Foundry:** https://getfoundry.sh
- **Gnosis Safe:** https://safe.global
- **Tenderly:** https://tenderly.co
- **OpenZeppelin Defender:** https://defender.openzeppelin.com
- **BaseScan:** https://basescan.org

### Documentation
- **Base Docs:** https://docs.base.org
- **Gnosis Safe Docs:** https://docs.safe.global
- **OpenZeppelin Contracts:** https://docs.openzeppelin.com
- **Thirdweb:** https://portal.thirdweb.com

### Auditors
- **OpenZeppelin:** https://openzeppelin.com/security-audits
- **Trail of Bits:** https://www.trailofbits.com
- **Consensys Diligence:** https://consensys.net/diligence
- **Code4rena:** https://code4rena.com
- **Sherlock:** https://www.sherlock.xyz

---

**Document Status:** DRAFT - Requires team review and approval

**Next Review:** Weekly until deployment

**Owner:** Technical Team

**Last Updated:** 2025-10-29
