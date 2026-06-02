# RCG Staking

## Overview

RCG Staking allows both shop owners and customers to lock their RCG (governance tokens) to earn rewards and gain tier benefits. Staking is done directly on-chain via the Thirdweb SDK on Base Sepolia.

## Status

| Platform | Status |
|----------|--------|
| Frontend (Next.js) | Fully implemented (shop + customer) |
| Backend API | Partial (RCG balance queries) |
| Mobile (React Native) | Not implemented |

## RCG Token

- Contract: `0xdaFCC0552d976339cA28EF2e84ca1c6561379c9D` (Base Sepolia)
- Fixed supply: 100 million RCG
- Purpose: Governance and shop tier qualification

## Shop Tiers (based on RCG holdings)

| Tier | Minimum RCG | Benefits |
|------|-------------|---------|
| Standard | 10,000 RCG | Base pricing on RCN purchases |
| Premium | 50,000 RCG | Discounted RCN pricing |
| Elite | 200,000 RCG | Best RCN pricing |

## Staking Rewards

- 10% of platform revenue goes to RCG stakers
- 10% goes to the DAO treasury
- Rewards distributed proportionally to staked amount

## Staking Actions

- **Stake RCG** — lock RCG tokens into the staking contract
- **Unstake RCG** — unlock staked tokens (may have a cooldown period)
- **Claim rewards** — collect earned staking rewards
- View staking position: staked amount, earned rewards, APY, lock period

## Frontend Location

- Shop staking: `frontend/src/components/shop/tabs/StakingTab.tsx`
- Customer staking: `frontend/src/components/customer/StakingTab.tsx` (same file referenced from customer dashboard)
- Contract config: `frontend/src/config/contracts.ts`
- Thirdweb client: `frontend/src/utils/thirdweb.ts`

## Backend Location

- RCG balance queries handled in `TokenDomain`
- Contract address: `RCG_CONTRACT_ADDRESS` in backend config

## Related Docs

- [RCG.md](RCG.md) — full RCG token specification
- [RCG_STAKING_ECONOMIC_MODEL.md](../RCG_STAKING_ECONOMIC_MODEL.md)
- [REALISTIC_STAKING_SCENARIOS.md](../REALISTIC_STAKING_SCENARIOS.md)
