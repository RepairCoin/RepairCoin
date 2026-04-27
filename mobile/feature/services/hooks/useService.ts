import { useMutation, useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { queryKeys } from "@/shared/config/queryClient";
import { serviceApi } from "../services/service.services";
import { useAppToast } from "@/shared/hooks/useAppToast";
import {
  CreateServiceRequest,
  ServiceFilters,
  ServiceResponse,
  UpdateServiceData,
  ServiceDetailResponse,
} from "@/shared/interfaces/service.interface";

export function useService() {
  const { showSuccess, showError } = useAppToast();
  const useGetAllServicesQuery = (filters?: ServiceFilters) => {
    return useQuery({
      queryKey: queryKeys.serviceList(filters),
      queryFn: async () => {
        const response: ServiceResponse = await serviceApi.getAll(filters);
        return response.data;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };

  const useInfiniteServicesQuery = (filters?: Omit<ServiceFilters, 'page'>) => {
    return useInfiniteQuery({
      queryKey: ['services', 'infinite', filters],
      queryFn: async ({ pageParam = 1 }) => {
        const response = await serviceApi.getAll({ ...filters, page: pageParam, limit: 10 });
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
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };

  const useShopServicesQuery = (filters: ServiceFilters) => {
    const shopId = filters.shopId ?? "";
    return useQuery({
      queryKey: queryKeys.shopServices({ shopId, page: filters.page, limit: filters.limit }),
      queryFn: async () => {
        const response: ServiceResponse = await serviceApi.getShopServices(shopId, { page: filters.page, limit: filters.limit });
        return response.data;
      },
      enabled: !!filters.shopId,
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };

  const useGetService = (serviceId: string) => {
    return useQuery({
      queryKey: queryKeys.service(serviceId),
      queryFn: async () => {
        const response: ServiceDetailResponse =
          await serviceApi.getService(serviceId);
        return response.data;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };

  const useCreateService = () => {
    return useMutation({
      mutationFn: async ({
        serviceData,
      }: {
        serviceData: CreateServiceRequest;
      }) => {
        const response: any = await serviceApi.create(serviceData);
        return response.data;
      },
      onError: (error: any) => {
        console.error("Error creating service:", error);
        showError(`Failed to create service: ${error.message}`);
      },
    });
  };

  const useUpdateService = () => {
    return useMutation({
      mutationFn: async ({
        serviceId,
        serviceData,
      }: {
        serviceId: string;
        serviceData: UpdateServiceData;
      }) => {
        const response: any = await serviceApi.update(serviceId, serviceData);
        return response.data;
      },
      onError: (error: any) => {
        console.error("Error updating service:", error);
        showError(`Failed to update service: ${error.message}`);
      },
    });
  };

  const useDeleteService = () => {
    return useMutation({
      mutationFn: async ({ serviceId }: { serviceId: string }) => {
        const response: any = await serviceApi.delete(serviceId);
        return response.data;
      },
      onSuccess: () => {
        showSuccess("Service deleted successfully!");
      },
      onError: (error: any) => {
        console.error("Error deleting service:", error);
        showError(`Failed to delete service: ${error.message}`);
      },
    });
  };

  const useGetTrendingServices = (options?: {
    limit?: number;
    days?: number;
  }) => {
    return useQuery({
      queryKey: queryKeys.serviceTrending(options),
      queryFn: async () => {
        const response: any =
          await serviceApi.getTrendingServices(options);
        return response.data;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };

  const useGetRecentlyViewed = (options?: { limit?: number }) => {
    return useQuery({
      queryKey: queryKeys.serviceRecentlyViewed(options),
      queryFn: async () => {
        const response: any = await serviceApi.getRecentlyViewed(options);
        return response.data;
      },
      staleTime: 2 * 60 * 1000, // 2 minutes
    });
  };

  const useTrackRecentlyViewed = () => {
    return useMutation({
      mutationFn: async (serviceId: string) => {
        const response: any = await serviceApi.trackRecentlyViewed(serviceId);
        return response;
      },
    });
  };

  const useGetSimilarServices = (
    serviceId: string,
    options?: { limit?: number }
  ) => {
    return useQuery({
      queryKey: queryKeys.serviceSimilar(serviceId, options),
      queryFn: async () => {
        const response: any = await serviceApi.getSimilarServices(
          serviceId,
          options
        );
        return response.data;
      },
      enabled: !!serviceId,
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };

  return {
    useGetAllServicesQuery,
    useInfiniteServicesQuery,
    useShopServicesQuery,
    useGetService,
    useGetTrendingServices,
    useGetRecentlyViewed,
    useTrackRecentlyViewed,
    useGetSimilarServices,
    useCreateService,
    useUpdateService,
    useDeleteService,
  };
}
