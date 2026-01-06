import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { queryKeys } from "@/config/queryClient";
import { serviceApi } from "@/services/service.services";
import {
  ServiceResponse,
  ServiceDetailResponse,
} from "@/interfaces/service.interface";

interface UseServiceQueriesParams {
  serviceId?: string;
}

export function useServiceQueries(params: UseServiceQueriesParams = {}) {
  const { userProfile } = useAuthStore();
  const authShopId = userProfile?.shopId ?? "";

  // Services Tab Query
  const servicesTabQuery = useQuery({
    queryKey: queryKeys.shopServices({ shopId: authShopId, page: 1, limit: 10 }),
    queryFn: async () => {
      const response: ServiceResponse = await serviceApi.getShopServices(authShopId, {
        page: 1,
        limit: 10,
      });
      return response.data;
    },
    enabled: !!authShopId,
    staleTime: 5 * 60 * 1000,
  });

  // Service Detail Query
  const serviceDetailQuery = useQuery({
    queryKey: queryKeys.service(params.serviceId ?? ""),
    queryFn: async () => {
      const response: ServiceDetailResponse = await serviceApi.getService(params.serviceId!);
      return response.data;
    },
    enabled: !!params.serviceId,
    staleTime: 5 * 60 * 1000,
  });

  // Service Form Data (derived from auth store)
  const isQualified =
    userProfile?.operational_status === "subscription_qualified" ||
    userProfile?.operational_status === "rcg_qualified";

  const serviceFormData = {
    shopData: userProfile,
    shopId: userProfile?.shopId,
    isQualified,
  };

  return {
    servicesTabQuery,
    serviceDetailQuery,
    serviceFormData,
  };
}
