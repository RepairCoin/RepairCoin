import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { queryKeys } from "@/shared/hooks";
import { shopApi } from "@/feature/shop/services/shop.services";
import { ShopTransactionData } from "@/feature/token/services/token.interface";

export interface RedemptionHistoryItem {
  id: string;
  customerAddress: string;
  customerName: string;
  amount: number;
  timestamp: string;
  status: "confirmed" | "pending" | "failed";
}

const HISTORY_LIMIT = 20;

/**
 * Fetches the shop's processed redemption transactions for the
 * Redemption History card (mirrors the web RedeemTabV2 history list).
 */
export function useRedemptionHistory() {
  const userProfile = useAuthStore((state) => state.userProfile);
  const shopId = userProfile?.id ?? userProfile?.shopId ?? "";

  return useQuery({
    queryKey: queryKeys.shopRedemptions(shopId),
    queryFn: async (): Promise<RedemptionHistoryItem[]> => {
      const response = await shopApi.getShopTransactionHistory(
        shopId,
        "redemptions",
        HISTORY_LIMIT,
      );

      const transactions: ShopTransactionData[] =
        response?.data?.transactions || [];

      return transactions
        .filter((tx) => tx.type?.toLowerCase().includes("redempt"))
        .map((tx) => ({
          id: String(tx.id),
          customerAddress: tx.customerAddress || "",
          customerName: tx.customerName || "Unknown Customer",
          amount: tx.amount,
          timestamp: tx.createdAt,
          status: (tx.status as RedemptionHistoryItem["status"]) || "confirmed",
        }));
    },
    enabled: !!shopId,
    staleTime: 60 * 1000,
  });
}
