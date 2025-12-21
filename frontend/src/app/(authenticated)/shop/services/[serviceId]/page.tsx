import { Suspense } from "react";
import ServiceManagementClient from "@/components/shop/ServiceManagementClient";

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCC00] mx-auto"></div>
        <p className="mt-4 text-white">Loading service...</p>
      </div>
    </div>
  );
}

export default async function ServiceManagementPage({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = await params;
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ServiceManagementClient serviceId={serviceId} />
    </Suspense>
  );
}
