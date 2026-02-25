/**
 * Shared constants for the Groups feature
 */

/**
 * Popular emoji icons for shop groups
 */
export const POPULAR_ICONS = [
  "🏪", "🔧", "🚗", "🏍️", "🚲", "⚙️", "🛠️", "🔩",
  "💎", "⭐", "🌟", "✨", "🎯", "🎨", "🏆", "👥",
  "🤝", "💼", "🏢", "🏭", "🌍", "🌎", "🌏", "🔰"
];

/**
 * Default items per page for pagination
 */
export const ITEMS_PER_PAGE = 10;

/**
 * Transaction pagination limit
 */
export const TRANSACTIONS_PER_PAGE = 20;

/**
 * Customers pagination limit
 */
export const CUSTOMERS_PER_PAGE = 20;

/**
 * Group sort options configuration
 */
export const GROUP_SORT_OPTIONS = [
  { value: "members" as const, label: "Members" },
  { value: "name" as const, label: "Name" },
  { value: "recent" as const, label: "Recent" },
];

/**
 * Transaction filter options configuration
 */
export const TRANSACTION_FILTER_OPTIONS = [
  { value: "all" as const, label: "All", color: "bg-[#FFCC00]" },
  { value: "earn" as const, label: "Issued", color: "bg-green-600" },
  { value: "redeem" as const, label: "Redeemed", color: "bg-orange-600" },
];

/**
 * Member filter options configuration
 */
export const MEMBER_FILTER_OPTIONS = [
  { value: "active" as const, label: "Active" },
  { value: "pending" as const, label: "Pending" },
];

/**
 * Member activity sort options configuration
 */
export const MEMBER_ACTIVITY_SORT_OPTIONS = [
  { value: "issued" as const, label: "Issued" },
  { value: "redeemed" as const, label: "Redeemed" },
  { value: "net" as const, label: "Net" },
  { value: "transactions" as const, label: "Activity" },
];

/**
 * Color constants used throughout the groups feature
 */
export const COLORS = {
  primary: "#FFCC00",
  primaryHover: "#FFD700",
  background: "#101010",
  cardBackground: "#1e1f22",
  cardBackgroundHover: "#2a2b2f",
  border: "gray-800",
  text: {
    primary: "white",
    secondary: "gray-400",
    muted: "gray-500",
  },
  status: {
    success: "green-500",
    warning: "orange-500",
    error: "red-500",
    info: "blue-500",
  },
};

/**
 * RCN to token ratio for backing calculations
 */
export const RCN_TOKEN_RATIO = 2; // 1 RCN backs 2 tokens
