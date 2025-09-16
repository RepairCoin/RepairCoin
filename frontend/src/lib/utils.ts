import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(value: number): string {
  // Handle very large numbers
  if (value >= 1e9) {
    return `${(value / 1e9).toFixed(1)}B`;
  } else if (value >= 1e6) {
    return `${(value / 1e6).toFixed(1)}M`;
  } else if (value >= 1e3) {
    return `${(value / 1e3).toFixed(1)}K`;
  }
  
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value)
}

export function formatRCGBalance(value: number): string {
  // For RCG balances, show exact values when close to tier thresholds
  const tierThresholds = [10000, 50000, 200000];
  
  // Check if the value is within 5% of any tier threshold
  for (const threshold of tierThresholds) {
    const lowerBound = threshold * 0.95;
    const upperBound = threshold * 1.05;
    
    if (value >= lowerBound && value <= upperBound) {
      // Show exact value with comma formatting
      return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 0,
        minimumFractionDigits: 0,
      }).format(value);
    }
  }
  
  // Otherwise use the normal formatting
  return formatNumber(value);
}