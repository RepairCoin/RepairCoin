// Queries
export { useShopCustomersQuery, useCustomerProfileQuery } from "./queries";

// Mutations
export { useUpdateCustomerProfileMutation } from "./mutations";

// UI
export { useCustomerSearch } from "./ui";
export { useCustomerListUI } from "@/feature/shop/customers/hooks";

// Tier Info
export { useTierInfo } from "@/feature/customer/tier-info/hooks";

// Referral
export { useReferral } from "@/feature/customer/referral/hooks";

// Profile
export { useCustomerProfileScreen, useCustomerEditProfile } from "./ui";

// Core customer hook
export { useCustomer } from "./useCustomer";
