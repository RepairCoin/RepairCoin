import { Suspense } from "react";
import ShopGroupsClient from "@/components/shop/groups/ShopGroupsClient";

// Loading component
function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCC00] mx-auto"></div>
        <p className="mt-4 text-white">Loading shop groups...</p>
      </div>
    </div>
  );
}

export default function ShopGroupsPage() {
  console.log("📄 ShopGroupsPage rendering");
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ShopGroupsClient />
    </Suspense>
  );
}
