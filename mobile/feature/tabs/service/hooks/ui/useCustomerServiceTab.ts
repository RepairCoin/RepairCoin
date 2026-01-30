import { useState, useCallback } from "react";
import { CustomerServiceTab } from "../../types";
import { CUSTOMER_SERVICE_TABS } from "../../constants";

export function useCustomerServiceTab() {
  const [activeTab, setActiveTab] = useState<CustomerServiceTab>("Services");

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
