import { useRef } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { queryKeys } from "@/shared/hooks";
import { marketingApi } from "../services/marketing.services";
import {
  CampaignAudienceType,
  CampaignDeliveryMethod,
  CampaignStatus,
} from "../services/marketing.interface";

const CAMPAIGNS_PAGE_SIZE = 10;
const CUSTOMERS_PAGE_SIZE = 50;
// Safety valve for pollWhileSending — stop polling even if the campaign never flips to 'sent'.
const POLL_CAP_MS = 3 * 60 * 1000;
const POLL_INTERVAL_MS = 5000;

// The global default retry reads error.status, which axios errors don't set, so 401/403/404
// (every marketing route is tier-gated — a below-tier shop 403s) would otherwise be retried
// before settling into an error state a TierGate/caller can act on.
function bail401403404(failureCount: number, error: any): boolean {
  const status = error?.response?.status ?? error?.status;
  if (status === 401 || status === 403 || status === 404) return false;
  return failureCount < 2;
}

export function useCampaignsInfiniteQuery(status?: CampaignStatus) {
  const shopId = useAuthStore((s) => s.userProfile?.shopId);

  return useInfiniteQuery({
    queryKey: [...queryKeys.shopCampaigns(shopId as string, status), "infinite"],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await marketingApi.getCampaigns(shopId as string, pageParam, CAMPAIGNS_PAGE_SIZE, status);
      return res.data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage?.pagination?.hasMore) {
        return (lastPage.pagination.page || 1) + 1;
      }
      return undefined;
    },
    enabled: !!shopId,
    retry: bail401403404,
    staleTime: 2 * 60 * 1000,
  });
}

export function useCampaignStatsQuery() {
  const shopId = useAuthStore((s) => s.userProfile?.shopId);

  return useQuery({
    queryKey: queryKeys.shopCampaignStats(shopId as string),
    queryFn: () => marketingApi.getCampaignStats(shopId as string),
    select: (res) => res.data,
    enabled: !!shopId,
    retry: bail401403404,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * `pollWhileSending`: refetches every 5s while the campaign hasn't reached a terminal status, for
 * the ECONNABORTED-on-send case — sending is synchronous server-side, so a client timeout does NOT
 * mean the send failed, and the UI polls this instead of showing a false failure. Capped at 3
 * minutes so a stuck campaign doesn't poll forever.
 */
export function useCampaignQuery(campaignId?: string, options?: { pollWhileSending?: boolean }) {
  const pollWhileSending = options?.pollWhileSending ?? false;
  const pollStartedAt = useRef<number | null>(null);

  return useQuery({
    queryKey: queryKeys.shopCampaign(campaignId as string),
    queryFn: () => marketingApi.getCampaign(campaignId as string),
    select: (res) => res.data,
    enabled: !!campaignId,
    retry: bail401403404,
    staleTime: 60 * 1000,
    refetchInterval: (query) => {
      if (!pollWhileSending) return false;
      // `query.state.data` is the raw queryFn result (pre-`select`) — the full envelope.
      const status = query.state.data?.data?.status;
      if (status === "sent" || status === "cancelled") {
        pollStartedAt.current = null;
        return false;
      }
      if (pollStartedAt.current === null) pollStartedAt.current = Date.now();
      if (Date.now() - pollStartedAt.current > POLL_CAP_MS) return false;
      return POLL_INTERVAL_MS;
    },
  });
}

export function useMarketingTemplatesQuery(category?: string) {
  return useQuery({
    queryKey: queryKeys.marketingTemplates(category),
    queryFn: () => marketingApi.getTemplates(category),
    select: (res) => res.data,
    retry: bail401403404,
    staleTime: 10 * 60 * 1000,
  });
}

export function useAudienceCountQuery(
  audienceType: CampaignAudienceType,
  filters?: Record<string, any>,
  deliveryMethod?: CampaignDeliveryMethod,
  enabled: boolean = true
) {
  const shopId = useAuthStore((s) => s.userProfile?.shopId);

  return useQuery({
    queryKey: queryKeys.shopAudienceCount(shopId as string, audienceType, filters, deliveryMethod),
    queryFn: () => marketingApi.getAudienceCount(shopId as string, audienceType, filters, deliveryMethod),
    select: (res) => res.data.count,
    enabled: enabled && !!shopId,
    retry: bail401403404,
    staleTime: 30 * 1000,
  });
}

export function useMarketingCustomersQuery(search?: string) {
  const shopId = useAuthStore((s) => s.userProfile?.shopId);

  return useQuery({
    queryKey: queryKeys.marketingCustomers(shopId as string, search),
    queryFn: () => marketingApi.getMarketingCustomers(shopId as string, 1, CUSTOMERS_PAGE_SIZE, search),
    select: (res) => res.data,
    enabled: !!shopId,
    retry: bail401403404,
    staleTime: 60 * 1000,
  });
}
