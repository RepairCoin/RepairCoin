import { Alert } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { serviceApi } from "@/shared/services/service.services";
import {
  CreateServiceRequest,
  UpdateServiceData,
} from "@/shared/interfaces/service.interface";

export function useCreateServiceMutation() {
  return useMutation({
    mutationFn: async ({ serviceData }: { serviceData: CreateServiceRequest }) => {
      const response = await serviceApi.create(serviceData);
      return response.data;
    },
    onError: (error: any) => {
      console.error("Error creating service:", error);
      Alert.alert("Failed to create service", error.message);
    },
  });
}

export function useUpdateServiceMutation() {
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
      Alert.alert("Failed to update service", error.message);
    },
  });
}
