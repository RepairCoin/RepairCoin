import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { queryKeys } from "@/shared/config/queryClient";
import { serviceApi } from "../../../services/service.services";
import {
  ServiceResponse,
  ServiceDetailResponse,
} from "@/shared/interfaces/service.interface";

export function useServicesTabQuery() {
  const { userProfile } = useAuthStore();
  const shopId = userProfile?.shopId ?? "";

  return useQuery({
    queryKey: queryKeys.shopServices({ shopId, page: 1, limit: 10 }),
    queryFn: async () => {
      const response: ServiceResponse = await serviceApi.getShopServices(shopId, {
        page: 1,
        limit: 10,
      });
      return response.data;
    },
    enabled: !!shopId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useInfiniteShopServicesQuery(
  filters?: { search?: string; category?: string }
) {
  const { userProfile } = useAuthStore();
  const shopId = userProfile?.shopId ?? "";

  return useInfiniteQuery({
    queryKey: ['shopServices', 'infinite', shopId, filters],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await serviceApi.getShopServices(shopId, {
        ...filters,
        page: pageParam,
        limit: 10,
      });
      return {
        data: response.data || [],
        pagination: response.pagination,
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination?.hasMore) {
        return (lastPage.pagination.page || 1) + 1;
      }
      return undefined;
    },
    enabled: !!shopId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useServiceDetailQuery(serviceId?: string) {
  return useQuery({
    queryKey: queryKeys.service(serviceId ?? ""),
    queryFn: async () => {
      const response: ServiceDetailResponse = await serviceApi.getService(serviceId!);
      return response.data;
    },
    enabled: !!serviceId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useServiceFormData() {
  const { userProfile } = useAuthStore();

  const isQualified =
    userProfile?.operational_status === "subscription_qualified" ||
    userProfile?.operational_status === "rcg_qualified";

  return {
    shopData: userProfile,
    shopId: userProfile?.shopId,
    isQualified,
  };
}
