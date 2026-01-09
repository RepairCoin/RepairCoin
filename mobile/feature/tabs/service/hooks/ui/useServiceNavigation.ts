import { useCallback } from "react";
import { router } from "expo-router";
import { ServiceData } from "@/interfaces/service.interface";

export function useServiceNavigation() {
  const handleEdit = useCallback(
    (service: ServiceData | null, onClose?: () => void) => {
      onClose?.();
      if (service) {
        router.push({
          pathname: "/shop/service-form",
          params: {
            mode: "edit",
            serviceId: service.serviceId,
            data: JSON.stringify(service),
          },
        });
      }
    },
    []
  );

  const handleAddService = useCallback(() => {
    router.push("/shop/service-form");
  }, []);

  return {
    handleEdit,
    handleAddService,
  };
}
