import { ServiceCategory } from "@/shared/constants/service-categories";
import { BaseResponse } from "@/shared/interfaces/base.interface";

// ============================================
// Shared Service Types
// ============================================

export interface ServiceFilters { shopId?: string; category?: ServiceCategory; search?: string; minPrice?: number; maxPrice?: number; page?: number; limit?: number; }
export interface ServiceData { active: boolean; category: ServiceCategory; createdAt: string; description: string; durationMinutes: number; imageUrl: string; priceUsd: number; serviceId: string; serviceName: string; shopId: string; tags: string[]; updatedAt: string; avgRating?: number; reviewCount?: number; shopName?: string; shopAddress?: string; shopPhone?: string; shopEmail?: string; }
export interface CreateServiceRequest { serviceName: string; description?: string; category?: string; priceUsd: number; durationMinutes?: number; imageUrl?: string; tags?: string[]; active?: boolean; }
export interface UpdateServiceData { serviceName?: string; description?: string; priceUsd?: number; durationMinutes?: number; category?: ServiceCategory; imageUrl?: string; tags?: string[]; active?: boolean; }
export interface ServiceResponse extends BaseResponse<ServiceData[]> {}
export interface ServiceDetailResponse extends BaseResponse<ServiceData> {}

// ============================================
// Feature-Specific Types
// ============================================

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
export type AvailabilityTab = "hours" | "settings" | "overrides";

export interface PendingAvailabilityChanges {
  availability: Array<{
    dayOfWeek: number;
    isOpen: boolean;
    openTime: string | null;
    closeTime: string | null;
    breakStartTime?: string | null;
    breakEndTime?: string | null;
  }>;
  timeSlotConfig: {
    slotDurationMinutes: number;
    bufferTimeMinutes: number;
    maxConcurrentBookings: number;
    bookingAdvanceDays: number;
    minBookingHours: number;
    allowWeekendBooking: boolean;
  } | null;
  dateOverrides?: Array<{
    overrideDate: string;
    isClosed: boolean;
    customOpenTime?: string | null;
    customCloseTime?: string | null;
    reason?: string | null;
  }>;
  hasChanges: boolean;
}

// Filter types
export type ServiceStatusFilter = "all" | "active" | "inactive";

// Review/Rating types (merged from feature/ratings)
export interface ReviewParams {
  orderId: string;
  serviceId?: string;
  serviceName?: string;
  shopName?: string;
}

export interface SubmitReviewData {
  orderId: string;
  rating: number;
  comment: string;
  images?: string[];
}

export type RatingLevel = 0 | 1 | 2 | 3 | 4 | 5;
