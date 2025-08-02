'use client';

import HowAndWhy from "@/components/landing/HowAndWhy";
import FindARepairCoin from "@/components/landing/FindARepairCoin";
import SuccessStories from "@/components/landing/SuccessStories";
import LatestNews from "@/components/landing/LatestNews";
import CommunityBanner from "@/components/CommunityBanner";
import Hero from "@/components/Hero";

export default function LandingPage() {
  return (
    <main>
      <Hero
        backgroundImage="/hero-bg.png"  
        techBgImage="/tech-bg.png"
        hero1BgImage="/hero1-bg.png"  
      />
      <HowAndWhy 
        techBgImage="/tech-bg.png"
      />
      <FindARepairCoin 
        chainBgImage="/chain.png"
      />
      <SuccessStories 
        successStoriesBgImage="/success-stories-bg.png"
      />
      <LatestNews 
        latestNewsBgImage="/success-stories-bg.png"
      />
      <CommunityBanner 
        communityBannerBgImage="/community-chain.png"
        bannerChainImage="/banner-chain.png"
      />
    </main>
  );
}