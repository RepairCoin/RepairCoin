import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { queryKeys } from "@/shared/config/queryClient";
import { serviceApi } from "@/feature/services/services/service.services";
import { useAppToast } from "@/shared/hooks";
import { useModalStore } from "@/shared/store/common.store";
import {
  ServiceResponse,
  ServiceDetailResponse,
  CreateServiceRequest,
  UpdateServiceData,
} from "@/feature/services/services/service.interface";
import { appointmentApi } from "@/feature/services/services/service.services";

// ============================================
// Shop Service Queries
// ============================================

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
    queryKey: ["shopServices", "infinite", shopId, filters],
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

// ============================================
// Availability Query
// ============================================

export function useShopAvailabilityWithConfigQuery(shopId?: string) {
  const { userProfile } = useAuthStore();
  const authShopId = userProfile?.shopId ?? "";
  const effectiveShopId = shopId ?? authShopId;

  return useQuery({
    queryKey: ["shopAvailability", effectiveShopId],
    queryFn: async () => {
      const [availability, timeSlotConfig] = await Promise.all([
        appointmentApi.getShopAvailability(effectiveShopId),
        appointmentApi.getTimeSlotConfig(),
      ]);

      const sorted = availability
        ? [...availability].sort((a, b) => a.dayOfWeek - b.dayOfWeek)
        : [];

      return {
        availability: sorted,
        timeSlotConfig: timeSlotConfig ?? null,
      };
    },
    enabled: !!effectiveShopId,
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================
// Service Mutations
// ============================================

export function useCreateServiceMutation() {
  const { showError } = useAppToast();

  return useMutation({
    mutationFn: async ({ serviceData }: { serviceData: CreateServiceRequest }) => {
      const response = await serviceApi.create(serviceData);
      return response.data;
    },
    onError: (error: any) => {
      console.error("Error creating service:", error);
      if (error?.response?.data?.code === "STRIPE_NOT_CONNECTED") {
        useModalStore.getState().setShowStripeConnectModal(true);
        return;
      }
      showError(`Failed to create service: ${error.message}`);
    },
  });
}

export function useUpdateServiceMutation() {
  const { showError } = useAppToast();

  return useMutation({
    mutationFn: async ({
      serviceId,
      serviceData,
    }: {
      serviceId: string;
      serviceData: UpdateServiceData;
    }) => {
      const response = await serviceApi.update(serviceId, serviceData);
      return response.data;
    },
    onError: (error: any) => {
      console.error("Error updating service:", error);
      if (error?.response?.data?.code === "STRIPE_NOT_CONNECTED") {
        useModalStore.getState().setShowStripeConnectModal(true);
        return;
      }
      showError(`Failed to update service: ${error.message}`);
    },
  });
}

export function useServiceToggleMutation() {
  const queryClient = useQueryClient();
  const { userProfile } = useAuthStore();
  const { mutateAsync: updateServiceMutation } = useUpdateServiceMutation();
  const shopId = userProfile?.shopId;

  const toggleServiceStatus = useCallback(
    async (serviceId: string, active: boolean) => {
      await updateServiceMutation({ serviceId, serviceData: { active } });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.shopServices(shopId!),
      });
    },
    [updateServiceMutation, queryClient, shopId]
  );

  return { toggleServiceStatus };
}

// ============================================
// Shop Reviews Query
// ============================================

export function useShopReviewsQuery() {
  return useQuery({
    queryKey: ["shopReviews"],
    queryFn: () => serviceApi.getShopReviews({ limit: 100 }),
  });
}

export function useShopReviewResponseMutation() {
  const { showError } = useAppToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reviewId, response }: { reviewId: string; response: string }) =>
      serviceApi.addShopResponse(reviewId, response),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shopReviews"] });
    },
    onError: (err: any) => {
      showError(err.message || "Failed to add response");
    },
  });
}
