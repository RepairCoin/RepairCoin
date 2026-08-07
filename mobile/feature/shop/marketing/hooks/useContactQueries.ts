import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { queryKeys } from "@/shared/hooks";
import { marketingApi } from "../services/marketing.services";
import { ContactStatus } from "../services/marketing.interface";

// The global default retry reads error.status, which axios errors don't set, so 401/403/404
// (every marketing route is tier-gated — a below-tier shop 403s) would otherwise be retried
// before settling into an error state a TierGate/caller can act on.
function bail401403404(failureCount: number, error: any): boolean {
  const status = error?.response?.status ?? error?.status;
  if (status === 401 || status === 403 || status === 404) return false;
  return failureCount < 2;
}

export function useShopContactsQuery(status?: ContactStatus, search?: string) {
  const shopId = useAuthStore((s) => s.userProfile?.shopId);

  return useQuery({
    queryKey: queryKeys.shopContacts(shopId as string, status, search),
    queryFn: () => marketingApi.getContacts(shopId as string, status, search),
    select: (res) => res.data,
    enabled: !!shopId,
    retry: bail401403404,
    staleTime: 2 * 60 * 1000,
  });
}

export function useContactStatsQuery() {
  const shopId = useAuthStore((s) => s.userProfile?.shopId);

  return useQuery({
    queryKey: queryKeys.shopContactStats(shopId as string),
    queryFn: () => marketingApi.getContactStats(shopId as string),
    select: (res) => res.data,
    enabled: !!shopId,
    retry: bail401403404,
    staleTime: 2 * 60 * 1000,
  });
}
