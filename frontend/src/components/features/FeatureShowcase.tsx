"use client";

import React from "react";
import Image from "next/image";
import { m, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";

export interface FeatureShowcaseProps {
  /** Small uppercase label shown next to the badge icon (e.g. "AI Assistant"). */
  badge: string;
  /** Icon rendered inside the yellow badge square. */
  badgeIcon?: React.ReactNode;
  title: React.ReactNode;
  description: string;
  bullets?: string[];
  /** Screenshot / illustration shown on the opposite side of the copy. */
  image: string;
  imageAlt?: string;
  /** When true, the image sits on the left and copy on the right (for alternating rows). */
  reverse?: boolean;
}

export default function FeatureShowcase({
  badge,
  badgeIcon,
  title,
  description,
  bullets,
  image,
  imageAlt = "",
  reverse = false,
}: FeatureShowcaseProps) {
  const prefersReducedMotion = useReducedMotion();

  const fade = (delay = 0) => ({
    initial: prefersReducedMotion ? undefined : { opacity: 0, y: 24 },
    whileInView: prefersReducedMotion ? undefined : { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-80px" },
    transition: prefersReducedMotion
      ? undefined
      : { duration: 0.6, delay, ease: "easeOut" as const },
  });

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-8">
      <div
        className={`grid grid-cols-1 gap-10 lg:gap-16 items-start ${
          reverse ? "lg:grid-cols-[2fr_1fr]" : "lg:grid-cols-[1fr_2fr]"
        }`}
      >
        {/* Copy */}
        <m.div {...fade()} className={reverse ? "lg:order-2" : "lg:order-1"}>
          {/* Badge */}
          <div className="inline-flex items-center gap-2.5 mb-5">
            <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#FFCC00] text-black">
              {badgeIcon}
            </span>
            <span className="text-[#FFCC00] font-semibold text-sm tracking-[0.15em] uppercase">
              {badge}
            </span>
          </div>

          {/* Title */}
          <h2 className="text-3xl md:text-4xl font-bold text-white leading-snug mb-4">
            {title}
          </h2>

          {/* Description */}
          <p className="text-base md:text-lg text-gray-300 leading-relaxed max-w-xl">
            {description}
          </p>

          {/* Bullets */}
          {bullets && bullets.length > 0 && (
            <ul className="space-y-4 mt-8">
              {bullets.map((bullet) => (
                <li key={bullet} className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#FFCC00] text-black shrink-0">
                    <Check className="w-3.5 h-3.5" strokeWidth={3} />
                  </span>
                  <span className="text-white">{bullet}</span>
                </li>
              ))}
            </ul>
          )}
        </m.div>

        {/* Image */}
        <m.div {...fade(0.15)} className={reverse ? "lg:order-1" : "lg:order-2"}>
          <Image
            src={image}
            alt={imageAlt}
            width={1100}
            height={720}
            className="w-full h-auto rounded-2xl border border-[rgba(83,83,83,0.25)]"
          />
        </m.div>
      </div>
    </section>
  );
}
