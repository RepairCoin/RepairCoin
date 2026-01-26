import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/shared/store/auth.store";
import { queryKeys } from "@/config/queryClient";
import { serviceApi } from "@/shared/services/service.services";
import {
  ServiceResponse,
  ServiceDetailResponse,
} from "@/interfaces/service.interface";

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
