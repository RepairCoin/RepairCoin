import { useState, useCallback, useEffect } from "react";
import { useLocalSearchParams } from "expo-router";
import { CustomerServiceTab } from "@/feature/services/services/service.interface";
import { CUSTOMER_SERVICE_TABS } from "@/shared/constants/services";

export function useCustomerServiceTab() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const initialTab = (params.tab as CustomerServiceTab) || "Services";
  const [activeTab, setActiveTab] = useState<CustomerServiceTab>(initialTab);

  // When navigating to an already-mounted screen (router.navigate reuses the
  // instance), the initial useState won't re-run — sync the active tab to the
  // incoming `tab` param so deep links / quick actions still switch sub-tabs.
  useEffect(() => {
    if (params.tab && CUSTOMER_SERVICE_TABS.includes(params.tab as CustomerServiceTab)) {
      setActiveTab(params.tab as CustomerServiceTab);
    }
  }, [params.tab]);

  const handleTabChange = useCallback((tab: CustomerServiceTab) => {
    setActiveTab(tab);
  }, []);

  const getTabStyle = useCallback((tab: CustomerServiceTab, index: number) => {
    const isActive = activeTab === tab;
    let roundedClass = "";
    if (index === 0) roundedClass = "rounded-l-lg";
    else if (index === CUSTOMER_SERVICE_TABS.length - 1) roundedClass = "rounded-r-lg";

    return {
      containerClass: `flex-1 items-center justify-center ${
        isActive ? "bg-[#FFCC00]" : "bg-[#121212]"
      } ${roundedClass}`,
      textClass: `text-base font-bold ${isActive ? "text-black" : "text-gray-400"}`,
      isActive,
    };
  }, [activeTab]);

  return {
    activeTab,
    setActiveTab: handleTabChange,
    tabs: CUSTOMER_SERVICE_TABS,
    getTabStyle,
  };
}
