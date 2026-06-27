"use client";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import DashboardLayout from "@/components/ui/DashboardLayout";
import { AvailabilitySettings } from "@/components/shop/AvailabilitySettings";
import { useAuthStore } from "@/stores/authStore";

export default function ShopAvailabilityPage() {
  const router = useRouter();
  const userProfile = useAuthStore((s) => s.userProfile);
  const shopId = userProfile?.shopId;

  const handleTabChange = (tab: string) => {
    router.push(`/shop?tab=${tab}`);
  };

  return (
    <DashboardLayout
      userRole="shop"
      activeTab="settings"
      onTabChange={handleTabChange}
    >
      {shopId ? (
        <AvailabilitySettings shopId={shopId} />
      ) : (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#FFCC00]" />
          <span className="ml-3 text-gray-400">Loading...</span>
        </div>
      )}
    </DashboardLayout>
  );
}
