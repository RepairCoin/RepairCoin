"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import PosTerminal from "@/components/shop/pos/PosTerminal";

/**
 * The register itself, deliberately full-screen and without the dashboard sidebar — the setup
 * checks live on the Point of Sale tab, the selling screen wants the whole display.
 */
export default function PosPage() {
  const router = useRouter();
  const exit = () => router.push("/shop?tab=pos");

  return (
    <div className="min-h-screen bg-[#191919] pb-16 pt-6">
      <div className="mx-auto w-full max-w-[1400px] px-4">
        <button
          type="button"
          onClick={exit}
          className="inline-flex cursor-pointer items-center gap-3 text-sm text-white transition-colors hover:text-[#FFCC00]"
        >
          <ArrowLeft className="h-4 w-4 text-[#FFCC00]" />
          Close register
        </button>
      </div>
      <PosTerminal onExit={exit} />
    </div>
  );
}
