export interface HowToRedeemStep {
  icon: string;
  title: string;
  desc: string;
}

export const HOW_TO_REDEEM_STEPS: HowToRedeemStep[] = [
  {
    icon: "storefront-outline",
    title: "Visit a Partner Shop",
    desc: "Go to any RepairCoin partner shop near you",
  },
  {
    icon: "qr-code-outline",
    title: "Show Your QR Code",
    desc: "Let the shop scan your wallet QR code",
  },
  {
    icon: "checkmark-circle-outline",
    title: "Approve the Request",
    desc: "You'll receive a notification to approve the redemption",
  },
  {
    icon: "cash-outline",
    title: "Get Your Discount",
    desc: "Your RCN will be converted to store credit instantly",
  },
];
