import Hero from "@/components/hero";
import HowAndWhy from "./HowAndWhy";
import FindARepairCoin from "./FindARepairCoin";
import SuccessStories from "./SuccessStories";
import LatestNews from "./LatestNews";
import CommunityBanner from "./CommunityBanner";
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
