/**
 * Category icon mapping utilities for the Groups feature
 */

import { Settings, Dumbbell, Wrench, Heart, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Get the appropriate icon component for a category
 * @param category - Category name
 * @returns Icon component
 */
export function getCategoryIconComponent(category?: string): LucideIcon {
  const categoryLower = category?.toLowerCase() || "";

  if (categoryLower.includes("fitness") || categoryLower.includes("training")) {
    return Dumbbell;
  }
  if (categoryLower.includes("tech") || categoryLower.includes("repair")) {
    return Settings;
  }
  if (categoryLower.includes("home") || categoryLower.includes("auto")) {
    return Wrench;
  }
  if (categoryLower.includes("health") || categoryLower.includes("wellness")) {
    return Heart;
  }
  if (categoryLower.includes("beauty") || categoryLower.includes("care")) {
    return Sparkles;
  }

  return Settings;
}

/**
 * Get a rendered category icon element
 * @param category - Category name
 * @param className - Optional CSS classes
 * @returns JSX element
 */
export function getCategoryIcon(category?: string, className = "w-5 h-5 text-white"): JSX.Element {
  const categoryLower = category?.toLowerCase() || "";

  if (categoryLower.includes("fitness") || categoryLower.includes("training")) {
    return <Dumbbell className={className} />;
  }
  if (categoryLower.includes("tech") || categoryLower.includes("repair")) {
    return <Settings className={className} />;
  }
  if (categoryLower.includes("home") || categoryLower.includes("auto")) {
    return <Wrench className={className} />;
  }
  if (categoryLower.includes("health") || categoryLower.includes("wellness")) {
    return <Heart className={className} />;
  }
  if (categoryLower.includes("beauty") || categoryLower.includes("care")) {
    return <Sparkles className={className} />;
  }

  return <Settings className={className} />;
}
