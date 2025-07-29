import RewardYourCustomer from "@/containers/pricing-page/RewardYourCustomer";
import LoyaltyTier from "@/containers/pricing-page/LoyaltyTier";

export default function PricingPage() {
  return (
    <main>
      <RewardYourCustomer techBgImage="/tech-bg.png" />
      <LoyaltyTier techBgImage="/tech-bg.png" />
    </main>
  );
}
