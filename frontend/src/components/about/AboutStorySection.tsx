"use client";

import React from "react";
import Image from "next/image";
import AnimateOnScroll from "@/components/motion/AnimateOnScroll";

export interface AboutStorySectionProps {
  /** Uppercase label shown next to the yellow badge icon. */
  badge: string;
  /** Icon rendered inside the yellow badge square. */
  badgeIcon: React.ReactNode;
  title: React.ReactNode;
  /** One <p> rendered per entry. */
  paragraphs: string[];
  image: string;
  imageAlt?: string;
  /** Full Tailwind aspect class for the image, e.g. "aspect-[5/4]" or "aspect-[3/2]". */
  imageAspect?: string;
  /** Full Tailwind lg grid-cols class, e.g. "lg:grid-cols-[1.15fr_0.85fr]". */
  columns?: string;
  /** Place the image on the left instead of the right. */
  reverse?: boolean;
  /** Extra content rendered under the paragraphs (e.g. a row of cards). */
  children?: React.ReactNode;
  /** Stretch the image to fill the column height instead of using a fixed aspect. */
  imageFill?: boolean;
}

export default function AboutStorySection({
  badge,
  badgeIcon,
  title,
  paragraphs,
  image,
  imageAlt = "",
  imageAspect = "aspect-[5/4]",
  columns = "lg:grid-cols-[1.15fr_0.85fr]",
  reverse = false,
  children,
  imageFill = false,
}: AboutStorySectionProps) {
  return (
    <section className="w-full bg-[#0D0D0D] px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      <div className="max-w-6xl mx-auto">
        <div
          className={`grid grid-cols-1 gap-10 lg:gap-16 ${
            imageFill ? "items-stretch" : "items-center"
          } ${columns}`}
        >
          {/* Copy */}
          <AnimateOnScroll className={reverse ? "lg:order-2" : "lg:order-1"}>
            {/* Badge */}
            <div className="inline-flex items-center gap-2.5 mb-5">
              <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#FFCC00] text-black">
                {badgeIcon}
              </span>
              <span className="text-[#FFCC00] font-semibold text-sm tracking-[0.15em] uppercase">
                {badge}
              </span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-bold text-white leading-snug mb-5">
              {title}
            </h2>

            <div className="space-y-5">
              {paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-gray-400 text-base leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>

            {children}
          </AnimateOnScroll>

          {/* Image */}
          <AnimateOnScroll
            delay={0.2}
            className={`${reverse ? "lg:order-1" : "lg:order-2"} ${imageFill ? "lg:h-full" : ""}`}
          >
            <div
              className={`relative w-full rounded-2xl overflow-hidden border border-[rgba(83,83,83,0.25)] ${
                imageFill ? "aspect-[4/5] lg:aspect-auto lg:h-full" : imageAspect
              }`}
            >
              <Image
                src={image}
                alt={imageAlt}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 600px"
              />
            </div>
          </AnimateOnScroll>
        </div>
      </div>
    </section>
  );
}
