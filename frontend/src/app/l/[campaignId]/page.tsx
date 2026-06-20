// PUBLIC ad landing page — /l/[campaignId]. Lives OUTSIDE the (authenticated) group so it's
// reachable with no login (it's the ad's click target). Shows the shop + promoted services +
// offer and captures the lead via AdLeadForm → the public webform endpoint.

import { LandingView } from "@/components/ads/LandingView";

export const metadata = { title: "Get a quote" };

export default async function CampaignLandingPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  return <LandingView campaignId={campaignId} />;
}
