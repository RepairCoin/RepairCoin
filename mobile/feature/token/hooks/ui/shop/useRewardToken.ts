import { useState } from "react";
import { goBack } from "expo-router/build/global-state/routing";
import { useShopRewards, useShopBalance, RepairType } from "../../useShopRewards";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { useAppToast } from "@/shared/hooks";

export function useRewardToken() {
  const shopData = useAuthStore((state) => state.userProfile);
  const { showError } = useAppToast();
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const {
    customerAddress,
    setCustomerAddress,
    customerInfo,
    isLoadingCustomer,
    customerError,
    repairType,
    setRepairType,
    customAmount,
    setCustomAmount,
    customRcn,
    setCustomRcn,
    baseReward,
    tierBonus,
    totalReward,
    getRepairAmount,
    availablePromoCodes,
    promoCode,
    setPromoCode,
    promoBonus,
    promoError,
    showPromoDropdown,
    setShowPromoDropdown,
    isValidatingPromo,
    issueReward,
    isIssuingReward,
  } = useShopRewards();

  // Get shop's available RCN balance with real-time query
  const { data: realTimeBalance, refetch: refetchBalance } = useShopBalance();
  const availableBalance = realTimeBalance ?? shopData?.purchasedRcnBalance ?? 0;

  const isSelfReward = Boolean(
    shopData?.address &&
    customerAddress &&
    customerAddress.toLowerCase() === shopData.address.toLowerCase()
  );

  // Check if reward amount exceeds available balance
  const hasInsufficientBalance = totalReward > 0 && totalReward > availableBalance;

  const isCustomerNotFound = Boolean(
    !isLoadingCustomer &&
    customerAddress &&
    customerAddress.length === 42 &&
    !customerInfo &&
    !isSelfReward
  );

  const isIssueDisabled =
    isIssuingReward ||
    !customerAddress ||
    !customerInfo ||
    totalReward <= 0 ||
    hasInsufficientBalance ||
    (repairType === "custom" &&
      (!customAmount || !customRcn ||
        parseFloat(customAmount) <= 0 || parseFloat(customAmount) > 100000 ||
        parseFloat(customRcn) <= 0 || parseFloat(customRcn) > 10000));

  const handleIssueReward = () => {
    if (!customerAddress) {
      showError("Please enter a valid customer address");
      return;
    }

    if (isSelfReward) {
      showError("You cannot issue rewards to your own wallet address");
      return;
    }

    if (!customerInfo) {
      showError("Customer not found. Must be registered to receive rewards.");
      return;
    }

    if (repairType === "custom") {
      const amount = parseFloat(customAmount);
      if (!customAmount || isNaN(amount) || amount <= 0) {
        showError("Please enter a valid repair amount");
        return;
      }
      if (!customRcn || parseFloat(customRcn) <= 0) {
        showError("Please enter a valid RCN reward amount");
        return;
      }
    }

    // Show confirmation modal instead of directly issuing
    setShowConfirmation(true);
  };

  const handleConfirmIssue = () => {
    const request = {
      customerAddress,
      repairAmount: getRepairAmount(),
      skipTierBonus: false,
      promoCode: promoCode.trim() || undefined,
      ...(repairType === "custom" && {
        customBaseReward: parseFloat(customRcn),
      }),
    };

    issueReward(request, {
      onSettled: () => setShowConfirmation(false),
    });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetchBalance();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRepairTypeSelect = (type: RepairType) => {
    setRepairType(type);
    if (type !== "custom") {
      setCustomAmount("");
      setCustomRcn("");
    }
  };

  const handlePromoCodeChange = (text: string) => {
    const newValue = text.toUpperCase();
    setPromoCode(newValue);
    setShowPromoDropdown(true);
  };

  const handlePromoCodeSelect = (code: string) => {
    setPromoCode(code);
    setShowPromoDropdown(false);
  };

  const handlePromoCodeClear = () => {
    setPromoCode("");
  };

  const handleQRScan = (address: string) => {
    setCustomerAddress(address);
    setShowQRScanner(false);
  };

  const handleGoBack = () => {
    goBack();
  };

  const getButtonText = () => {
    if (!customerAddress) return "Enter Customer Address";
    if (!customerInfo) return "Customer Not Found";
    if (totalReward <= 0) return "Select Repair Type";
    if (hasInsufficientBalance) return "Insufficient Balance";
    return `Issue ${totalReward} RCN`;
  };

  return {
    // Shop data
    shopData,

    // Modal states
    showHowItWorks,
    setShowHowItWorks,
    showQRScanner,
    setShowQRScanner,

    // Refresh
    isRefreshing,
    handleRefresh,

    // Customer
    customerAddress,
    setCustomerAddress,
    customerInfo,
    isLoadingCustomer,
    customerError,
    isSelfReward,
    isCustomerNotFound,

    // Repair
    repairType,
    customAmount,
    setCustomAmount,
    customRcn,
    setCustomRcn,
    handleRepairTypeSelect,

    // Promo
    availablePromoCodes,
    promoCode,
    promoBonus,
    promoError,
    showPromoDropdown,
    setShowPromoDropdown,
    isValidatingPromo,
    handlePromoCodeChange,
    handlePromoCodeSelect,
    handlePromoCodeClear,

    // Reward calculations
    baseReward,
    tierBonus,
    totalReward,

    // Balance
    availableBalance,
    hasInsufficientBalance,

    // Actions
    isIssuingReward,
    isIssueDisabled,
    handleIssueReward,
    handleConfirmIssue,
    handleQRScan,
    handleGoBack,
    getButtonText,

    // Confirmation modal
    showConfirmation,
    setShowConfirmation,
  };
}
