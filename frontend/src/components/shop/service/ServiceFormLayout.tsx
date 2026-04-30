"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  Home,
  ChevronRight,
  HeartHandshake,
} from "lucide-react";

/**
 * ServiceFormLayout
 *
 * Page-shell wrapper for the service create/edit pages. Renders the canonical
 * breadcrumb header (matching ServiceManagementClient) + the 2-column body
 * (form on left, sticky preview on right).
 *
 * Breadcrumb shape:
 *   Home > Services [> parentLabel] > pageIcon pageLabel
 *
 * `parentLabel` is optional and used only on the edit page where we want to
 * show the service name between Services and the trailing "Edit" leaf.
 *
 * Outer wrapper matches the detail page exactly (`min-h-screen py-8` +
 * `max-w-screen-2xl w-[96%] mx-auto`) so both routes feel like the same
 * surface.
 */

export interface ServiceFormLayoutProps {
  /** Trailing breadcrumb leaf — e.g. "Add Service" or "Edit". */
  pageLabel: string;
  /** Icon shown next to pageLabel. */
  pageIcon: React.ReactNode;
  /** Optional middle level — typically the service name on the edit page. */
  parentLabel?: string;
  /** Description rendered under the breadcrumb (light gray). */
  description?: string;
  /** Where the Services breadcrumb item links. Defaults to /shop?tab=services. */
  servicesHref?: string;
  /** Where the Home breadcrumb item links. Defaults to /shop?tab=overview. */
  homeHref?: string;
  /** Form column content. */
  form: React.ReactNode;
  /** Preview column content. */
  preview: React.ReactNode;
}

export const ServiceFormLayout: React.FC<ServiceFormLayoutProps> = ({
  pageLabel,
  pageIcon,
  parentLabel,
  description,
  servicesHref = "/shop?tab=services",
  homeHref = "/shop?tab=overview",
  form,
  preview,
}) => {
  const router = useRouter();

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-screen-2xl w-[96%] mx-auto">
        {/* Breadcrumb — canonical pattern (matches ServiceManagementClient) */}
        <div className="border-b border-[#303236] pb-4 mb-6">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2">
            <button
              onClick={() => router.push(homeHref)}
              className="p-1 rounded hover:bg-[#303236] transition-colors flex-shrink-0"
              title="Go to Overview"
            >
              <Home className="w-4 h-4 sm:w-5 sm:h-5 text-white hover:text-[#FFCC00] transition-colors" />
            </button>
            <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
            <button
              onClick={() => router.push(servicesHref)}
              className="flex items-center gap-1 sm:gap-1.5 hover:text-[#FFCC00] transition-colors flex-shrink-0"
            >
              <HeartHandshake className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
              <span className="text-sm sm:text-base font-medium text-gray-400 hidden sm:inline">
                Services
              </span>
            </button>
            {parentLabel && (
              <>
                <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm sm:text-base font-medium text-white truncate max-w-[120px] sm:max-w-[200px] md:max-w-none">
                  {parentLabel}
                </span>
              </>
            )}
            <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
            <span className="text-[#FFCC00] flex-shrink-0 inline-flex items-center">
              {pageIcon}
            </span>
            <span className="text-sm sm:text-base font-medium text-[#FFCC00] flex-shrink-0">
              {pageLabel}
            </span>
          </div>
          {description && (
            <p className="text-xs sm:text-sm text-[#ddd]">{description}</p>
          )}
        </div>

        {/* 2-column body */}
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
          <div>{form}</div>
          <div>{preview}</div>
        </div>
      </div>
    </div>
  );
};
