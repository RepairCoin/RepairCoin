import Hero from "@/components/hero";
import HowAndWhy from "@/containers/landing-page/HowAndWhy";

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
    </main>
  );
}
