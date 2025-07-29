# RepairCoin Wallet Requirements & Security Guidelines

## ⚠️ CRITICAL: Current Status
- **Current State**: All 1 billion RCN tokens are in a single wallet (TESTING ONLY)
- **Production Requirement**: Must distribute to multi-sig wallets before mainnet launch
- **Security Risk**: Single point of failure - immediate action required before going live

## 📊 Official Token Distribution (Per Requirements v1.1)

### Token Allocation
| Allocation | Percentage | Amount (RCN) | Purpose |
|------------|------------|--------------|---------|
| Customer Rewards Pool | 40% | 400,000,000 | Repair rewards, referrals, engagement |
| Business Operations Fund | 20% | 200,000,000 | Platform operations, liquidity, growth |
| Team & Investor Allocation | 40% | 400,000,000 | Founders, team, investors, partnerships |

### Business Operations Fund Breakdown (200M RCN)
- **Shop Sales Treasury**: 100,000,000 RCN (shops purchase at $1/RCN)
- **Liquidity Provision**: 50,000,000 RCN (DEX liquidity)
- **Operational Reserve**: 30,000,000 RCN (daily operations)
- **Emergency Reserve**: 20,000,000 RCN (contingency)

## 🔐 Multi-Signature Wallet Requirements

### 1. Customer Rewards Pool Wallet
- **Type**: Multi-signature wallet
- **Configuration**: 2-of-3 signatures recommended
- **Purpose**: Immediate access for customer reward distribution
- **Access Frequency**: High (daily operations)

### 2. Business Operations Fund Wallet
- **Type**: Multi-signature wallet
- **Configuration**: 3-of-5 signatures (REQUIRED by specification)
- **Purpose**: Shop RCN purchases, platform operations
- **Access Frequency**: Medium (weekly/monthly)

### 3. Team & Investor Allocation Wallet
- **Type**: Vesting contract
- **Configuration**: Time-locked with specific release schedule
- **Vesting Terms**: 
  - 4-year vesting period
  - 12-month cliff
  - Quarterly releases after cliff

## 👥 Authorized Signers (Per Requirements)

### Required Signers for Multi-sig
1. Miguel Rodriguez (Founder)
2. Zeff (Lead Developer)
3. FixFlow Co-founder
4. Independent Security Developer
5. Backup Cold Storage Wallet

### Signature Requirements
- **Critical Functions**: 3-of-5 signatures
- **Daily Operations**: 2-of-3 signatures
- **Emergency Actions**: Defined escalation process

## 📋 Pre-Launch Wallet Setup Checklist

### Phase 1: Wallet Creation
- [ ] Create Customer Rewards multi-sig wallet on Base
- [ ] Create Business Operations multi-sig wallet on Base
- [ ] Deploy Team & Investor vesting contract
- [ ] Create cold storage backup wallet
- [ ] Document all wallet addresses

### Phase 2: Security Configuration
- [ ] Configure multi-sig thresholds
- [ ] Add all authorized signers
- [ ] Test signature requirements
- [ ] Set up monitoring alerts
- [ ] Create backup recovery process

### Phase 3: Token Distribution
- [ ] Transfer 400M RCN to Customer Rewards wallet
- [ ] Transfer 200M RCN to Business Operations wallet
- [ ] Transfer 400M RCN to Team vesting contract
- [ ] Verify all balances
- [ ] Burn any remaining tokens in original wallet

### Phase 4: Operational Testing
- [ ] Test customer reward distribution
- [ ] Test shop RCN purchase flow
- [ ] Test multi-sig approval process
- [ ] Test emergency procedures
- [ ] Document all processes

## 🛠️ Implementation Tools

### Recommended Multi-sig Solutions
1. **Safe (Gnosis Safe)** - Industry standard
   - URL: https://app.safe.global/
   - Network: Base
   - Features: User-friendly, battle-tested, good UX

2. **Alternative Options**
   - Multis
   - Argent
   - Custom smart contract

### Vesting Contract Options
1. **Sablier** - Streaming payments
2. **OpenZeppelin Vesting** - Standard implementation
3. **Custom Contract** - Tailored to RepairCoin needs

## 🚨 Security Best Practices

### Wallet Management
1. **Never share private keys**
2. **Use hardware wallets for signing**
3. **Regular security audits**
4. **Implement time delays for large transfers**
5. **Set up monitoring and alerts**

### Operational Security
1. **Separate hot/cold wallets**
2. **Limit daily withdrawal amounts**
3. **Regular balance reconciliation**
4. **Incident response plan**
5. **Insurance consideration**

### Access Control
1. **Role-based permissions**
2. **Regular access reviews**
3. **Revoke compromised signers immediately**
4. **Document all access changes**
5. **Backup signer protocols**

## 📅 Timeline for Production

### Before Pilot Launch
- Multi-sig wallets MUST be created
- Initial token distribution completed
- All signers onboarded and tested

### Before Public Launch
- Full security audit completed
- All procedures documented
- Emergency protocols tested
- Insurance/coverage evaluated

### Post-Launch
- Monthly security reviews
- Quarterly signer verification
- Annual security audit
- Continuous monitoring

## 📞 Emergency Contacts

### Primary Contacts
- Miguel Rodriguez: [Contact Info]
- Zeff (Lead Dev): [Contact Info]
- Security Lead: [Contact Info]

### Emergency Procedures
1. Detect security issue
2. Pause contract if necessary
3. Contact all signers
4. Execute emergency response
5. Post-incident review

## ⚡ Quick Reference

### Current Testing Wallet
```
Address: 0x761E5E59485ec6feb263320f5d636042bD9EBc8c
Status: TESTING ONLY - DO NOT USE IN PRODUCTION
Contents: 1,000,000,000 RCN (to be distributed)
```

### Future Production Wallets
```
Customer Rewards Wallet: [TO BE CREATED]
Type: 2-of-3 Multi-sig
Amount: 400,000,000 RCN

Business Operations Wallet: [TO BE CREATED]
Type: 3-of-5 Multi-sig
Amount: 200,000,000 RCN

Team & Investor Wallet: [TO BE CREATED]
Type: Vesting Contract
Amount: 400,000,000 RCN
```

---

**⚠️ REMINDER: This is a critical security requirement. Do not launch to production without proper wallet distribution and multi-sig setup.**

Last Updated: July 29, 2025
Next Review: Before pilot launch
Document Version: 1.0