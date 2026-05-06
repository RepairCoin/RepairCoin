import { SortBy, TierFilter } from "../types";

export const TIER_OPTIONS: { value: TierFilter; label: string }[] = [
  { value: "all", label: "All Tiers" },
  { value: "bronze", label: "Bronze" },
  { value: "silver", label: "Silver" },
  { value: "gold", label: "Gold" },
];

export const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "recent", label: "Most Recent" },
  { value: "earnings", label: "Highest Earnings" },
  { value: "active", label: "Most Active" },
];
