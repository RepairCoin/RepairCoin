import Hero from "@/components/about/Hero";
import SecondSection from "@/components/about/SecondSection";
import ThirdSection from "@/components/about/ThirdSection";
import CommunityBanner from "@/components/CommunityBanner";

export default function About() {
  return (
    <main>
      <Hero />
      <SecondSection />
      <ThirdSection />
      <CommunityBanner 
        communityBannerBgImage="/community-chain.png"
        bannerChainImage="/banner-chain.png"
      />
    </main>
  );
}
