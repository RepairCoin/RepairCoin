import Hero from "@/components/hero";
import HowRepairCoinWorks from "./containers/HowRepairCoinWorks";

export default function LandingPage() {
  return (
    <main>
      <Hero
        backgroundImage="/hero-bg.png"  
        techBgImage="/tech-bg.png"
        hero1BgImage="/hero1-bg.png"  
      />
      {/* How repair coin works */}
      <HowRepairCoinWorks 
        techBgImage="/tech-bg.png"
      />
    </main>
  );
}
