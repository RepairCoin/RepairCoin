import RewardYourCustomer from "@/components/pricing/RewardYourCustomer";
import LoyaltyTier from "@/components/pricing/LoyaltyTier";
import CommunityBanner from "@/components/CommunityBanner";

export default function PricingPage() {
  return (
    <main>  
      <RewardYourCustomer techBgImage="/img/tech-bg.png" />
      <LoyaltyTier techBgImage="/img/tech-bg.png" />
      <CommunityBanner 
        communityBannerBgImage="/img/community-chain.png"
        bannerChainImage="/img/banner-chain.png"
      />
    </main>
  );
}
