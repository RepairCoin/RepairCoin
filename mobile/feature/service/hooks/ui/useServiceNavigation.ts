import { useCallback } from "react";
import { router } from "expo-router";
import { goBack } from "expo-router/build/global-state/routing";
import { ServiceData } from "@/interfaces/service.interface";

export function useServiceNavigation() {
  const navigateBack = useCallback(() => {
    goBack();
  }, []);

  const navigateToSubscription = useCallback(() => {
    router.push("/shop/subscription");
  }, []);

  const navigateToEdit = useCallback((serviceData: ServiceData) => {
    router.push({
      pathname: "/shop/service-form",
      params: {
        mode: "edit",
        serviceId: serviceData.serviceId,
        data: JSON.stringify(serviceData),
      },
    });
  }, []);

  return {
    navigateBack,
    navigateToSubscription,
    navigateToEdit,
  };
}
