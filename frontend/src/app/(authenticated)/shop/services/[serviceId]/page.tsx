"use client";

import { Suspense, useState, useEffect } from "react";
import { useParams } from "next/navigation";
import DashboardLayout from "@/components/ui/DashboardLayout";
import ServiceManagementClient from "@/components/shop/ServiceManagementClient";

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCC00] mx-auto"></div>
        <p className="mt-4 text-white">Loading service...</p>
      </div>
    </div>
  );
}

export default function ServiceManagementPage() {
  const params = useParams();
  const serviceId = params.serviceId as string;

  // We'll use "services" as the active tab since we're on a service detail page
  const handleTabChange = (tab: string) => {
    // If user clicks a sidebar tab, navigate to the main shop dashboard with that tab
    if (tab !== "service-detail") {
      window.location.href = `/shop?tab=${tab}`;
    }
  };

  return (
    <DashboardLayout
      userRole="shop"
      activeTab="services"
      onTabChange={handleTabChange}
    >
      <Suspense fallback={<LoadingFallback />}>
        <ServiceManagementClient serviceId={serviceId} />
      </Suspense>
    </DashboardLayout>
  );
}
