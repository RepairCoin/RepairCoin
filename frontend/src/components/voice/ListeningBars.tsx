// frontend/src/components/voice/ListeningBars.tsx
//
// Voice-reactive equalizer bars for the Unified Assistant's "listening" state.
//
// A row of glowing brand-yellow bars whose heights track the live mic loudness
// (read from useVoiceRecorder.getAmplitude()). Each bar carries a per-bar phase
// + center weighting so they "dance" smoothly rather than moving in lockstep,
// and a lerp so motion is fluid instead of jittery.
//
// Performance: the animation runs entirely inside one requestAnimationFrame
// loop writing transform:scaleY directly to bar DOM nodes — zero React
// re-renders per frame. Respects prefers-reduced-motion (renders calm static
// bars and skips the loop).

"use client";

import React, { useEffect, useRef } from "react";

interface ListeningBarsProps {
  /** Stable getter returning current mic loudness in [0,1]. */
  getAmplitude: () => number;
  /** Number of bars (odd looks best — gives a center peak). */
  barCount?: number;
  className?: string;
}

// Resting height when silent, so the bars are always visible (scaleY fraction).
const IDLE_SCALE = 0.14;
// How fast a bar eases toward its target each frame (0-1). Higher = snappier.
const LERP = 0.35;

export const ListeningBars: React.FC<ListeningBarsProps> = ({
  getAmplitude,
  barCount = 9,
  className = "",
}) => {
  const barRefs = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // Reduced motion: set a gentle static silhouette and don't animate.
    if (prefersReduced) {
      barRefs.current.forEach((el, i) => {
        if (!el) return;
        const center = (barCount - 1) / 2;
        const weight = 1 - Math.abs(i - center) / (center + 1);
        el.style.transform = `scaleY(${IDLE_SCALE + 0.3 * weight})`;
      });
      return;
    }

    const scales = new Array(barCount).fill(IDLE_SCALE);
    let raf = 0;

    const tick = () => {
      const amp = getAmplitude();
      const center = (barCount - 1) / 2;
      const now = performance.now() / 1000;

      for (let i = 0; i < barCount; i++) {
        // Center bars react more than the edges (natural equalizer shape).
        const weight = 1 - Math.abs(i - center) / (center + 1);
        // Per-bar shimmer so they don't move in unison, even at steady volume.
        const osc = 0.5 + 0.5 * Math.sin(now * 6 + i * 0.9);
        const target = IDLE_SCALE + amp * weight * (0.45 + 0.55 * osc);
        // Ease toward the target for fluid motion.
        scales[i] += (Math.min(1, target) - scales[i]) * LERP;
        const el = barRefs.current[i];
        if (el) el.style.transform = `scaleY(${scales[i]})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [getAmplitude, barCount]);

  return (
    <div
      className={`flex items-center justify-center gap-[3px] h-8 ${className}`}
      aria-hidden="true"
    >
      {Array.from({ length: barCount }).map((_, i) => (
        <span
          key={i}
          ref={(el) => {
            barRefs.current[i] = el;
          }}
          className="w-[3px] h-full rounded-full bg-purple-400 origin-center shadow-[0_0_8px_rgba(168,85,247,0.8)]"
          style={{ transform: `scaleY(${IDLE_SCALE})` }}
        />
      ))}
    </div>
  );
};
