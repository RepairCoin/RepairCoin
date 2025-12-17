import { Alert } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/config/queryClient";
import { serviceApi } from "@/services/service.services";
import {
  CreateServiceRequest,
  ServiceData,
  ServiceFilters,
  ServiceResponse,
  UpdateServiceData,
  ServiceDetailResponse
} from "@/interfaces/service.interface";

export function useService() {
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
        Alert.alert("Failed to create service", error.message);
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
        Alert.alert("Failed to update service", error.message);
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
        Alert.alert("Service deleted successfully!");
      },
      onError: (error) => {
        console.error("Error deleting service:", error);
        Alert.alert("Failed to delete service", error.message);
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

  // ==================== FAVORITES ====================

  const useGetFavorites = (options?: { page?: number; limit?: number }) => {
    return useQuery({
      queryKey: queryKeys.serviceFavorites(options),
      queryFn: async () => {
        const response = await serviceApi.getFavorites(options);
        return response.data;
      },
      staleTime: 2 * 60 * 1000, // 2 minutes
    });
  };

  const useCheckFavorite = (serviceId: string) => {
    return useQuery({
      queryKey: queryKeys.serviceFavoriteCheck(serviceId),
      queryFn: async () => {
        const response = await serviceApi.checkFavorite(serviceId);
        return response.data.isFavorited;
      },
      enabled: !!serviceId,
      staleTime: 2 * 60 * 1000, // 2 minutes
    });
  };

  const useToggleFavorite = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation({
      mutationFn: async ({ serviceId, isFavorited }: { serviceId: string; isFavorited: boolean }) => {
        if (isFavorited) {
          return await serviceApi.removeFavorite(serviceId);
        } else {
          return await serviceApi.addFavorite(serviceId);
        }
      },
      // Optimistic update - update UI immediately
      onMutate: async ({ serviceId, isFavorited }) => {
        // Cancel any outgoing refetches
        await queryClient.cancelQueries({ queryKey: [...queryKeys.services(), 'favorites'] });

        // Snapshot the previous value
        const previousFavorites = queryClient.getQueryData(queryKeys.serviceFavorites());

        // Optimistically update the favorites list
        queryClient.setQueryData(queryKeys.serviceFavorites(), (old: ServiceData[] | undefined) => {
          if (!old) return old;
          if (isFavorited) {
            // Remove from favorites
            return old.filter((s: ServiceData) => s.serviceId !== serviceId);
          } else {
            // We don't have the full service data here, so just invalidate later
            return old;
          }
        });

        return { previousFavorites };
      },
      onError: (err, variables, context) => {
        // Rollback on error
        if (context?.previousFavorites) {
          queryClient.setQueryData(queryKeys.serviceFavorites(), context.previousFavorites);
        }
        console.error("Error toggling favorite:", err);
      },
      onSettled: () => {
        // Refetch after mutation completes (success or error)
        queryClient.invalidateQueries({
          queryKey: [...queryKeys.services(), 'favorites'],
          exact: false
        });
      },
    });

    const toggleFavorite = (serviceId: string, isFavorited: boolean) => {
      mutation.mutate({ serviceId, isFavorited });
    };

    return {
      toggleFavorite,
      isPending: mutation.isPending,
    };
  };

  return {
    useGetAllServicesQuery,
    useShopServicesQuery,
    useGetService,
    useGetTrendingServices,
    useCreateService,
    useUpdateService,
    useDeleteService,
    // Favorites
    useGetFavorites,
    useCheckFavorite,
    useToggleFavorite,
  };
}
