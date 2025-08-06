import RewardYourCustomer from "@/components/rewards/RewardYourCustomer";
import LoyaltyTier from "@/components/rewards/LoyaltyTier";
import CommunityBanner from "@/components/CommunityBanner";

export default function RewardsPage() {
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
