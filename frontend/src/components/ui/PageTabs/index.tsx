"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [arrowsVisible, setArrowsVisible] = useState(false);

  const updateScrollState = useCallback(() => {
    const root = scrollRef.current;
    if (!root) return;
    const { scrollLeft, scrollWidth, clientWidth } = root;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
  }, []);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    updateScrollState();
    root.addEventListener("scroll", updateScrollState, { passive: true });

    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(root);

    const onWheel = (e: WheelEvent) => {
      if (root.scrollWidth <= root.clientWidth) return;
      const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (delta === 0) return;
      e.preventDefault();
      root.scrollBy({ left: delta, behavior: "auto" });
    };
    root.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      root.removeEventListener("scroll", updateScrollState);
      root.removeEventListener("wheel", onWheel);
      resizeObserver.disconnect();
    };
  }, [updateScrollState]);

  const scrollByDirection = (direction: "left" | "right") => {
    const root = scrollRef.current;
    if (!root) return;
    const distance = root.clientWidth * 0.8;
    root.scrollBy({
      left: direction === "left" ? -distance : distance,
      behavior: "smooth",
    });
  };

  const arrowBaseClass =
    "absolute top-1/2 -translate-y-1/2 z-10 h-8 w-8 flex items-center justify-center rounded-full bg-[#1A1A1A]/90 border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 shadow-lg backdrop-blur-sm transition-opacity duration-200";

  return (
    <div
      className={cn("relative group", className)}
      onMouseEnter={() => setArrowsVisible(true)}
      onMouseLeave={() => setArrowsVisible(false)}
      onTouchStart={() => setArrowsVisible(true)}
      onTouchEnd={() => setArrowsVisible(false)}
      onTouchCancel={() => setArrowsVisible(false)}
    >
      <div
        ref={scrollRef}
        className={cn(
          "flex gap-2 overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0 sm:flex-wrap",
          styles.hideScrollbar
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

      <button
        type="button"
        onClick={() => scrollByDirection("left")}
        aria-label="Scroll tabs left"
        aria-hidden={!canScrollLeft || !arrowsVisible}
        tabIndex={canScrollLeft && arrowsVisible ? 0 : -1}
        className={cn(
          arrowBaseClass,
          "left-0",
          canScrollLeft && arrowsVisible
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={() => scrollByDirection("right")}
        aria-label="Scroll tabs right"
        aria-hidden={!canScrollRight || !arrowsVisible}
        tabIndex={canScrollRight && arrowsVisible ? 0 : -1}
        className={cn(
          arrowBaseClass,
          "right-0",
          canScrollRight && arrowsVisible
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

export default PageTabs;
