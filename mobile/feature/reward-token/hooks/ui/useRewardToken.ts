import { useState } from "react";
import { Alert } from "react-native";
import { goBack } from "expo-router/build/global-state/routing";
import { useShopRewards, RepairType } from "@/hooks/useShopRewards";
import { useAuthStore } from "@/store/auth.store";

export function useRewardToken() {
  const shopData = useAuthStore((state) => state.userProfile);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);

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

  const isSelfReward = Boolean(
    shopData?.address &&
    customerAddress &&
    customerAddress.toLowerCase() === shopData.address.toLowerCase()
  );

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
    (repairType === "custom" &&
      (!customAmount || !customRcn || parseFloat(customAmount) <= 0));

  const handleIssueReward = () => {
    if (!customerAddress) {
      Alert.alert("Error", "Please enter a valid customer address");
      return;
    }

    if (isSelfReward) {
      Alert.alert("Error", "You cannot issue rewards to your own wallet address");
      return;
    }

    if (!customerInfo) {
      Alert.alert(
        "Error",
        "Customer not found. Customer must be registered before receiving rewards."
      );
      return;
    }

    if (repairType === "custom") {
      const amount = parseFloat(customAmount);
      if (!customAmount || isNaN(amount) || amount <= 0) {
        Alert.alert("Error", "Please enter a valid repair amount");
        return;
      }
      if (!customRcn || parseFloat(customRcn) <= 0) {
        Alert.alert("Error", "Please enter a valid RCN reward amount");
        return;
      }
    }

    const request = {
      customerAddress,
      repairAmount: getRepairAmount(),
      skipTierBonus: false,
      promoCode: promoCode.trim() || undefined,
      ...(repairType === "custom" && {
        customBaseReward: parseFloat(customRcn),
      }),
    };

    issueReward(request);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
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

    // Actions
    isIssuingReward,
    isIssueDisabled,
    handleIssueReward,
    handleQRScan,
    handleGoBack,
    getButtonText,
  };
}
