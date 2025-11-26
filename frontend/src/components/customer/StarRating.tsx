"use client";

import React, { useState } from "react";
import { Star } from "lucide-react";

interface StarRatingProps {
  /**
   * Current rating value (1-5)
   */
  value: number;
  /**
   * Whether the rating is interactive (user can change it)
   */
  interactive?: boolean;
  /**
   * Callback when rating changes (interactive mode only)
   */
  onChange?: (rating: number) => void;
  /**
   * Size variant
   */
  size?: "sm" | "md" | "lg";
  /**
   * Show rating number next to stars
   */
  showNumber?: boolean;
  /**
   * Show total count (e.g., "(123 reviews)")
   */
  showCount?: boolean;
  /**
   * Total count of reviews
   */
  totalCount?: number;
  /**
   * Custom className
   */
  className?: string;
}

export const StarRating: React.FC<StarRatingProps> = ({
  value,
  interactive = false,
  onChange,
  size = "md",
  showNumber = false,
  showCount = false,
  totalCount = 0,
  className = "",
}) => {
  const [hoverRating, setHoverRating] = useState(0);

  // Size classes
  const iconSizes = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  const textSizes = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  const handleClick = (rating: number) => {
    if (interactive && onChange) {
      onChange(rating);
    }
  };

  const handleMouseEnter = (rating: number) => {
    if (interactive) {
      setHoverRating(rating);
    }
  };

  const handleMouseLeave = () => {
    if (interactive) {
      setHoverRating(0);
    }
  };

  const displayRating = hoverRating || value;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Stars */}
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= displayRating;
          const isPartial = !isFilled && star - displayRating < 1 && star - displayRating > 0;

          return (
            <button
              key={star}
              onClick={() => handleClick(star)}
              onMouseEnter={() => handleMouseEnter(star)}
              onMouseLeave={handleMouseLeave}
              disabled={!interactive}
              className={`
                ${interactive ? "cursor-pointer hover:scale-110" : "cursor-default"}
                transition-transform duration-150
                disabled:cursor-default
              `}
              type="button"
            >
              {isPartial ? (
                // Partial star (half-filled)
                <div className="relative">
                  <Star
                    className={`${iconSizes[size]} text-gray-600`}
                    fill="currentColor"
                  />
                  <div
                    className="absolute inset-0 overflow-hidden"
                    style={{ width: `${(displayRating % 1) * 100}%` }}
                  >
                    <Star
                      className={`${iconSizes[size]} text-[#FFCC00]`}
                      fill="currentColor"
                    />
                  </div>
                </div>
              ) : (
                // Full or empty star
                <Star
                  className={`
                    ${iconSizes[size]}
                    ${
                      isFilled
                        ? "text-[#FFCC00]"
                        : interactive && hoverRating > 0
                        ? "text-gray-600"
                        : "text-gray-700"
                    }
                    ${isFilled ? "fill-current" : ""}
                  `}
                  strokeWidth={isFilled ? 0 : 2}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Rating Number */}
      {showNumber && value > 0 && (
        <span className={`font-semibold text-gray-300 ${textSizes[size]}`}>
          {value.toFixed(1)}
        </span>
      )}

      {/* Review Count */}
      {showCount && totalCount > 0 && (
        <span className={`text-gray-500 ${textSizes[size]}`}>
          ({totalCount.toLocaleString()} {totalCount === 1 ? "review" : "reviews"})
        </span>
      )}

      {/* Interactive hint */}
      {interactive && hoverRating > 0 && (
        <span className={`text-[#FFCC00] font-medium ${textSizes[size]}`}>
          {hoverRating} {hoverRating === 1 ? "star" : "stars"}
        </span>
      )}
    </div>
  );
};
