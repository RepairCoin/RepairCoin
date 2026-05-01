"use client";

import { Children, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./CardCarousel.module.css";

interface CardCarouselProps {
  children: ReactNode;
  /** Tailwind grid column classes applied from the sm breakpoint up. */
  gridClassName?: string;
  /** Width of each card while in mobile carousel mode. */
  itemWidthClassName?: string;
  /** Cancel the parent's mobile horizontal padding so cards bleed to the screen edge. */
  mobileEdgeBleedClassName?: string;
  /** Show pagination dots below the carousel on mobile. Hidden automatically when there is only one card. */
  showDotsScroll?: boolean;
  /** Tailwind color class applied to the active dot. */
  activeDotClassName?: string;
  /** Tailwind color class applied to inactive dots. */
  inactiveDotClassName?: string;
  className?: string;
}

export function CardCarousel({
  children,
  gridClassName = "sm:grid-cols-2 lg:grid-cols-4",
  itemWidthClassName = "w-[80%]",
  mobileEdgeBleedClassName = "-mx-4 px-4 sm:mx-0 sm:px-0",
  showDotsScroll = true,
  activeDotClassName = "bg-[#FFCC00]",
  inactiveDotClassName = "bg-gray-600 hover:bg-gray-500",
  className,
}: CardCarouselProps) {
  const items = Children.toArray(children);
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || items.length <= 1) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const mostVisible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!mostVisible) return;
        const idx = itemRefs.current.indexOf(mostVisible.target as HTMLDivElement);
        if (idx >= 0) setActiveIndex(idx);
      },
      { root, threshold: [0.5, 0.75, 1] }
    );

    const observed = itemRefs.current.filter(Boolean) as HTMLDivElement[];
    observed.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items.length]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    const onWheel = (e: WheelEvent) => {
      if (root.scrollWidth <= root.clientWidth) return;
      const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (delta === 0) return;
      e.preventDefault();
      root.scrollBy({ left: delta, behavior: "auto" });
    };

    root.addEventListener("wheel", onWheel, { passive: false });
    return () => root.removeEventListener("wheel", onWheel);
  }, []);

  const scrollToIndex = (idx: number) => {
    itemRefs.current[idx]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "start",
    });
  };

  const hasMultipleItems = items.length > 1;

  return (
    <div className={className} aria-roledescription="carousel">
      <div
        ref={scrollRef}
        className={cn(
          "flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth",
          styles.hideScrollbar,
          "sm:grid sm:gap-4 sm:overflow-visible",
          gridClassName,
          mobileEdgeBleedClassName
        )}
      >
        {items.map((child, idx) => (
          <div
            key={idx}
            ref={(el) => {
              itemRefs.current[idx] = el;
            }}
            aria-roledescription="slide"
            aria-label={`Slide ${idx + 1} of ${items.length}`}
            className={cn(
              "shrink-0 snap-start transition-opacity duration-300 sm:w-auto",
              itemWidthClassName,
              hasMultipleItems && activeIndex !== idx ? "opacity-70 sm:opacity-100" : "opacity-100"
            )}
          >
            {child}
          </div>
        ))}
      </div>

      {showDotsScroll && hasMultipleItems && (
        <div
          role="tablist"
          aria-label="Carousel pagination"
          className="mt-3 flex items-center justify-center gap-1.5 sm:hidden"
        >
          {items.map((_, idx) => {
            const isActive = activeIndex === idx;
            return (
              <button
                key={idx}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`Go to card ${idx + 1}`}
                onClick={() => scrollToIndex(idx)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  isActive ? cn("w-6", activeDotClassName) : cn("w-1.5", inactiveDotClassName)
                )}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CardCarousel;
