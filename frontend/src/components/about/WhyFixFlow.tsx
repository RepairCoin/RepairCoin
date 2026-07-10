"use client";

import { Lightbulb } from "lucide-react";
import AboutStorySection from "./AboutStorySection";

export default function WhyFixFlow() {
  return (
    <AboutStorySection
      badge="Why We Built FixFlow"
      badgeIcon={<Lightbulb className="w-5 h-5" />}
      title="Running a Business Shouldn't Require 10 Different Tools"
      paragraphs={[
        "From customer management and bookings to marketing, loyalty, and business insights, many business owners rely on disconnected systems that create unnecessary complexity.",
        "FixFlow AI was built to bring everything together into one intelligent platform.",
      ]}
      image="/img/about/why-fixflow.png"
      imageAlt="Business owner overwhelmed by tools versus working calmly on one platform"
    />
  );
}
