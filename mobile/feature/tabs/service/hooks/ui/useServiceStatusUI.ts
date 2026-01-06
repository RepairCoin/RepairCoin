import { useState, useCallback } from "react";
import { Alert } from "react-native";
import { ServiceData } from "@/interfaces/service.interface";
import { useServiceMutations } from "../mutations";

export function useServiceStatusUI() {
  const { toggleServiceStatus } = useServiceMutations();
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
        await toggleServiceStatus(service.serviceId, value);

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
    [toggleServiceStatus, isUpdating]
  );

  return {
    isUpdating,
    handleToggleStatus,
  };
}
