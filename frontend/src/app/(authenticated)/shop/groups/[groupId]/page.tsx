import { Suspense } from "react";
import GroupDetailsClient from "@/components/shop/groups/GroupDetailsClient";

// Loading component
function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCC00] mx-auto"></div>
        <p className="mt-4 text-white">Loading group details...</p>
      </div>
    </div>
  );
}

export default function GroupDetailsPage({ params }: { params: { groupId: string } }) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <GroupDetailsClient groupId={params.groupId} />
    </Suspense>
  );
}
