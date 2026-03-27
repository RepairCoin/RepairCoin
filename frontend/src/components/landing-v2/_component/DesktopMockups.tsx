"use client";

import Image from "next/image";
import { m } from "framer-motion";
import type { MotionValue } from "framer-motion";

interface DesktopMockupsProps {
  prefersReducedMotion: boolean | null;
  macbookY: MotionValue<number>;
  iphoneY: MotionValue<number>;
  macbookClassName: string;
  iphoneClassName: string;
}

export function DesktopMockups({
  prefersReducedMotion,
  macbookY,
  iphoneY,
  macbookClassName,
  iphoneClassName,
}: DesktopMockupsProps) {
  return (
    <>
      <m.div
        initial={prefersReducedMotion ? undefined : { opacity: 0, x: 60 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1, x: 0 }}
        transition={
          prefersReducedMotion
            ? undefined
            : { duration: 0.8, delay: 0.4, ease: "easeOut" as const }
        }
        style={prefersReducedMotion ? undefined : { y: macbookY }}
        className={macbookClassName}
      >
        <Image
          src="/img/landingv2/MacBookAir.png"
          alt="RepairCoin Dashboard on MacBook"
          width={500}
          height={1280}
          className="w-full object-contain"
          priority
        />
      </m.div>
      <m.div
        initial={prefersReducedMotion ? undefined : { opacity: 0, y: 40 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        transition={
          prefersReducedMotion
            ? undefined
            : { duration: 0.8, delay: 0.6, ease: "easeOut" as const }
        }
        style={prefersReducedMotion ? undefined : { y: iphoneY }}
        className={iphoneClassName}
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
    </>
  );
}
