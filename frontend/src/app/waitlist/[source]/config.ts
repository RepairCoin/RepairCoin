export interface CampaignConfig {
  source: string;
  headline: string;
  subtext: string;
  ctaText: string;
  demoCtaText: string;
  metaTitle: string;
  metaDescription: string;
}

export const campaignConfig: Record<string, CampaignConfig> = {
  direct: {
    source: "direct",
    headline: "Get Discovered. Get Booked. Keep Customers Coming Back.",
    subtext:
      "RepairCoin helps service businesses grow with a built-in marketplace, booking system, and rewards that turn first-time visitors into repeat customers.",
    ctaText: "Join Waitlist",
    demoCtaText: "Get Free Demo",
    metaTitle: "Join the RepairCoin Waitlist",
    metaDescription:
      "Be part of the first wave of shops using blockchain rewards to drive repeat customers, smarter growth and long-term loyalty.",
  },
  organic: {
    source: "organic",
    headline: "Get Discovered. Get Booked. Keep Customers Coming Back.",
    subtext:
      "RepairCoin helps service businesses grow with a built-in marketplace, booking system, and rewards that turn first-time visitors into repeat customers.",
    ctaText: "Join Waitlist",
    demoCtaText: "Get Free Demo",
    metaTitle: "Join the RepairCoin Waitlist",
    metaDescription:
      "Be part of the first wave of shops using blockchain rewards to drive repeat customers, smarter growth and long-term loyalty.",
  },
  fb: {
    source: "fb",
    headline: "Get Discovered. Get Booked. Keep Customers Coming Back.",
    subtext:
      "RepairCoin helps service businesses grow with a built-in marketplace, booking system, and rewards that turn first-time visitors into repeat customers.",
    ctaText: "Join Waitlist",
    demoCtaText: "Get Free Demo",
    metaTitle: "Join the RepairCoin Waitlist",
    metaDescription:
      "Be part of the first wave of shops using blockchain rewards to drive repeat customers, smarter growth and long-term loyalty.",
  },
};

export const validSources = Object.keys(campaignConfig);
