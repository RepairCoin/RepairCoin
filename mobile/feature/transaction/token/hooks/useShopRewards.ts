import { useState } from "react";
import { useCustomerInfo, useShopPromoCodes } from "./useTokensQuery";
import { useIssueReward } from "./useTokensMutation";
import { useRepairCalculations } from "./useRepairCalculations";
import { usePromoCodeManager } from "./usePromoCodeManager";

export function useShopRewards() {
  const [customerAddress, setCustomerAddress] = useState("");

  const customerQuery = useCustomerInfo(customerAddress);
  const promoCodesQuery = useShopPromoCodes();
  const repairCalc = useRepairCalculations();

  const baseReward = repairCalc.calculateBaseReward();
  const tierBonus = repairCalc.getTierBonus(customerQuery.data?.tier);

  const promoManager = usePromoCodeManager(
    customerAddress,
    baseReward,
    tierBonus
  );

  const totalReward = baseReward + tierBonus + promoManager.promoBonus;

  const resetAllInputs = () => {
    setCustomerAddress("");
    repairCalc.setRepairType("small");
    repairCalc.setCustomAmount("");
    repairCalc.setCustomRcn("");
    promoManager.setPromoCode("");
    promoManager.setShowPromoDropdown(false);
  };

  const issueRewardMutation = useIssueReward(resetAllInputs);

  return {
    customerAddress,
    setCustomerAddress,
    customerInfo: customerQuery.data,
    isLoadingCustomer: customerQuery.isLoading,
    customerError: customerQuery.error,

    ...repairCalc,
    baseReward,
    tierBonus,
    totalReward,

    availablePromoCodes: promoCodesQuery.data || [],
    isLoadingPromoCodes: promoCodesQuery.isLoading,
    ...promoManager,

    issueReward: issueRewardMutation.mutate,
    isIssuingReward: issueRewardMutation.isPending,
    rewardError: issueRewardMutation.error,
    resetAllInputs,
  };
}
