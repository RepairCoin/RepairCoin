import { useState, useCallback } from "react";
import { Alert } from "react-native";
import { goBack } from "expo-router/build/global-state/routing";
import { useAuthStore } from "@/shared/store/auth.store";
import { useRedemption } from "./useRedemption";

/**
 * Hook for redeem token screen business logic
 */
export const useRedeemToken = () => {
  const shopData = useAuthStore((state) => state.userProfile);

  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [redemptionAmount, setRedemptionAmount] = useState("");

  const {
    customerAddress,
    setCustomerAddress,
    customerData,
    isLoadingCustomer,
    customerError,
    currentSession,
    sessionStatus,
    timeRemaining,
    createSession,
    cancelSession,
    resetRedemption,
    isCreatingSession,
    isCancellingSession,
  } = useRedemption({
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.error ||
        error?.message ||
        "Failed to process redemption. Please try again.";
      Alert.alert("Redemption Error", errorMessage);
    },
  });

  const isCustomerSelf = Boolean(
    shopData?.address &&
    customerAddress &&
    customerAddress.toLowerCase() === shopData.address.toLowerCase()
  );

  const hasInsufficientBalance = Boolean(
    customerData &&
    redemptionAmount &&
    parseFloat(redemptionAmount) > customerData.balance
  );

  // Check if amount exceeds cross-shop limit (20% for non-home shops)
  const exceedsCrossShopLimit = Boolean(
    customerData &&
    redemptionAmount &&
    !customerData.isHomeShop &&
    parseFloat(redemptionAmount) > customerData.maxRedeemable
  );

  const canProcessRedemption = Boolean(
    !isCreatingSession &&
    customerAddress &&
    customerData &&
    redemptionAmount &&
    parseFloat(redemptionAmount) > 0 &&
    !hasInsufficientBalance &&
    !exceedsCrossShopLimit &&
    !isCustomerSelf
  );

  const handleProcessRedemption = useCallback(() => {
    if (!customerAddress) {
      Alert.alert("Error", "Please enter a valid customer address");
      return;
    }

    if (
      shopData?.address &&
      customerAddress.toLowerCase() === shopData.address.toLowerCase()
    ) {
      Alert.alert(
        "Error",
        "You cannot process redemption for your own wallet address"
      );
      return;
    }

    if (!customerData) {
      Alert.alert(
        "Error",
        "Customer not found. Customer must be registered before processing redemption."
      );
      return;
    }

    const amount = parseFloat(redemptionAmount);
    if (!redemptionAmount || isNaN(amount) || amount <= 0) {
      Alert.alert("Error", "Please enter a valid redemption amount");
      return;
    }

    if (amount > customerData.balance) {
      Alert.alert(
        "Error",
        `Insufficient balance. Customer has ${customerData.balance} RCN, but ${amount} RCN requested.`
      );
      return;
    }

    // Check cross-shop redemption limit (20% for non-home shops)
    if (!customerData.isHomeShop && amount > customerData.maxRedeemable) {
      Alert.alert(
        "Cross-Shop Limit Exceeded",
        `This customer can only redeem up to ${customerData.maxRedeemable.toFixed(2)} RCN at your shop (20% cross-shop limit).\n\nCustomer can redeem 100% at shops where they earned their RCN.`
      );
      return;
    }

    if (!shopData?.id) {
      Alert.alert("Error", "Shop ID not found");
      return;
    }

    createSession({
      customerAddress,
      shopId: shopData.id,
      amount,
    });
  }, [customerAddress, customerData, redemptionAmount, shopData, createSession]);

  const handleCancelSession = useCallback(() => {
    if (!currentSession) return;

    Alert.alert(
      "Cancel Request",
      "Are you sure you want to cancel this redemption request?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes",
          onPress: () => cancelSession(currentSession.sessionId),
        },
      ]
    );
  }, [currentSession, cancelSession]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  }, []);

  const handleCompleteAnother = useCallback(() => {
    resetRedemption();
    setRedemptionAmount("");
  }, [resetRedemption]);

  const handleQRScan = useCallback((address: string) => {
    setCustomerAddress(address);
    setShowQRScanner(false);
  }, [setCustomerAddress]);

  return {
    // State
    shopData,
    showHowItWorks,
    setShowHowItWorks,
    isRefreshing,
    showQRScanner,
    setShowQRScanner,
    redemptionAmount,
    setRedemptionAmount,
    
    // Customer data
    customerAddress,
    setCustomerAddress,
    customerData,
    isLoadingCustomer,
    customerError,
    
    // Session data
    currentSession,
    sessionStatus,
    timeRemaining,
    isCreatingSession,
    isCancellingSession,
    
    // Computed values
    isCustomerSelf,
    hasInsufficientBalance,
    exceedsCrossShopLimit,
    canProcessRedemption,
    
    // Handlers
    handleProcessRedemption,
    handleCancelSession,
    handleRefresh,
    handleCompleteAnother,
    handleQRScan,
    goBack,
  };
};
