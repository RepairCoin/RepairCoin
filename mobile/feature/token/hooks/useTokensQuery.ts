import { useState, useEffect, useCallback } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { queryKeys } from "@/shared/config/queryClient";
import { tokenApi } from "../services/token.services";
import { purchaseApi } from "../services/purchase.services";
import { balanceApi } from "../services/balance.services";
import { shopApi } from "@/feature/shop/account/services/shop.services";
import { customerApi } from "@/feature/customer/profile/services/customer.services";
import { promoCodeApi } from "@/feature/shop/promo-code/services/promoCode.services";
import {
  TransferHistoryResponse,
  MyRedemptionSessionsResponse,
} from "@/feature/token/services/token.interface";
import { TransactionResponse } from "@/feature/customer/profile/services/customer.interface";
import {
  RedemptionSession,
  CustomerRedemptionData,
  CustomerTier,
} from "../types";

export interface BalanceData {
  availableBalance: number;
  lifetimeEarned: number;
  totalRedeemed: number;
  earningHistory?: {
    fromRepairs: number;
    fromReferrals: number;
    fromBonuses: number;
    fromTierBonuses: number;
  };
  homeShop?: string;
}

// ─── Queries ────────────────────────────────────────────────────────────────

// Token balance
export const useTokenBalance = (walletAddress?: string) => {
  return useQuery<BalanceData | null>({
    queryKey: queryKeys.tokenBalance(walletAddress || ""),
    queryFn: async () => {
      const data = await tokenApi.fetchTokenBalance(walletAddress!);
      if (data) {
        const roundedData: BalanceData = {
          availableBalance:
            Math.round((data.data?.availableBalance || 0) * 100) / 100,
          lifetimeEarned:
            Math.round((data.data?.lifetimeEarned || 0) * 100) / 100,
          totalRedeemed:
            Math.round((data.data?.totalRedeemed || 0) * 100) / 100,
          earningHistory: data.data?.earningHistory
            ? {
                fromRepairs:
                  Math.round(
                    (data.data?.earningHistory?.fromRepairs || 0) * 100,
                  ) / 100,
                fromReferrals:
                  Math.round(
                    (data.data?.earningHistory?.fromReferrals || 0) * 100,
                  ) / 100,
                fromBonuses:
                  Math.round(
                    (data.data.earningHistory.fromBonuses || 0) * 100,
                  ) / 100,
                fromTierBonuses:
                  Math.round(
                    (data.data.earningHistory.fromTierBonuses || 0) * 100,
                  ) / 100,
              }
            : undefined,
        };
        return roundedData;
      }
      return null;
    },
    enabled: !!walletAddress,
    staleTime: 30000,
  });
};

// Shop balance
export function useShopBalance() {
  const shopId = useAuthStore((state) => state.userProfile?.shopId);

  return useQuery({
    queryKey: queryKeys.shop(shopId || ""),
    queryFn: () => shopApi.getShopById(shopId!),
    enabled: !!shopId,
    select: (data) => data.data?.purchasedRcnBalance ?? 0,
    staleTime: 30 * 1000,
    refetchOnMount: true,
  });
}

// Customer info by wallet address
export function useCustomerInfo(walletAddress: string) {
  return useQuery({
    queryKey: queryKeys.customerInfo(walletAddress),
    queryFn: () => customerApi.getCustomerByWalletAddress(walletAddress),
    enabled: !!walletAddress && walletAddress.length === 42,
    select: (data) => data.data?.customer,
    retry: false,
    staleTime: 60000,
    gcTime: 5 * 60 * 1000,
  });
}

