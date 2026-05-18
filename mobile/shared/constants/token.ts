import { CustomerTierUpper } from "@/feature/customer/profile/services/customer.interface";
import {
  HowItWorksItem,
  RepairOption,
  StatusFilter,
  TransactionFilter,
  DateFilter,
} from "@/feature/token/types";

export const TIER_STYLES: Record<CustomerTierUpper, string> = {
  GOLD: "bg-gradient-to-r from-yellow-500 to-yellow-600",
  SILVER: "bg-gradient-to-r from-gray-400 to-gray-500",
  BRONZE: "bg-gradient-to-r from-orange-500 to-orange-600",
};

export const QUICK_AMOUNTS = [10, 25, 50, 100] as const;
export const BUY_QUICK_AMOUNTS = [10, 50, 100, 500, 1000, 5000];

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

export const REPAIR_OPTIONS: RepairOption[] = [
  {
    type: "minor",
    label: "XS Repair",
    rcn: 5,
    description: "$30 - $50 repair value",
  },
  {
    type: "small",
    label: "Small Repair",
    rcn: 10,
    description: "$50 - $99 repair value",
  },
  {
    type: "large",
    label: "Large Repair",
    rcn: 15,
    description: "$100+ repair value",
  },
];

export const REWARD_HOW_IT_WORKS_ITEMS: HowItWorksItem[] = [
  {
    icon: "person-search",
    title: "Find Customer",
    desc: "Enter customer's wallet address to check their tier",
  },
  {
    icon: "build",
    title: "Select Repair",
    desc: "Choose repair type or enter custom amount and RCN",
  },
  {
    icon: "star",
    title: "Tier Bonuses",
    desc: "Silver +2 RCN, Gold +5 RCN automatically added",
  },
  {
    icon: "local-offer",
    title: "Apply Promo",
    desc: "Optional promo codes for additional bonuses",
  },
  {
    icon: "send",
    title: "Instant Transfer",
    desc: "RCN tokens transferred directly to customer's wallet",
  },
];

export const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "completed", label: "Completed" },
  { id: "failed", label: "Failed" },
];

export interface HowToRedeemStep {
  icon: string;
  title: string;
  desc: string;
}

export const HOW_TO_REDEEM_STEPS: HowToRedeemStep[] = [
  {
    icon: "storefront-outline",
    title: "Visit a Partner Shop",
    desc: "Go to any FixFlow partner shop near you",
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

export const TRANSACTION_FILTERS: { id: TransactionFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "earned", label: "Earned" },
  { id: "redeemed", label: "Redeemed" },
  { id: "gifts", label: "Gifts" },
];

export const WALLET_ADDRESS_LENGTH = 42;
export const WALLET_ADDRESS_PREFIX = "0x";
export const MESSAGE_MAX_LENGTH = 100;

export const DATE_FILTERS: { id: DateFilter; label: string }[] = [
  { id: "all", label: "All Time" },
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
];
