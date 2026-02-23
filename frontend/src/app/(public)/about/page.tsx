import AboutHero from "@/components/about/AboutHero";
import TheOrigin from "@/components/about/TheOrigin";
import OurApproach from "@/components/about/OurApproach";
import AboutHowItWorks from "@/components/about/AboutHowItWorks";
import Trust from "@/components/about/Trust";
import WhereWeAreGoing from "@/components/about/WhereWeAreGoing";
import AboutCTA from "@/components/about/AboutCTA";

export default function About() {
  return (
    <main>
      <AboutHero />
      <TheOrigin />
      <OurApproach />
      <AboutHowItWorks />
      <Trust />
      <WhereWeAreGoing />
      <AboutCTA />
    </main>
  );
}
