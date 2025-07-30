import Hero from "@/containers/about-page/Hero";
import SecondSection from "@/containers/about-page/SecondSection";
import ThirdSection from "@/containers/about-page/ThirdSection";
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
