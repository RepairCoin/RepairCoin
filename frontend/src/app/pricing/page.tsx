import RewardYourCustomer from "@/containers/pricing-page/RewardYourCustomer";
import LoyaltyTier from "@/containers/pricing-page/LoyaltyTier";
import CommunityBanner from "@/containers/landing-page/CommunityBanner";

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
