import RewardYourCustomer from "@/components/pricing/RewardYourCustomer";
import LoyaltyTier from "@/components/pricing/LoyaltyTier";
import CommunityBanner from "@/components/CommunityBanner";

export default function PricingPage() {
  return (
    <main>  
      <RewardYourCustomer techBgImage="/tech-bg.png" />
      <LoyaltyTier techBgImage="/tech-bg.png" />
      <CommunityBanner 
        communityBannerBgImage="/community-chain.png"
        bannerChainImage="/banner-chain.png"
      />
    </main>
  );
}
