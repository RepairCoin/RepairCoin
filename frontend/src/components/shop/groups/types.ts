/**
 * Shared types for the Groups feature
 */

import type { LucideIcon } from "lucide-react";

/**
 * Shop data returned from API for subscription checks
 */
export interface ShopData {
  shopId: string;
  subscriptionActive?: boolean;
  operational_status?: string;
  purchasedRcnBalance?: number;
  subscriptionCancelledAt?: string | null;
  subscriptionEndsAt?: string | null;
}

/**
 * Props for filter tabs component
 */
export interface FilterOption<T extends string = string> {
  value: T;
  label: string;
  count?: number;
  color?: string;
  activeColor?: string;
}

/**
 * Props for pagination component
 */
export interface PaginationState {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
}

/**
 * Props for empty state component
 */
export interface EmptyStateConfig {
  icon: LucideIcon;
  title: string;
  description?: string;
}

/**
 * Props for section header component
 */
export interface SectionHeaderConfig {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
}

/**
 * Modal size variants
 */
export type ModalSize = "sm" | "md" | "lg";

/**
 * Loading spinner size variants
 */
export type SpinnerSize = "sm" | "md" | "lg";

/**
 * Sort options for groups
 */
export type GroupSortOption = "members" | "name" | "recent";

/**
 * Filter options for transactions
 */
export type TransactionFilterType = "all" | "earn" | "redeem";

/**
 * Filter options for members
 */
export type MemberFilterType = "active" | "pending";

/**
 * Sort options for member activity
 */
export type MemberActivitySortType = "issued" | "redeemed" | "net" | "transactions";

/**
 * Tab options for group details
 */
export type GroupDetailsTab = "overview" | "members" | "customers" | "operations" | "transactions" | "analytics";
