"use client";

import { notFound, useParams } from "next/navigation";
import { campaignConfig } from "../../[source]/config";
import ThankYouTemplate from "@/components/waitlist/ThankYouTemplate";

export default function CampaignThankYouPage() {
  const params = useParams<{ source: string }>();
  const source = params.source;

  if (!campaignConfig[source]) {
    notFound();
  }

  return <ThankYouTemplate source={source} />;
}
