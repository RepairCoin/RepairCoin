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
    source: 'direct',
    headline: 'Blockchain Loyalty Built for Modern Service Businesses',
    subtext:
      'Be part of the first wave of shops using blockchain rewards to drive repeat customers, smarter growth and long-term loyalty.',
    ctaText: 'Join Waitlist',
    demoCtaText: 'Get Free Demo',
    metaTitle: 'Join the RepairCoin Waitlist',
    metaDescription:
      'Be part of the first wave of shops using blockchain rewards to drive repeat customers, smarter growth and long-term loyalty.',
  },
  organic: {
    source: 'organic',
    headline: 'Turn Every Repair Into Rewards',
    subtext:
      'RepairCoin is building the first blockchain-powered loyalty network for local repair shops. Earn tokens at any partner shop, redeem them anywhere in the network.',
    ctaText: 'Join the Waitlist',
    demoCtaText: 'Get a Free Demo',
    metaTitle: 'Join RepairCoin - The Future of Repair Shop Loyalty',
    metaDescription:
      'Be the first to join RepairCoin, the blockchain loyalty network connecting repair shops and customers. Earn and redeem tokens across the network.',
  },
  fb: {
    source: 'fb',
    headline: 'Your Repair Shop Deserves Better Loyalty',
    subtext:
      'Stop losing customers to competitors. RepairCoin helps repair shops retain customers with blockchain-powered rewards that work across a growing network of partner shops.',
    ctaText: 'Claim Your Spot',
    demoCtaText: 'See It In Action',
    metaTitle: 'RepairCoin - Smart Loyalty for Repair Shops',
    metaDescription:
      'Join 50+ repair shops already on the waitlist. RepairCoin gives your customers rewards they can earn and spend across every partner shop in the network.',
  },
};

export const validSources = Object.keys(campaignConfig);
