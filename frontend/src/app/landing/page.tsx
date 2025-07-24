import Hero from "@/components/Hero";
import HowAndWhy from "@/app/landing/HowAndWhy";
import FindARepairCoin from "@/app/landing/FindARepairCoin";
import SuccessStories from "@/app/landing/SuccessStories";
import LatestNews from "@/app/landing/LatestNews";
import CommunityBanner from "@/app/landing/CommunityBanner";
import Footer from "@/components/Footer";

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
      <Footer />
    </main>
  );
}
