'use client';

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import HowAndWhy from "@/containers/landing-page/HowAndWhy";
import FindARepairCoin from "@/containers/landing-page/FindARepairCoin";
import SuccessStories from "@/containers/landing-page/SuccessStories";
import LatestNews from "@/containers/landing-page/LatestNews";
import CommunityBanner from "@/components/CommunityBanner";
import Hero from "@/components/Hero";
import { useAuth } from "@/hooks/useAuth";

export default function LandingPage() {
  const { isAuthenticated, userType } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated && userType) {
      switch (userType) {
        case "admin":
          router.push("/admin");
          break;
        case "shop":
          router.push("/shop");
          break;
        case "customer":
          router.push("/customer");
          break;
        default:
          console.warn("Unknown user type:", userType);
      }
    }
  }, [isAuthenticated, userType]);

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