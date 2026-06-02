# Tier Bonuses

## Overview

The Tier Bonuses feature gives shop owners visibility into how many bonus RCN tokens they have issued to customers based on their tier (Bronze / Silver / Gold). It helps shops understand the cost and impact of the tier bonus system.

## Status

| Platform | Status |
|----------|--------|
| Frontend (Next.js) | Fully implemented |
| Backend API | Implemented (part of shop analytics) |
| Mobile (React Native) | Not implemented |

## Customer Tiers

Customers earn tier status based on total RCN earned:

| Tier | Bonus per Repair |
|------|-----------------|
| Bronze | 0 RCN (base, no bonus) |
| Silver | +2 RCN per repair |
| Gold | +5 RCN per repair |

## Metrics Shown

- **Total Bonuses Issued** — lifetime count of tier bonus transactions
- **Total RCN in Bonuses** — sum of all extra RCN given out as tier bonuses
- **Average Bonus per Transaction** — mean bonus amount per qualifying repair
- **Bonuses Available** — estimated how many more bonuses the shop can issue based on current RCN balance

### Tier Distribution Section
- Breakdown of shop's customers by tier (Bronze / Silver / Gold counts)
- Visual bar showing tier proportions

### Bonus Projections
- If the shop has X RCN remaining, how many more Silver-tier or Gold-tier bonuses can be issued

## Frontend Location

- Tab: `frontend/src/components/shop/tabs/BonusesTab.tsx`
- Utility functions: `frontend/src/utils/tierCalculations.ts`

## Notes

- This is a read-only analytics/informational tab
- Bonuses are issued automatically when shop rewards a customer via Issue Rewards
- No actions to take — purely informational dashboard
