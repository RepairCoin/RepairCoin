import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/shared/config/queryClient";
import { aiRecommendationsApi } from "../services/aiRecommendations.services";
import { RecPresentation } from "../services/aiRecommendations.interface";

/**
 * Priority Actions / recommendation feed. The endpoint is tier-gated (aiInsights,
 * Growth+), so a below-tier shop gets a 403 — an expected outcome, not a failure.
 * Mobile has no feature-access hook to pre-check with, so the 403 IS the check:
 * we don't retry it, and the caller renders nothing.
 */
export function useAiRecommendationsQuery(
  presentation: RecPresentation = "card",
  limit = 3,
) {
  return useQuery({
    queryKey: queryKeys.aiRecommendations(presentation, limit),
    queryFn: () => aiRecommendationsApi.list(limit, presentation),
    // The global default reads error.status, which axios errors don't set, so
    // 401/403 would otherwise be retried three times before settling.
    retry: (failureCount, error: any) => {
      const status = error?.response?.status ?? error?.status;
      if (status === 401 || status === 403 || status === 404) return false;
      return failureCount < 2;
    },
    staleTime: 5 * 60 * 1000,
  });
}
