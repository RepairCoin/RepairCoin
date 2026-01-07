"use client";

import React, { useState } from "react";
import { Heart } from "lucide-react";
import { toast } from "react-hot-toast";
import { servicesApi } from "@/services/api/services";
import { useAuthStore } from "@/stores/authStore";

interface FavoriteButtonProps {
  serviceId: string;
  /**
   * Initial favorited state (optional, will be fetched if not provided)
   */
  initialIsFavorited?: boolean;
  /**
   * Size variant
   */
  size?: "sm" | "md" | "lg";
  /**
   * Show text label
   */
  showLabel?: boolean;
  /**
   * Custom className
   */
  className?: string;
  /**
   * Callback when favorite status changes
   */
  onFavoriteChange?: (isFavorited: boolean) => void;
}

export const FavoriteButton: React.FC<FavoriteButtonProps> = ({
  serviceId,
  initialIsFavorited,
  size = "md",
  showLabel = false,
  className = "",
  onFavoriteChange,
}) => {
  const [isFavorited, setIsFavorited] = useState(initialIsFavorited ?? false);
  const [isLoading, setIsLoading] = useState(false);
  const { isAuthenticated, isCustomer } = useAuthStore();

  // Size classes
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
  };

  const iconSizes = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Check authentication
    if (!isAuthenticated) {
      toast.error("Please connect your wallet to favorite services");
      return;
    }

    // Check user role
    if (!isCustomer) {
      toast.error("Only customers can favorite services");
      return;
    }

    setIsLoading(true);

    try {
      if (isFavorited) {
        // Remove from favorites
        await servicesApi.removeFavorite(serviceId);
        setIsFavorited(false);
        toast.success("Removed from favorites");
        onFavoriteChange?.(false);
      } else {
        // Add to favorites
        await servicesApi.addFavorite(serviceId);
        setIsFavorited(true);
        toast.success("Added to favorites!");
        onFavoriteChange?.(true);
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
      toast.error(isFavorited ? "Failed to remove favorite" : "Failed to add favorite");
    } finally {
      setIsLoading(false);
    }
  };

  const isDisabled = isLoading || !isAuthenticated || !isCustomer;
  const tooltipText = !isAuthenticated
    ? "Sign in to favorite services"
    : !isCustomer
    ? "Only customers can favorite services"
    : isFavorited
    ? "Remove from favorites"
    : "Add to favorites";

  return (
    <button
      onClick={handleToggleFavorite}
      disabled={isDisabled}
      className={`
        ${sizeClasses[size]}
        flex items-center justify-center gap-2
        rounded-full
        backdrop-blur-sm
        transition-all duration-200
        shadow-lg
        ${
          isFavorited
            ? "bg-red-500/90 text-white hover:bg-red-600 hover:scale-110"
            : "bg-black/60 text-gray-300 hover:bg-black/80 hover:text-red-500 hover:scale-110"
        }
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      title={tooltipText}
    >
      <Heart
        className={`${iconSizes[size]} ${isFavorited ? "fill-current" : ""}`}
        strokeWidth={isFavorited ? 0 : 2}
      />
      {showLabel && (
        <span className="text-sm font-medium">
          {isFavorited ? "Favorited" : "Favorite"}
        </span>
      )}
    </button>
  );
};
