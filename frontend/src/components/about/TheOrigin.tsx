"use client";

import { Store } from "lucide-react";
import AboutStorySection from "./AboutStorySection";

export default function TheOrigin() {
  return (
    <AboutStorySection
      badge="Founder Story"
      badgeIcon={<Store className="w-5 h-5" />}
      title="Built on 15+ Years of Real Business Experience"
      paragraphs={[
        "After more than 15 years of running a boxing gym, salon, and gadget repair business, one thing became clear: business owners needed smarter tools to manage customers, simplify operations, and grow.",
        "That real-world experience became the foundation of FixFlow AI—a platform built to help businesses save time, strengthen customer relationships, and grow with confidence.",
      ]}
      image="/img/about/founder-story.png"
      imageAlt="Service entrepreneur helping a customer at the counter"
    />
  );
}
