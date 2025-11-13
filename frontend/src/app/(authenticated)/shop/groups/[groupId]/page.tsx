import { Suspense } from "react";
import GroupDetailsClient from "@/components/shop/groups/GroupDetailsClient";

// Loading component
function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCC00] mx-auto"></div>
        <p className="mt-4 text-white">Loading affiliate group details...</p>
      </div>
    </div>
  );
}

export default async function AffiliateGroupDetailsPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  return (
    <Suspense fallback={<LoadingFallback />}>
      <GroupDetailsClient groupId={groupId} />
    </Suspense>
  );
}
