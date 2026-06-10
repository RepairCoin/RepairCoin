"use client";

import React from "react";

export interface FilterTab {
  value: string;
  label: string;
}

interface FilterTabsProps {
  tabs: FilterTab[];
  activeTab: string;
  onTabChange: (value: string) => void;
  className?: string;
}

export const FilterTabs: React.FC<FilterTabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
  className = "",
}) => {
  return (
    <div
      className={`flex gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible ${className}`}
    >
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onTabChange(tab.value)}
          className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-lg border text-sm font-medium transition-colors duration-150 ${
            activeTab === tab.value
              ? "bg-yellow-400 text-gray-900 border-yellow-400"
              : "bg-[#1A1A1A] border-gray-800 text-gray-400 hover:bg-gray-800 hover:text-white"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export default FilterTabs;
