import { useState, useCallback } from "react";
import { useLocalSearchParams } from "expo-router";
import { ServiceData } from "@/feature/services/services/service.interface";
import { ServiceTab, SERVICE_TABS } from "@/shared/constants/services";

export function useServiceTabUI() {
  // Allow deep-linking straight to a tab, e.g. /shop/tabs/service?tab=Booking
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const initialTab: ServiceTab = SERVICE_TABS.includes(tab as ServiceTab)
    ? (tab as ServiceTab)
    : "Services";
  const [activeTab, setActiveTab] = useState<ServiceTab>(initialTab);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceData | null>(
    null
  );

  const openActionModal = useCallback((service: ServiceData) => {
    setSelectedService(service);
    setActionModalVisible(true);
  }, []);

  const closeActionModal = useCallback(() => {
    setActionModalVisible(false);
  }, []);

  const updateSelectedService = useCallback((service: ServiceData) => {
    setSelectedService(service);
  }, []);

  return {
    // Tab state
    activeTab,
    setActiveTab,
    // Modal state
    actionModalVisible,
    selectedService,
    openActionModal,
    closeActionModal,
    setActionModalVisible,
    setSelectedService,
    updateSelectedService,
  };
}
