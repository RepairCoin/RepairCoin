"use client";

import Image from "next/image";
import { m } from "framer-motion";

interface MobileMockupsProps {
  fadeUp: (delay: number) => Record<string, unknown>;
}

export function MobileMockups({ fadeUp }: MobileMockupsProps) {
  return (
    <m.div
      {...fadeUp(0.5)}
      className="flex-1 min-h-0 flex items-center justify-center w-full"
    >
      <Image
        src="/img/landingv2/iPhone13.png"
        alt="RepairCoin Mobile App"
        width={300}
        height={1280}
        className="object-contain"
        priority
      />
    </m.div>
  );
}
