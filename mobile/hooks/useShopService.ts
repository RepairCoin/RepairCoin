import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ServiceResponse,
  createService,
  CreateServiceRequest,
  getShopServices,
  updateService,
  deleteService,
  UpdateServiceData,
} from "@/services/ShopServices";
import { useAuthStore } from "@/store/auth.store";
import { Alert } from "react-native";

export const useShopServices = (options?: {
  page?: number;
  limit?: number;
}) => {
  const { userProfile } = useAuthStore();
  const shopId = userProfile?.shopId;

  return useQuery({
    queryKey: ["shopServices", shopId, options],
    queryFn: async () => {
      const response: ServiceResponse = await getShopServices(shopId!, options);
      return response.data;
    },
    enabled: !!shopId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCreateService = () => {
  return useMutation({
    mutationFn: async ({ serviceData }: { serviceData: CreateServiceRequest }) => {
      const response: any = await createService(serviceData);
      return response.data;
    },
    onError: (error: any) => {
      console.error("Error creating service:", error);
      Alert.alert("Failed to create service", error.message);
    },
  });
};

export const useUpdateService = () => {
  return useMutation({
    mutationFn: async ({
      serviceId,
      serviceData,
    }: {
      serviceId: string;
      serviceData: UpdateServiceData;
    }) => {
      const response: any = await updateService(serviceId, serviceData);
      return response.data;
    },
    onError: (error: any) => {
      console.error("Error updating service:", error);
      Alert.alert("Failed to update service", error.message);
    },
  });
};

export const useDeleteService = () => {
  return useMutation({
    mutationFn: async ({ serviceId }: { serviceId: string }) => {
      const response: any = await deleteService(serviceId);
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
