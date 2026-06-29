"use client";

import { LayoutGrid } from "lucide-react";
import AboutStorySection from "./AboutStorySection";

export default function PlatformOverview() {
  return (
    <AboutStorySection
      badge="Platform Overview"
      badgeIcon={<LayoutGrid className="w-5 h-5" />}
      title={
        <>
          Everything Your Business Needs.
          <br />
          One Platform.
        </>
      }
      paragraphs={[
        "From AI-powered assistance and customer engagement to rewards, automation, and business insights,",
        "FixFlow AI brings every part of your business together.",
      ]}
      image="/img/about/platform-overview.png"
      imageAlt="FixFlow AI platform dashboards connected into one system"
      imageAspect="aspect-[16/10]"
    />
  );
}
