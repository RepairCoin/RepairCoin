import { useAuthStore } from "@/store/auth.store";
import { useCustomer } from "@/shared/hooks/customer/useCustomer";
import { Tier } from "@/utilities/GlobalTypes";
import { TIER_CONFIG, TIER_ORDER } from "../../constants";
import { TierProgress } from "../../types";

export function useTierInfo() {
  const { account } = useAuthStore();
  const { useGetCustomerByWalletAddress } = useCustomer();

  const {
    data: customerData,
    isLoading,
    error,
    refetch,
  } = useGetCustomerByWalletAddress(account?.address);

  const currentTier = (customerData?.customer?.tier as Tier) || "BRONZE";
  const lifetimeEarnings = customerData?.customer?.lifetimeEarnings || 0;

  const currentTierIndex = TIER_ORDER.indexOf(currentTier);
  const nextTier = currentTierIndex < TIER_ORDER.length - 1 ? TIER_ORDER[currentTierIndex + 1] : null;
  const nextTierConfig = nextTier ? TIER_CONFIG[nextTier] : null;
  const progressToNextTier = nextTierConfig
    ? Math.min((lifetimeEarnings / nextTierConfig.requirement) * 100, 100)
    : 100;
  const rcnToNextTier = nextTierConfig
    ? Math.max(nextTierConfig.requirement - lifetimeEarnings, 0)
    : 0;

  const tierProgress: TierProgress = {
    currentTier,
    lifetimeEarnings,
    nextTier,
    nextTierConfig,
    progressToNextTier,
    rcnToNextTier,
  };

  const getCurrentTierConfig = () => TIER_CONFIG[currentTier];

  const isTierUnlocked = (tier: Tier) => {
    const tierIndex = TIER_ORDER.indexOf(tier);
    return tierIndex <= currentTierIndex;
  };

  return {
    tierProgress,
    isLoading,
    error,
    refetch,
    getCurrentTierConfig,
    isTierUnlocked,
    TIER_CONFIG,
    TIER_ORDER,
  };
}
