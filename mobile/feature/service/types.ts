export interface TierConfig {
  color: string;
  bgColor: string;
  icon: string;
  bonus: number;
}

export interface TierInfo {
  tier: string;
  color: string;
  bgColor: string;
  icon: string;
  bonus: number;
  tierBonus: number;
}

export interface RewardCalculation {
  base: number;
  bonus: number;
  total: number;
}

export interface ServiceParams {
  id: string;
}

export interface TrendingParams {
  limit?: number;
  days?: number;
}

// Service form types
export interface ServiceFormData {
  serviceName: string;
  category: string;
  description: string;
  priceUsd: string;
  imageUrl: string;
  tags: string;
  active: boolean;
}

export interface SubmitFormParams {
  isQualified: boolean;
  isEditMode: boolean;
  serviceId?: string;
  onNotQualified: () => void;
  onSuccess: () => void;
}

// Availability types
export type AvailabilityTab = "hours" | "settings";

export interface PendingAvailabilityChanges {
  availability: Array<{
    dayOfWeek: number;
    isOpen: boolean;
    openTime: string | null;
    closeTime: string | null;
  }>;
  timeSlotConfig: {
    slotDurationMinutes: number;
    bufferTimeMinutes: number;
    maxConcurrentBookings: number;
    bookingAdvanceDays: number;
  } | null;
  hasChanges: boolean;
}

// Filter types
export type ServiceStatusFilter = "all" | "active" | "inactive";
