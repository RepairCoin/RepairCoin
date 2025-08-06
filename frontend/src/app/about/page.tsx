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
        communityBannerBgImage="/img/community-chain.png"
        bannerChainImage="/img/banner-chain.png"
      />
    </main>
  );
}
