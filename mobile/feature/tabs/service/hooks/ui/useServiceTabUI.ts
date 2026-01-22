import { useState, useCallback } from "react";
import { ServiceData } from "@/interfaces/service.interface";
import { ServiceTab } from "../../constants";

export function useServiceTabUI() {
  const [activeTab, setActiveTab] = useState<ServiceTab>("Services");
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
