import Hero from "@/components/hero";
import HowAndWhy from "@/containers/landing-page/HowAndWhy";
import FindARepairCoin from "@/containers/landing-page/FindARepairCoin";
import SuccessStories from "@/containers/landing-page/SuccessStories";

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
    </main>
  );
}
