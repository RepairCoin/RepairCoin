"use client";

import { useParams, useRouter } from "next/navigation";
import { Home, ChevronRight, UsersIcon, User } from "lucide-react";
import DashboardLayout from "@/components/ui/DashboardLayout";
import { CustomerProfileView } from "@/components/shop/customers/profile";
import { useAuthStore } from "@/stores/authStore";

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCC00] mx-auto"></div>
        <p className="mt-4 text-white">Loading customer...</p>
      </div>
    </div>
  );
}

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function CustomerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const address = params.address as string;
  const userProfile = useAuthStore((state) => state.userProfile);
  const shopId = userProfile?.shopId;

  const handleTabChange = (tab: string) => {
    if (tab !== "customers") {
      window.location.href = `/shop?tab=${tab}`;
    }
  };

  return (
    <DashboardLayout
      userRole="shop"
      activeTab="customers"
      onTabChange={handleTabChange}
    >
      <div className="min-h-screen py-8">
        <div className="max-w-screen-2xl w-[96%] mx-auto">
          {/* Breadcrumb */}
          <div className="border-b border-[#303236] pb-4 mb-6">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2">
              <button
                onClick={() => router.push("/shop?tab=overview")}
                className="p-1 rounded hover:bg-[#303236] transition-colors flex-shrink-0"
                title="Go to Overview"
              >
                <Home className="w-4 h-4 sm:w-5 sm:h-5 text-white hover:text-[#FFCC00] transition-colors" />
              </button>
              <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
              <button
                onClick={() => router.push("/shop?tab=customers")}
                className="flex items-center gap-1 sm:gap-1.5 hover:text-[#FFCC00] transition-colors flex-shrink-0"
              >
                <UsersIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                <span className="text-sm sm:text-base font-medium text-gray-400 hidden sm:inline">Customers</span>
              </button>
              <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
              <span className="text-[#FFCC00] flex-shrink-0">
                <User className="w-4 h-4 sm:w-5 sm:h-5 inline mr-1" />
              </span>
              <span className="text-sm sm:text-base font-medium text-[#FFCC00] flex-shrink-0">{truncateAddress(address)}</span>
            </div>
            <p className="text-xs sm:text-sm text-[#ddd]">
              View customer details, transaction history, and RCN activity
            </p>
          </div>

          {shopId ? (
            <CustomerProfileView
              customerAddress={address}
              shopId={shopId}
              onBack={() => router.back()}
            />
          ) : (
            <LoadingFallback />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
