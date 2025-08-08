'use client';

import HowAndWhy from "@/components/landing/HowAndWhy";
import FindARepairCoin from "@/components/landing/FindARepairCoin";
import SuccessStories from "@/components/landing/SuccessStories";
import LatestNews from "@/components/landing/LatestNews";
import CommunityBanner from "@/components/CommunityBanner";
import WalletAwareHero from "@/components/landing/WalletAwareHero";

export default function LandingPage() {
  return (
    <main>
      <WalletAwareHero
        backgroundImage="/img/hero-bg.png"  
        techBgImage="/img/tech-bg.png"
        hero1BgImage="/img/hero1-bg.png"  
      />
      <HowAndWhy 
        techBgImage="/img/tech-bg.png"
      />
      <FindARepairCoin 
        chainBgImage="/img/chain.png"
      />
      <SuccessStories 
        successStoriesBgImage="/img/success-stories-bg.png"
      />
      {/* <LatestNews 
        latestNewsBgImage="/img/success-stories-bg.png"
      /> */}
      <CommunityBanner 
        communityBannerBgImage="/img/community-chain.png"
        bannerChainImage="/img/banner-chain.png"
      />
    </main>
  );
}