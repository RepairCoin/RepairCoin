import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreatePromoCodeRequest, RewardRequest } from "@/shared/interfaces/shop.interface";
import { useAuthStore } from "@/shared/store/auth.store";
import { queryKeys } from "@/shared/config/queryClient";
import { Alert } from "react-native";
import { router } from "expo-router";
import { shopApi } from "@/shared/services/shop.services";
import { customerApi } from "@/shared/services/customer.services";

// Tier bonuses constants
const TIER_BONUSES = {
  BRONZE: 0,
  SILVER: 2,
  GOLD: 5,
} as const;

// Repair type constants
const MINOR_REPAIR_RCN = 5;
const SMALL_REPAIR_RCN = 10;
const LARGE_REPAIR_RCN = 15;
const MINOR_REPAIR_VALUE = 30;
const SMALL_REPAIR_VALUE = 75;
const LARGE_REPAIR_VALUE = 100;

export type RepairType = "minor" | "small" | "large" | "custom";

// Hook for fetching customer info
export function useCustomerInfo(walletAddress: string) {
  return useQuery({
    queryKey: queryKeys.customerInfo(walletAddress),
    queryFn: () => customerApi.getCustomerByWalletAddress(walletAddress),
    enabled: !!walletAddress && walletAddress.length === 42,
    select: (data) => data.data?.customer,
    retry: false,
    staleTime: 60000, // Cache for 1 minute
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });
}

// Hook for issuing rewards
export function useIssueReward(resetInputs?: () => void) {
  const queryClient = useQueryClient();
  const shopId = useAuthStore((state) => state.userProfile?.shopId);
  const shopWalletAddress = useAuthStore((state) => state.account?.address);

  return useMutation({
    mutationFn: async (request: RewardRequest) => {
      if (!shopId) {
        throw new Error("Shop not authenticated");
      }
      return shopApi.issueReward(shopId, request);
    },
    onSuccess: (data, variables) => {
      // Show success alert
      Alert.alert(
        "Reward Issued!",
        `Successfully issued ${data.data?.totalReward} RCN to customer!`,
        [{ text: "OK" }]
      );

      // Reset all form inputs
      if (resetInputs) {
        resetInputs();
      }

      // Invalidate customer info to refresh their earnings
      if (variables.customerAddress) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.customerInfo(variables.customerAddress),
        });
      }

      // Invalidate shop data to refresh balance and issued tokens count on home tab
      if (shopWalletAddress) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.shopByWalletAddress(shopWalletAddress),
        });
      }
    },
    onError: (error: any) => {
      console.error("Failed to issue reward:", error);

      let errorMessage = "Failed to issue reward. Please try again.";

      if (error.response?.status === 401) {
        errorMessage = "Authentication required. Please log in again.";
      } else if (error.response?.status === 400) {
        errorMessage =
          error.response?.data?.error ||
          "Invalid request. Please check your inputs.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert("Error", errorMessage, [{ text: "OK" }]);
    },
  });
}

// Hook for managing repair type and calculations
export function useRepairCalculations() {
  const [repairType, setRepairType] = useState<RepairType>("small");
  const [customAmount, setCustomAmount] = useState("");
  const [customRcn, setCustomRcn] = useState("");

  const calculateBaseReward = () => {
    if (repairType === "custom") {
      const rcn = parseFloat(customRcn);
      return isNaN(rcn) ? 0 : rcn;
    }
    switch (repairType) {
      case "minor":
        return MINOR_REPAIR_RCN;
      case "small":
        return SMALL_REPAIR_RCN;
      case "large":
        return LARGE_REPAIR_RCN;
      default:
        return 0;
    }
  };

  const getRepairAmount = () => {
    if (repairType === "custom") {
      return parseFloat(customAmount) || 0;
    }
    switch (repairType) {
      case "minor":
        return MINOR_REPAIR_VALUE;
      case "small":
        return SMALL_REPAIR_VALUE;
      case "large":
        return LARGE_REPAIR_VALUE;
      default:
        return 0;
    }
  };

  const getTierBonus = (tier?: string) => {
    return (
      TIER_BONUSES[tier as keyof typeof TIER_BONUSES] || TIER_BONUSES.BRONZE
    );
  };

  return {
    repairType,
    setRepairType,
    customAmount,
    setCustomAmount,
    customRcn,
    setCustomRcn,
    calculateBaseReward,
    getRepairAmount,
    getTierBonus,
  };
}

