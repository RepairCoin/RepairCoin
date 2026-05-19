import { ServiceCategory } from "@/shared/constants/service-categories";
import { BaseResponse } from "@/shared/interfaces/base.interface";
import { BookingStatus } from "@/feature/services/booking/services/booking.interfaces";
import { MyAppointment } from "@/feature/appointment/services/appointment.interface";

export type AvailabilityTab = "hours" | "settings" | "overrides";
export type ServiceStatusFilter = "all" | "active" | "inactive";
export type RatingLevel = 0 | 1 | 2 | 3 | 4 | 5;
export type BookingFilterStatus = "all" | "approved" | BookingStatus;
export type CustomerServiceTab = "Services" | "Favorites" | "Bookings";
export type CustomerServiceStatusFilter = "all" | "available" | "unavailable";
export type BookingFilterTab = "upcoming" | "past" | "all";
export type BookingStatusFilter = "all" | "paid" | "completed" | "cancelled" | "no_show" | "expired" | "approved";
export type ServiceSortOption =
  | "default"
  | "price_low"
  | "price_high"
  | "duration_short"
  | "duration_long"
  | "newest";
  
export interface ServiceFilters { shopId?: string; category?: ServiceCategory; search?: string; minPrice?: number; maxPrice?: number; page?: number; limit?: number; }
export interface ServiceData { active: boolean; category: ServiceCategory; createdAt: string; description: string; durationMinutes: number; imageUrl: string; priceUsd: number; serviceId: string; serviceName: string; shopId: string; tags: string[]; updatedAt: string; avgRating?: number; reviewCount?: number; shopName?: string; shopAddress?: string; shopPhone?: string; shopEmail?: string; }
export interface CreateServiceRequest { serviceName: string; description?: string; category?: string; priceUsd: number; durationMinutes?: number; imageUrl?: string; tags?: string[]; active?: boolean; }
export interface UpdateServiceData { serviceName?: string; description?: string; priceUsd?: number; durationMinutes?: number; category?: ServiceCategory; imageUrl?: string; tags?: string[]; active?: boolean; }
export interface ServiceResponse extends BaseResponse<ServiceData[]> {}
export interface ServiceDetailResponse extends BaseResponse<ServiceData> {}

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

export interface ReviewData {
  reviewId: string;
  orderId: string;
  serviceId: string;
  customerId: string;
  customerName: string | null;
  customerAddress: string;
  rating: number;
  comment: string | null;
  images: string[] | null;
  shopResponse: string | null;
  shopResponseAt: string | null;
  helpfulCount: number;
  createdAt: string;
  updatedAt: string;
  serviceName?: string;
  shopName?: string;
}

export interface ReviewStats {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export interface ServiceReviewsResponse extends BaseResponse<ReviewData[]> {
  stats?: ReviewStats;
  pagination?: {
    hasMore: boolean;
    limit: number;
    page: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface ReviewFilters {
  page?: number;
  limit?: number;
  rating?: number;
  [key: string]: string | number | boolean | undefined;
}

export interface PriceRange {
  min: number | null;
  max: number | null;
}

export interface CustomerServiceTabContainerProps {
  activeTab: CustomerServiceTab;
  onTabChange: (tab: CustomerServiceTab) => void;
}

export interface CustomerTabButtonProps {
  tab: CustomerServiceTab;
  isActive: boolean;
  onPress: () => void;
  isFirst: boolean;
  isLast: boolean;
}

export interface FilterChipProps {
  label: string;
  onRemove: () => void;
}

export interface AppointmentCardProps {
  appointment: MyAppointment;
  onPress: () => void;
  onCancel: () => void;
  onReview: () => void;
}

export interface CancelModalProps {
  visible: boolean;
  appointment: MyAppointment | null;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export interface BookingsEmptyStateProps {
  filterTab: BookingFilterTab;
}

export interface ServiceCardData {
  serviceId: string;
  serviceName: string;
  description: string;
  category?: string;
  priceUsd: number;
  durationMinutes?: number;
  imageUrl?: string;
  active: boolean;
}
