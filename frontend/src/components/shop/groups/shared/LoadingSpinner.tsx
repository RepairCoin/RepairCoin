"use client";

import { Sparkles } from "lucide-react";
import type { SpinnerSize } from "../types";

interface LoadingSpinnerProps {
  /** Loading message to display */
  message?: string;
  /** Size of the spinner */
  size?: SpinnerSize;
  /** Whether to show sparkles icon in center */
  showSparkles?: boolean;
  /** Additional CSS classes for the container */
  className?: string;
}

const sizeClasses: Record<SpinnerSize, { spinner: string; sparkles: string }> = {
  sm: { spinner: "w-8 h-8 border-2", sparkles: "w-3 h-3" },
  md: { spinner: "w-12 h-12 border-4", sparkles: "w-5 h-5" },
  lg: { spinner: "w-16 h-16 border-4", sparkles: "w-6 h-6" },
};

/**
 * Reusable loading spinner component with optional sparkles and message
 */
export default function LoadingSpinner({
  message,
  size = "md",
  showSparkles = false,
  className = "",
}: LoadingSpinnerProps) {
  const sizes = sizeClasses[size];

  return (
    <div className={`text-center py-12 ${className}`}>
      <div className="relative mx-auto w-fit">
        <div
          className={`${sizes.spinner} border-gray-800 border-t-[#FFCC00] rounded-full animate-spin mx-auto`}
        />
        {showSparkles && (
          <Sparkles
            className={`${sizes.sparkles} text-[#FFCC00] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2`}
          />
        )}
      </div>
      {message && <p className="mt-6 text-gray-400 font-medium">{message}</p>}
    </div>
  );
}
