import { HowItWorksItem } from "../types";

export const HOW_IT_WORKS_ITEMS: HowItWorksItem[] = [
  {
    icon: "person-search",
    title: "Find Customer",
    desc: "Enter customer's wallet address to check their balance",
  },
  {
    icon: "payments",
    title: "Enter Amount",
    desc: "Specify the RCN amount customer wants to redeem",
  },
  {
    icon: "security",
    title: "Customer Approves",
    desc: "Customer receives notification and must approve the request",
  },
  {
    icon: "check-circle",
    title: "Complete Redemption",
    desc: "RCN tokens are deducted and converted to store credit",
  },
];
