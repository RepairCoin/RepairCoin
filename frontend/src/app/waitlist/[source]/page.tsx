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

  return {
    title: config.metaTitle,
    description: config.metaDescription,
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
