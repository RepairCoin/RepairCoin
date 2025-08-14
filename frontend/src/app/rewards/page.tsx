import RewardYourCustomer from "@/components/rewards/RewardYourCustomer";
import CommunityBanner from "@/components/CommunityBanner";

export default function RewardsPage() {
  return (
    <main>  
      <RewardYourCustomer techBgImage="/img/tech-bg.png" />
      <CommunityBanner 
        communityBannerBgImage="/img/community-chain.png"
        bannerChainImage="/img/banner-chain.png"
      />
    </main>
  );
}