// Shop promo codes
export function useShopPromoCodes() {
  const shopId = useAuthStore((state) => state.userProfile?.shopId);

  return useQuery({
    queryKey: queryKeys.shopPromoCodes(shopId || ""),
    queryFn: () => {
      if (!shopId) {
        throw new Error("No shop ID found");
      }
      return promoCodeApi.getPromoCodes(shopId);
    },
    enabled: !!shopId,
    select: (data) => data.data || [],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// Shop transactions
export function useShopTransactionsQuery() {
  const { userProfile } = useAuthStore();
  const shopId = userProfile?.shopId || "";

  return useQuery({
    queryKey: queryKeys.shopTransactions(shopId),
    queryFn: async () => {
      const response = await purchaseApi.getShopTransactions(shopId);
      return response?.data;
    },
    enabled: !!shopId,
    staleTime: 10 * 60 * 1000,
  });
}

// Customer transactions (infinite scroll)
const PAGE_SIZE = 20;

export function useCustomerTransactionsQuery(limit: number = PAGE_SIZE) {
  const { account } = useAuthStore();
  const address = account?.address || "";

  return useInfiniteQuery({
    queryKey: [...queryKeys.customerTransactions(address), "infinite", limit],
    queryFn: async ({ pageParam = 1 }) => {
      const response: TransactionResponse =
        await customerApi.getTransactionByWalletAddress(address, limit, pageParam);
      return response.data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage: any) => {
      if (lastPage?.pagination?.hasMore) {
        return (lastPage.pagination.page || 1) + 1;
      }
      return undefined;
    },
    enabled: !!address,
    staleTime: 2 * 60 * 1000,
  });
}

// Redemption sessions
export const useRedemptionSessions = () => {
  const { userProfile } = useAuthStore();
  const walletAddress = userProfile?.address;

  const query = useQuery<MyRedemptionSessionsResponse>({
    queryKey: queryKeys.redemptionSessions(walletAddress || ""),
    queryFn: async () => {
      const response: MyRedemptionSessionsResponse =
        await tokenApi.fetchMyRedemptionSessions();
      return response;
    },
    enabled: !!walletAddress,
    staleTime: 10000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const sessions = query.data?.sessions || [];
  const pendingSessions = sessions.filter(
    (session: RedemptionSession) => session.status === "pending"
  );

  return {
    ...query,
    sessionsData: query.data,
    sessions,
    pendingSessions,
    isLoadingSessions: query.isLoading,
    refetchSessions: query.refetch,
  };
};

// Transfer history
export const useTransferHistory = (
  address: string,
  options?: { limit?: number; offset?: number }
) => {
  return useQuery({
    queryKey: queryKeys.transferHistory(address, options),
    queryFn: async () => {
      const response: TransferHistoryResponse =
        await tokenApi.getTransferHistory(address, options);
      return response.data;
    },
    enabled: !!address,
    staleTime: 5 * 60 * 1000,
  });
};

// Buy token queries (shop qualification check)
export function useBuyTokenQueries() {
  const { userProfile } = useAuthStore();

  const isQualified =
    userProfile?.operational_status === "subscription_qualified" ||
    userProfile?.operational_status === "rcg_qualified";

  return {
    shopData: userProfile,
    isQualified,
  };
}

// Customer lookup (cross-shop redemption data)
const CROSS_SHOP_LIMIT_PERCENTAGE = 0.2;

export const useCustomerLookup = () => {
  const shopData = useAuthStore((state) => state.userProfile);
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerData, setCustomerData] =
    useState<CustomerRedemptionData | null>(null);
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);

  useEffect(() => {
    if (customerAddress && customerAddress.length === 42) {
      lookupCustomer(customerAddress);
    } else {
      setCustomerData(null);
      setCustomerError(null);
    }
  }, [customerAddress, shopData?.shopId]);

  const lookupCustomer = async (address: string) => {
    setIsLoadingCustomer(true);
    setCustomerError(null);

    try {
      const [customerResponse, balanceResponse, crossShopResponse, isHomeShop] =
        await Promise.all([
          customerApi.getCustomerByWalletAddress(address),
          balanceApi.getCustomerBalance(address),
          customerApi.getCrossShopBalance(address).catch(() => null),
          shopData?.shopId
            ? customerApi.hasEarnedAtShop(address, shopData.shopId)
            : Promise.resolve(false),
        ]);

      if (customerResponse && balanceResponse) {
        const balance = balanceResponse.data?.totalBalance || 0;
        const lifetimeEarnings =
          customerResponse.data?.customer?.lifetimeEarnings || 0;

        const crossShopLimit =
          crossShopResponse?.data?.crossShopLimit ??
          lifetimeEarnings * CROSS_SHOP_LIMIT_PERCENTAGE;

        const maxRedeemable = isHomeShop
          ? balance
          : Math.min(balance, crossShopLimit);

        setCustomerData({
          address,
          tier:
            (customerResponse.data?.customer?.tier as CustomerTier) || "BRONZE",
          balance,
          lifetimeEarnings,
          isHomeShop,
          maxRedeemable,
          crossShopLimit,
        });
      } else {
        setCustomerError("Customer not found");
        setCustomerData(null);
      }
    } catch (error) {
      console.error("Error looking up customer:", error);
      setCustomerError("Failed to lookup customer");
      setCustomerData(null);
    } finally {
      setIsLoadingCustomer(false);
    }
  };

  const resetCustomer = useCallback(() => {
    setCustomerAddress("");
    setCustomerData(null);
    setCustomerError(null);
  }, []);

  return {
    customerAddress,
    setCustomerAddress,
    customerData,
    isLoadingCustomer,
    customerError,
    lookupCustomer,
    resetCustomer,
  };
};
