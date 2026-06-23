"use client";

import React from "react";
import { LazyMotion, domAnimation } from "framer-motion";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PricingHero from "@/components/landing-v4/PricingHero";
import PricingAddons from "@/components/landing-v4/PricingAddons";

export default function PricingPage() {
  return (
    <LazyMotion features={domAnimation}>
      <main className="bg-[#0a0a0a] min-h-screen flex flex-col">
        <Header />
        <PricingHero />
        <PricingAddons />
        <Footer />
      </main>
    </LazyMotion>
  );
}
