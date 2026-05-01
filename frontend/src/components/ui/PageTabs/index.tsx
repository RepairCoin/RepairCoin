"use client";

import { useEffect, useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import styles from "./PageTabs.module.css";

export interface PageTab<T extends string = string> {
  /** Stable identifier for the tab. */
  key: T;
  /** Visible label. */
  label: string;
  /** Lucide icon shown before the label. */
  icon: LucideIcon;
  /** Show a small red dot badge after the label. */
  hasBadge?: boolean;
}

interface PageTabsProps<T extends string = string> {
  tabs: PageTab<T>[];
  activeTab: T;
  onTabChange: (key: T) => void;
  className?: string;
}

export function PageTabs<T extends string = string>({
  tabs,
  activeTab,
  onTabChange,
  className = "",
}: PageTabsProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    const onWheel = (e: WheelEvent) => {
      if (root.scrollWidth <= root.clientWidth) return;
      const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (delta === 0) return;
      e.preventDefault();
      root.scrollBy({ left: delta, behavior: "auto" });
    };

    root.addEventListener("wheel", onWheel, { passive: false });
    return () => root.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div
      ref={scrollRef}
      className={cn(
        "flex gap-2 overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0 sm:flex-wrap",
        styles.hideScrollbar,
        className
      )}
      role="tablist"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.key)}
            className={`relative flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 ${
              isActive
                ? "bg-white text-black"
                : "bg-[#1A1A1A] text-gray-400 border border-gray-800 hover:border-gray-600"
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{tab.label}</span>
            {tab.hasBadge && (
              <span className="w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}

export default PageTabs;
