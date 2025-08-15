"use client";

import RewardYourCustomer from "@/components/rewards/RewardYourCustomer";
import CommunityBanner from "@/components/CommunityBanner";
import { useState } from "react";

export default function RewardsPage() {
  const [activeTab, setActiveTab] = useState<"shop" | "customer">("shop");

  return (
    <main>  
      <RewardYourCustomer techBgImage="/img/tech-bg.png" activeTab={activeTab} setActiveTab={setActiveTab} />
      <CommunityBanner 
        communityBannerBgImage="/img/community-chain.png"
        bannerChainImage="/img/rewards-banner-1.png"
        activeTab={activeTab}
      />
    </main>
  );
}
