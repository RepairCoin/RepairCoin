import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { useService } from "@/hooks/service/useService";
import { queryKeys } from "@/config/queryClient";
import { ServiceData } from "@/interfaces/service.interface";

export function useServiceMutation() {
  const queryClient = useQueryClient();
  const { userProfile } = useAuthStore();
  const { useUpdateService } = useService();
  const { mutateAsync: updateServiceMutation } = useUpdateService();

  const shopId = userProfile?.shopId;
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggleStatus = useCallback(
    async (
      service: ServiceData | null,
      value: boolean,
      onSuccess?: (updatedService: ServiceData) => void
    ) => {
      if (!service || isUpdating) return;

      setIsUpdating(true);
      try {
        await updateServiceMutation({
          serviceId: service.serviceId,
          serviceData: { active: value },
        });

        // Invalidate and refetch services list
        await queryClient.invalidateQueries({
          queryKey: queryKeys.shopServices(shopId!),
        });

        // Callback with updated service
        onSuccess?.({ ...service, active: value });

        Alert.alert(
          "Success",
          `Service ${value ? "activated" : "deactivated"} successfully`
        );
      } catch (error) {
        console.error("Failed to update service status:", error);
        Alert.alert("Error", "Failed to update service status");
      } finally {
        setIsUpdating(false);
      }
    },
    [isUpdating, updateServiceMutation, queryClient, shopId]
  );

  return {
    isUpdating,
    handleToggleStatus,
  };
}
