import { Alert } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { queryKeys } from "@/config/queryClient";
import { serviceApi } from "@/services/service.services";
import {
  CreateServiceRequest,
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

  const useShopServicesQuery = (options?: {
    page?: number;
    limit?: number;
  }) => {
    const { userProfile } = useAuthStore();
    const shopId = userProfile?.shopId;

    return useQuery({
      queryKey: queryKeys.shopServices(shopId!, options),
      queryFn: async () => {
        const response: ServiceResponse = await serviceApi.getShopServices(
          shopId!,
          options
        );
        return response.data;
      },
      enabled: !!shopId,
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
  }

  return {
    useGetAllServicesQuery,
    useShopServicesQuery,
    useGetService,
    useGetTrendingServices,
    useCreateService,
    useUpdateService,
    useDeleteService,
  };
}
