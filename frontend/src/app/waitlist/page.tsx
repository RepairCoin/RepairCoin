import { campaignConfig } from "./[source]/config";
import WaitlistTemplate from "@/components/waitlist/WaitlistTemplate";

export default function WaitlistPage() {
  return <WaitlistTemplate config={campaignConfig.direct} />;
}
