"use client";

import dynamic from "next/dynamic";
import { LazyMotion, domAnimation } from "framer-motion";
import ScrollProgress from "@/components/motion/ScrollProgress";

// Critical above-the-fold - imported directly
import AboutHero from "@/components/about/AboutHero";

// Below-the-fold - lazy loaded with dynamic imports
const TheOrigin = dynamic(() => import("@/components/about/TheOrigin"), { ssr: true });
const OurApproach = dynamic(() => import("@/components/about/OurApproach"), { ssr: true });
const AboutHowItWorks = dynamic(() => import("@/components/about/AboutHowItWorks"), { ssr: true });
const Trust = dynamic(() => import("@/components/about/Trust"), { ssr: true });
const WhereWeAreGoing = dynamic(() => import("@/components/about/WhereWeAreGoing"), { ssr: true });
const AboutCTA = dynamic(() => import("@/components/about/AboutCTA"), { ssr: true });

export default function About() {
  return (
    <LazyMotion features={domAnimation}>
      <div className="min-h-screen bg-[#0D0D0D] text-white">
        <ScrollProgress />
        <AboutHero />
        <TheOrigin />
        <OurApproach />
        <AboutHowItWorks />
        <Trust />
        <WhereWeAreGoing />
        <AboutCTA />
      </div>
    </LazyMotion>
  );
}
