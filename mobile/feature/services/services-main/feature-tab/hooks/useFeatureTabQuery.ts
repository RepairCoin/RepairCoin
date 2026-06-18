import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { queryKeys } from "@/shared/config/queryClient";
import { serviceApi } from "@/feature/services/services/service.services";
import { useAppToast } from "@/shared/hooks";
import apiClient from "@/shared/utilities/axios";
import {
  ServiceData,
  ServiceFilters,
  ServiceResponse,
  ServiceDetailResponse,
} from "@/feature/services/services/service.interface";
import { ReviewData } from "@/feature/services/services/service.interface";

// ============================================
// Service Queries (Customer browsing)
// ============================================

export function useAllServicesQuery(filters?: ServiceFilters) {
  return useQuery({
    queryKey: queryKeys.serviceList(filters),
    queryFn: async () => {
      const response: ServiceResponse = await serviceApi.getAll(filters);
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useInfiniteServicesQuery(filters?: Omit<ServiceFilters, "page">) {
  return useInfiniteQuery({
    queryKey: ["services", "infinite", filters],
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
    staleTime: 5 * 60 * 1000,
  });
}

export function useShopServicesQuery(filters: ServiceFilters) {
  const shopId = filters.shopId ?? "";
  return useQuery({
    queryKey: queryKeys.shopServices({ shopId, page: filters.page, limit: filters.limit }),
    queryFn: async () => {
      const response: ServiceResponse = await serviceApi.getShopServices(shopId, {
        page: filters.page,
        limit: filters.limit,
      });
      return response.data;
    },
    enabled: !!filters.shopId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useGetServiceQuery(serviceId: string) {
  return useQuery({
    queryKey: queryKeys.service(serviceId),
    queryFn: async () => {
      const response: ServiceDetailResponse = await serviceApi.getService(serviceId);
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useGetTrendingServicesQuery(options?: { limit?: number; days?: number }) {
  return useQuery({
    queryKey: queryKeys.serviceTrending(options),
    queryFn: async () => {
      const response: any = await serviceApi.getTrendingServices(options);
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useGetRecentlyViewedQuery(options?: { limit?: number }) {
  const { accessToken } = useAuthStore();
  return useQuery({
    queryKey: queryKeys.serviceRecentlyViewed(options),
    queryFn: async () => {
      const response: any = await serviceApi.getRecentlyViewed(options);
      return response.data;
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!accessToken,
  });
}

export function useGetSimilarServicesQuery(serviceId: string, options?: { limit?: number }) {
  return useQuery({
    queryKey: queryKeys.serviceSimilar(serviceId, options),
    queryFn: async () => {
      const response: any = await serviceApi.getSimilarServices(serviceId, options);
      return response.data;
    },
    enabled: !!serviceId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useTrackRecentlyViewedMutation() {
  return useMutation({
    mutationFn: async (serviceId: string) => {
      const response: any = await serviceApi.trackRecentlyViewed(serviceId);
      return response;
    },
  });
}

export function useDeleteServiceMutation() {
  const { showSuccess, showError } = useAppToast();
  const queryClient = useQueryClient();
  const { userProfile } = useAuthStore();
  const shopId = userProfile?.shopId;

  return useMutation({
    mutationFn: async ({ serviceId }: { serviceId: string }) => {
      const response: any = await serviceApi.delete(serviceId);
      return response.data;
    },
    onSuccess: () => {
      // Partial key match invalidates all pages/filters for this shop's services
      if (shopId) {
        queryClient.invalidateQueries({
          queryKey: [...queryKeys.services(), 'shop', shopId],
        });
      }
      showSuccess("Service deleted successfully!");
    },
    onError: (error: any) => {
      console.error("Error deleting service:", error);
      showError(`Failed to delete service: ${error.message}`);
    },
  });
}

// ============================================
// Favorite Queries & Mutations
// ============================================

export function useGetFavoritesQuery(options?: { page?: number; limit?: number }) {
  const { accessToken } = useAuthStore();
  return useQuery({
    queryKey: queryKeys.serviceFavorites(options),
    queryFn: async () => {
      const response = await serviceApi.getFavorites(options);
      return response.data;
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!accessToken,
  });
}

export function useCheckFavoriteQuery(serviceId: string) {
  return useQuery({
    queryKey: queryKeys.serviceFavoriteCheck(serviceId),
    queryFn: async () => {
      const response = await serviceApi.checkFavorite(serviceId);
      return response.data.isFavorited;
    },
    enabled: !!serviceId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useToggleFavoriteMutation() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      serviceId,
      isFavorited,
    }: {
      serviceId: string;
      isFavorited: boolean;
    }) => {
      if (isFavorited) {
        return await serviceApi.removeFavorite(serviceId);
      } else {
        return await serviceApi.addFavorite(serviceId);
      }
    },
    onMutate: async ({ serviceId, isFavorited }) => {
      await queryClient.cancelQueries({
        queryKey: [...queryKeys.services(), "favorites"],
      });

      const previousFavorites = queryClient.getQueryData(queryKeys.serviceFavorites());

      queryClient.setQueryData(
        queryKeys.serviceFavorites(),
        (old: ServiceData[] | undefined) => {
          if (!old) return old;
          if (isFavorited) {
            return old.filter((s: ServiceData) => s.serviceId !== serviceId);
          }
          return old;
        }
      );

      return { previousFavorites };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousFavorites) {
        queryClient.setQueryData(queryKeys.serviceFavorites(), context.previousFavorites);
      }
      console.error("Error toggling favorite:", _err);
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.services(), "favorites"],
        exact: false,
      });
    },
  });

  const toggleFavorite = (serviceId: string, isFavorited: boolean) => {
    mutation.mutate({ serviceId, isFavorited });
  };

  return { toggleFavorite, isPending: mutation.isPending };
}

// ============================================
// Review Queries & Mutations
// ============================================

export function useServiceReviewsQuery(serviceId: string) {
  return useQuery({
    queryKey: queryKeys.serviceReviews(serviceId),
    queryFn: () => serviceApi.getServiceReviews(serviceId, { limit: 50 }),
    enabled: !!serviceId,
  });
}

export function useSubmitReviewMutation() {
  const { showSuccess, showError, showWarning } = useAppToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { orderId: string; rating: number; comment: string; images?: string[] }) => {
      const response = await apiClient.post("/services/reviews", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.appointments() });
      showSuccess("Thank you for your feedback!");
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || "Failed to submit review. Please try again.";
      showError(message);
    },
  });
}
