# Actual Image Mapping - Landing Page V2

This document maps the actual images/GIFs in `frontend/public/img/landing/` to their usage in components.

## Images Successfully Mapped

### Hero Section (`HeroSection.tsx`)
- **hero-person.gif** ✅ - Main animated hero image

### What is RepairCoin (`WhatIsRepairCoin.tsx`)
- **repaircoin-icon.png** ✅ - RepairCoin logo/icon

### How It Works Cards (`HowItWorks.tsx`)
- **howitworks-card-1.gif** ✅ - "Repair or Refer" card
- **howitworks-card-2.gif** ✅ - "Track & Approve" card
- **howitworks-card-3.gif** ✅ - "Redeem Anywhere" card

### Share Rewards (`ShareRewards.tsx`)
- **sharereward-card.gif** ✅ - Share rewards illustration

### Loyalty Tiers (`LoyaltyTiers.tsx`)
- **Using emoji fallbacks** (🥉 🥈 🥇) - No tier images provided

### Find & Redeem (`FindAndRedeem.tsx`)
- **partnerShopCard.gif** ✅ - Partner shop finder illustration

### Redemption Control (`RedemptionControl.tsx`)
- **controlRedepmtionCard1.gif** ✅ - "Shop Sends Request" step
- **controlRedepmtionCard2.gif** ✅ - "Review the Details" step
- **controlRedepmtionCard3.gif** ✅ - "Approve Securely" step
- **controlRedepmtionCard4.gif** ✅ - "Redemption Complete" step

### Shop Tiers (`ShopTiers.tsx`)
- **buildForGrowthCard1.gif** ✅ - Standard Partner
- **buildForGrowthCard2.gif** ✅ - Premium Partner
- **buildForGrowthCard3.gif** ✅ - Elite Partner

### Use Rewards Anywhere (`UseRewardsAnywhere.tsx`)
- **userewardsanywherecard1.gif** ✅ - Customer rewards illustration
- **userewardsanywherecard2.gif** ✅ - Shop rewards illustration

### Wallet Control (`WalletControl.tsx`)
- **yourwalleryoucontrolcard.gif** ✅ - Wallet control interface

## Unused Images

These images exist but are not currently used:
- **landing-hero.png** - Alternative static hero image

## Notes

- Most images are **animated GIFs** which will add visual interest to the landing page
- All image components have **fallback logic** that reverts to existing images if the landing images fail to load
- The **LoyaltyTiers** section uses emoji icons (🥉 🥈 🥇) instead of images
- Total file size: ~96MB (mostly from large GIFs)

## Performance Considerations

The landing page now uses multiple large GIF files. Consider:
1. **Lazy loading** for below-the-fold GIFs
2. **Optimizing GIF file sizes** if page load is slow
3. Converting some GIFs to **video formats** (MP4/WebM) for better compression
4. Using **Next.js Image component** for automatic optimization where possible
