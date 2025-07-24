import Hero from "@/components/Hero";
<<<<<<< HEAD
import HowAndWhy from "@/app/landing/HowAndWhy";
import FindARepairCoin from "@/app/landing/FindARepairCoin";
import SuccessStories from "@/app/landing/SuccessStories";
import LatestNews from "@/app/landing/LatestNews";
import CommunityBanner from "@/app/landing/CommunityBanner";
=======
import HowAndWhy from "@/containers/landing-page/HowAndWhy";
import FindARepairCoin from "@/containers/landing-page/FindARepairCoin";
import SuccessStories from "@/containers/landing-page/SuccessStories";
import LatestNews from "@/containers/landing-page/LatestNews";
import CommunityBanner from "@/containers/landing-page/CommunityBanner";
>>>>>>> 4cb37fd (talwind v3 revert)
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
