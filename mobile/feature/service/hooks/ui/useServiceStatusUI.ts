import { useState, useCallback } from "react";
import { ServiceData } from "@/shared/interfaces/service.interface";
import { useAppToast } from "@/shared/hooks";
import { useServiceToggleMutation } from "../mutations";

export function useServiceStatusUI() {
  const { toggleServiceStatus } = useServiceToggleMutation();
  const [isUpdating, setIsUpdating] = useState(false);
  const { showSuccess, showError } = useAppToast();

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

        showSuccess(`Service ${value ? "activated" : "deactivated"} successfully`);
      } catch (error) {
        console.error("Failed to update service status:", error);
        showError("Failed to update service status");
      } finally {
        setIsUpdating(false);
      }
    },
    [toggleServiceStatus, isUpdating, showSuccess, showError]
  );

  return {
    isUpdating,
    handleToggleStatus,
  };
}
