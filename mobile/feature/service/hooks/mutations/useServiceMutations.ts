import { useMutation } from "@tanstack/react-query";
import { serviceApi } from "@/shared/services/service.services";
import { useAppToast } from "@/shared/hooks";
import {
  CreateServiceRequest,
  UpdateServiceData,
} from "@/shared/interfaces/service.interface";

export function useCreateServiceMutation() {
  const { showError } = useAppToast();

  return useMutation({
    mutationFn: async ({ serviceData }: { serviceData: CreateServiceRequest }) => {
      const response = await serviceApi.create(serviceData);
      return response.data;
    },
    onError: (error: any) => {
      console.error("Error creating service:", error);
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
      showError(`Failed to update service: ${error.message}`);
    },
  });
}
