import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../config/queryClient";
import { shopApi } from "@/feature/shop/services/shop.services";
import { tierAllowsFeature } from "../constants/featureTiers";

/**
 * The authenticated shop's tier + per-feature access map. Backs every `TierGate` in the app —
 * `GET /shops/feature-access` is auth-only (derives the shop from the JWT), so it can never 403
 * on itself the way a tier-gated marketing/etc. endpoint would.
 */
export function useFeatureAccessQuery() {
  const query = useQuery({
    queryKey: queryKeys.shopFeatureAccess(),
    queryFn: () => shopApi.getFeatureAccess(),
    select: (res) => res?.data,
    // The global default reads error.status, which axios errors don't set, so 401/403/404
    // would otherwise be retried before settling into the error state a TierGate relies on.
    retry: (failureCount, error: any) => {
      const status = error?.response?.status ?? error?.status;
      if (status === 401 || status === 403 || status === 404) return false;
      return failureCount < 2;
    },
    staleTime: 5 * 60 * 1000,
  });

  const can = useCallback(
    (feature: string) => {
      const data = query.data;
      if (!data) return false;
      if (feature in data.features) return data.features[feature];
      return tierAllowsFeature(data.tier, feature);
    },
    [query.data]
  );

  return {
    tier: query.data?.tier,
    can,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
