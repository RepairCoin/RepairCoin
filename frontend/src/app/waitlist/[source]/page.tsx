import { notFound } from "next/navigation";
import { campaignConfig, validSources } from "./config";
import WaitlistTemplate from "@/components/waitlist/WaitlistTemplate";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ source: string }>;
}

export async function generateStaticParams() {
  return validSources.map((source) => ({ source }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { source } = await params;
  const config = campaignConfig[source];
  if (!config) return {};

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.repaircoin.ai';

  return {
    title: config.metaTitle,
    description: config.metaDescription,
    openGraph: {
      title: config.metaTitle,
      description: config.metaDescription,
      url: `${appUrl}/waitlist/${source}`,
      siteName: 'RepairCoin',
      images: [
        {
          url: `${appUrl}/og-image.png`,
          width: 1200,
          height: 630,
          alt: 'RepairCoin - Smart Loyalty for Service Businesses',
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: config.metaTitle,
      description: config.metaDescription,
      images: [`${appUrl}/og-image.png`],
    },
  };
}

export default async function CampaignWaitlistPage({ params }: PageProps) {
  const { source } = await params;
  const config = campaignConfig[source];

  if (!config) {
    notFound();
  }

  return <WaitlistTemplate config={config} />;
}
