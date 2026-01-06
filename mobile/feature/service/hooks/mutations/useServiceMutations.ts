import { Alert } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { serviceApi } from "@/services/service.services";
import {
  CreateServiceRequest,
  UpdateServiceData,
} from "@/interfaces/service.interface";

export function useServiceMutations() {
  // Create service mutation
  const createServiceMutation = useMutation({
    mutationFn: async ({ serviceData }: { serviceData: CreateServiceRequest }) => {
      const response = await serviceApi.create(serviceData);
      return response.data;
    },
    onError: (error: any) => {
      console.error("Error creating service:", error);
      Alert.alert("Failed to create service", error.message);
    },
  });

  // Update service mutation
  const updateServiceMutation = useMutation({
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

  return {
    createServiceMutation,
    updateServiceMutation,
  };
}
