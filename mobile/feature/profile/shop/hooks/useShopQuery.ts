import { useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { useAppToast } from "@/shared/hooks/useAppToast";
import { queryClient, queryKeys } from "@/shared/config/queryClient";
import { shopApi } from "../services/shop.services";
import { useService } from "@/feature/services/hooks/useService";
import {
  ShopCustomerGrowthResponse,
  ShopCustomersResponse,
  ShopFormData,
  ShopResponse,
  ShopByWalletAddressResponse,
  TransactionsResponse,
  PurchasesResponse,
  PromoCodesListResponse,
  CreatePromoCodeRequest,
} from "@/shared/interfaces/shop.interface";
import { TimeRange } from "../types";

export function useShop() {
  const { showError } = useAppToast();

  const useGetShops = () => {
    return useQuery({
      queryKey: queryKeys.shopList(),
      queryFn: async () => {
        const response: ShopResponse = await shopApi.listShops();
        return response.data;
      },
      staleTime: 10 * 60 * 1000,
    });
  };

  const useGetShopByWalletAddress = (address: string) => {
    return useQuery({
      queryKey: queryKeys.shopByWalletAddress(address),
      queryFn: async () => {
        const response: ShopByWalletAddressResponse =
          await shopApi.getShopByWalletAddress(address);
        return response.data;
      },
      staleTime: 10 * 60 * 1000,
      refetchOnMount: "always",
    });
  };

  const useGetShopById = (shopId: string) => {
    return useQuery({
      queryKey: queryKeys.shop(shopId),
      queryFn: async () => {
        const response: ShopByWalletAddressResponse =
          await shopApi.getShopById(shopId);
        return response.data;
      },
      enabled: !!shopId,
      staleTime: 10 * 60 * 1000,
    });
  };

  const useGetShopCustomers = (shopId: string) => {
    return useQuery({
      queryKey: queryKeys.shopCustomers(shopId),
      queryFn: async () => {
        const response: ShopCustomersResponse =
          await shopApi.getShopCustomers(shopId);
        return response.data;
      },
      staleTime: 10 * 60 * 1000,
    });
  };

  const useShopCustomerGrowth = (shopId: string) => {
    return useQuery({
      queryKey: queryKeys.shopCustomerGrowth(shopId),
      queryFn: async () => {
        const response: ShopCustomerGrowthResponse =
          await shopApi.getShopCustomerGrowth(shopId);
        return response?.data;
      },
      staleTime: 10 * 60 * 1000,
    });
  };

  const useShopPromoCodes = (shopId: string) => {
    return useQuery({
      queryKey: queryKeys.shopPromoCodes(shopId),
      queryFn: async () => {
        const response: any = await shopApi.getPromoCodes(shopId);
        return response.data;
      },
      enabled: !!shopId,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    });
  };

  const useRegisterShop = () => {
    return useMutation({
      mutationFn: async (formData: ShopFormData) => {
        if (!formData.walletAddress) {
          throw new Error("No wallet address provided");
        }

        return await shopApi.register(formData);
      },
      onSuccess: async (result) => {
        if (result.success) {
          router.push("/register/pending");
        }
      },
      onError: (error: any) => {
        console.error("[useRegisterShop] Error:", error);
        if (error?.__toastShown) return;
        const message =
          error?.response?.data?.error ||
          error?.message ||
          "Registration failed. Please try again.";
        showError(message);
      },
    });
  };

  const useUpdateShop = (address: string) => {
    return useMutation({
      mutationFn: async ({
        shopId,
        shopData,
      }: {
        shopId: string;
        shopData: ShopFormData;
      }) => {
        const response: { message: string; success: boolean } =
          await shopApi.updateShopDetails(shopId, shopData);
        return response;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.shopByWalletAddress(address),
        });
      },
    });
  };

  return {
    useRegisterShop,
    useGetShops,
    useGetShopByWalletAddress,
    useGetShopById,
    useGetShopCustomers,
    useShopCustomerGrowth,
    useShopPromoCodes,
    useUpdateShop,
  };
}

export function useShopAnalyticsQuery(shopId: string, timeRange: TimeRange) {
  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    const start = new Date();

    switch (timeRange) {
      case "day":
        start.setDate(end.getDate() - 30);
        break;
      case "month":
        start.setMonth(end.getMonth() - 12);
        break;
      case "year":
        start.setFullYear(end.getFullYear() - 5);
        break;
    }

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  }, [timeRange]);

  return useQuery({
    queryKey: queryKeys.shopAnalytics(shopId, timeRange),
    queryFn: async (): Promise<{
      transactions: TransactionsResponse;
      purchases: PurchasesResponse;
    }> => {
      const [transactions, purchases] = await Promise.all([
        shopApi
          .getShopTransactions(shopId, startDate, endDate)
          .catch(() => ({
            success: false,
            data: { transactions: [], total: 0, totalPages: 0, page: 1 },
          })),
        shopApi.getShopPurchases(shopId, startDate, endDate).catch(() => ({
          success: false,
          data: {
            items: [],
            pagination: {
              page: 1,
              limit: 100,
              totalItems: 0,
              totalPages: 0,
              hasMore: false,
            },
          },
        })),
      ]);

      return { transactions, purchases };
    },
    enabled: !!shopId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useShopPromoCodesQuery() {
  const shopId = useAuthStore((state) => state.userProfile?.shopId) || "";

  return useQuery({
    queryKey: queryKeys.shopPromoCodes(shopId),
    queryFn: async () => {
      const response: PromoCodesListResponse = await shopApi.getPromoCodes(shopId);
      return response.data || response.items || [];
    },
    enabled: !!shopId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useShopByWalletQuery() {
  const { account } = useAuthStore();
  const walletAddress = account?.address || "";

  return useQuery({
    queryKey: queryKeys.shopByWalletAddress(walletAddress),
    queryFn: async () => {
      const response = await shopApi.getShopByWalletAddress(walletAddress);
      return response.data;
    },
    enabled: !!walletAddress,
    staleTime: 10 * 60 * 1000,
  });
}

export function useShopCustomerGrowthQuery() {
  const { userProfile } = useAuthStore();
  const shopId = userProfile?.shopId || "";

  return useQuery({
    queryKey: queryKeys.shopCustomerGrowth(shopId),
    queryFn: async () => {
      const response = await shopApi.getShopCustomerGrowth(shopId);
      return response?.data;
    },
    enabled: !!shopId,
    staleTime: 10 * 60 * 1000,
  });
}

export const useShopProfileByWalletQuery = (walletAddress: string) => {
  const { useGetShopByWalletAddress } = useShop();
  return useGetShopByWalletAddress(walletAddress);
};

export const useShopProfileQuery = (shopId: string) => {
  const { useGetShopById } = useShop();
  return useGetShopById(shopId);
};

export const useShopServicesQuery = (shopId: string) => {
  const { useShopServicesQuery: useServices } = useService();
  return useServices({ shopId, page: 1, limit: 20 });
};

export function useUpdatePromoCodeStatusMutation() {
  const shopId = useAuthStore((state) => state.userProfile?.shopId) || "";

  return useMutation({
    mutationFn: async ({
      promoCodeId,
      isActive,
    }: {
      promoCodeId: string;
      isActive: boolean;
    }) => {
      return shopApi.updatePromoCodeStatus(shopId, promoCodeId, isActive);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.shopPromoCodes(shopId),
      });
    },
  });
}

export const useUpdateShopProfileMutation = (walletAddress: string) => {
  const { useUpdateShop } = useShop();
  return useUpdateShop(walletAddress);
};