// Hook for managing promo code state and validation
export function usePromoCodeManager(
  customerAddress: string,
  baseReward: number,
  tierBonus: number
) {
  const [promoCode, setPromoCode] = useState("");
  const [promoBonus, setPromoBonus] = useState(0);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [showPromoDropdown, setShowPromoDropdown] = useState(false);

  const validatePromo = useValidatePromoCode();

  useEffect(() => {
    let timeoutId: number;

    const fetchPromoBonus = async () => {
      if (!promoCode || !promoCode.trim() || !customerAddress) {
        setPromoBonus(0);
        setPromoError(null);
        return;
      }

      setPromoError(null);
      try {
        const result = await validatePromo.mutateAsync({
          code: promoCode.trim(),
          customerAddress,
        });

        if (result.success && result.data?.is_valid) {
          const rewardBeforePromo = baseReward + tierBonus;
          let bonusAmount = 0;

          if (result.data?.bonus_type === "fixed") {
            bonusAmount = parseFloat(result.data?.bonus_value || "0") || 0;
          } else if (result.data?.bonus_type === "percentage") {
            bonusAmount =
              (rewardBeforePromo *
                (parseFloat(result.data?.bonus_value || "0") || 0)) /
              100;
          }

          // Apply max_bonus cap if it exists
          if (result.data?.max_bonus) {
            const maxBonus = parseFloat(result.data?.max_bonus);
            if (!isNaN(maxBonus) && bonusAmount > maxBonus) {
              bonusAmount = maxBonus;
            }
          }

          setPromoBonus(bonusAmount);
          setPromoError(null);
        } else {
          setPromoBonus(0);
          setPromoError(result.data?.error_message || "Invalid promo code");
        }
      } catch (err: any) {
        setPromoBonus(0);
        setPromoError("Failed to validate promo code");
      }
    };

    // Debounce the fetch to avoid too many requests
    if (promoCode && customerAddress) {
      timeoutId = setTimeout(fetchPromoBonus, 500);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [promoCode, customerAddress, baseReward, tierBonus, validatePromo]);

  return {
    promoCode,
    setPromoCode,
    promoBonus,
    promoError,
    showPromoDropdown,
    setShowPromoDropdown,
    isValidatingPromo: validatePromo.isPending,
  };
}

// Combined hook for all reward functionality
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

  // Reset function to clear all inputs
  const resetAllInputs = () => {
    setCustomerAddress("");
    repairCalc.setRepairType("small"); // Reset to default
    repairCalc.setCustomAmount("");
    repairCalc.setCustomRcn("");
    promoManager.setPromoCode("");
    promoManager.setShowPromoDropdown(false);
  };

  const issueRewardMutation = useIssueReward(resetAllInputs);

  return {
    // Customer management
    customerAddress,
    setCustomerAddress,
    customerInfo: customerQuery.data,
    isLoadingCustomer: customerQuery.isLoading,
    customerError: customerQuery.error,

    // Repair calculations
    ...repairCalc,
    baseReward,
    tierBonus,
    totalReward,

    // Promo codes
    availablePromoCodes: promoCodesQuery.data || [],
    isLoadingPromoCodes: promoCodesQuery.isLoading,
    ...promoManager,

    // Issue reward
    issueReward: issueRewardMutation.mutate,
    isIssuingReward: issueRewardMutation.isPending,
    rewardError: issueRewardMutation.error,
    resetAllInputs,
  };
}

// Hook for fetching shop promo codes
export function useShopPromoCodes() {
  const shopId = useAuthStore((state) => state.userProfile?.shopId);

  return useQuery({
    queryKey: queryKeys.shopPromoCodes(shopId || ""),
    queryFn: () => {
      if (!shopId) {
        throw new Error("No shop ID found");
      }
      return shopApi.getShopPromoCodes(shopId);
    },
    enabled: !!shopId,
    select: (data) => data.data || [],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
}

// Hook for validating promo codes
export function useValidatePromoCode() {
  const shopId = useAuthStore((state) => state.userProfile?.shopId);

  return useMutation({
    mutationFn: async ({
      code,
      customerAddress,
    }: {
      code: string;
      customerAddress: string;
    }) => {
      if (!shopId) {
        throw new Error("Shop ID not found");
      }
      return shopApi.validatePromoCode(shopId, {
        code: code.trim(),
        customer_address: customerAddress,
      });
    },
    onError: (error: any) => {
      console.error("Failed to validate promo code:", error);
    },
  });
}

// Hook for updating promo code status
export function useUpdatePromoCodeStatus() {
  const queryClient = useQueryClient();
  const shopId = useAuthStore((state) => state.userProfile?.shopId);

  return useMutation({
    mutationFn: async ({
      promoCodeId,
      isActive,
    }: {
      promoCodeId: string;
      isActive: boolean;
    }) => {
      if (!shopId) {
        throw new Error("Shop ID not found");
      }
      return shopApi.updatePromoCodeStatus(shopId, promoCodeId, isActive);
    },
    onSuccess: (_, variables) => {
      // Invalidate promo codes list to refresh
      if (shopId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.shopPromoCodes(shopId),
        });

        Alert.alert(
          "Success",
          variables.isActive ? "Promo code activated successfully!" : "Promo code deactivated successfully!",
          [{ text: "OK" }]
        );
      }
    },
    onError: (error: any, variables) => {
      console.error("Failed to update promo code status:", error);
      const statusText = variables.isActive ? "activate" : "deactivate";
      Alert.alert(
        "Error",
        error.response?.data?.message || `Failed to ${statusText} promo code`,
        [{ text: "OK" }]
      );
    },
  });
}

// Hook for creating promo codes
export function useCreatePromoCode() {
  const queryClient = useQueryClient();
  const shopId = useAuthStore((state) => state.userProfile?.shopId);

  return useMutation({
    mutationFn: async (promoCodeData: CreatePromoCodeRequest) => {
      if (!shopId) {
        throw new Error("Shop ID not found");
      }
      return shopApi.createPromoCode(shopId, promoCodeData);
    },
    onSuccess: () => {
      Alert.alert(
        "Success",
        "Promo code created successfully!",
        [
          {
            text: "OK",
            onPress: () => router.back()
          }
        ]
      );

      // Invalidate promo codes list to refresh
      if (shopId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.shopPromoCodes(shopId),
        });
      }
    },
    onError: (error: any) => {
      console.error("Failed to create promo code:", error);
      Alert.alert(
        "Error",
        error.response?.data?.error || "Failed to create promo code",
        [{ text: "OK" }]
      );
    },
  });
}
