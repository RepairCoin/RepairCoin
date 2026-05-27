import { ServiceCategory } from "@/shared/constants/service-categories";
import { BaseResponse } from "@/shared/interfaces/base.interface";
import { DateData } from "react-native-calendars";

export type AppointmentStep = "schedule" | "discount";
export type AppointmentFilterStatus = "all" | "approved" | BookingStatus;
export type NoShowTier = 'normal' | 'warning' | 'caution' | 'deposit_required' | 'suspended';
export type PaymentType = "subscription" | "token_purchase";
export type TrendDays = 7 | 30 | 90;
export type BookingStep = "schedule" | "discount";
export type OrderFilterType = "all" | "pending" | "paid" | "completed" | "cancelled" | "no_show";
export type BookingStage = "requested" | "paid" | "approved" | "scheduled" | "completed";
export type BookingStatus = "pending" | "paid" | "in_progress" | "completed" | "cancelled" | "refunded" | "expired";
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
export type RescheduleRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "cancelled";
  
export interface TimeSlot { time: string; available: boolean; bookedCount: number; maxBookings: number; }
export interface ShopAvailability { availabilityId: string; shopId: string; dayOfWeek: number; isOpen: boolean; openTime: string | null; closeTime: string | null; breakStartTime: string | null; breakEndTime: string | null; createdAt: string; updatedAt: string; }
export interface TimeSlotConfig { configId: string; shopId: string; slotDurationMinutes: number; bufferTimeMinutes: number; maxConcurrentBookings: number; bookingAdvanceDays: number; minBookingHours: number; allowWeekendBooking: boolean; createdAt: string; updatedAt: string; }
export interface DateOverride { overrideId: string; shopId: string; overrideDate: string; isClosed: boolean; customOpenTime: string | null; customCloseTime: string | null; reason: string | null; createdAt: string; }
export interface CalendarBooking { orderId: string; shopId: string; serviceId: string; serviceName: string; customerAddress: string; customerName: string | null; bookingDate: string; bookingTimeSlot: string | null; bookingEndTime: string | null; status: string; totalAmount: number; notes: string | null; createdAt: string; }
export interface UpdateAvailabilityRequest { dayOfWeek: number; isOpen: boolean; openTime?: string; closeTime?: string; breakStartTime?: string; breakEndTime?: string; }
export interface CreateDateOverrideRequest { overrideDate: string; isClosed?: boolean; customOpenTime?: string; customCloseTime?: string; reason?: string; }
export interface MyAppointment { orderId: string; shopId: string; shopName: string; shopAddress: string | null; shopPhone: string | null; serviceId: string; serviceName: string; serviceImage: string | null; bookingDate: string; bookingTimeSlot: string | null; bookingEndTime: string | null; status: string; totalAmount: number; notes: string | null; createdAt: string; hasReview?: boolean; }
export interface ServiceFilters { shopId?: string; category?: ServiceCategory; search?: string; minPrice?: number; maxPrice?: number; page?: number; limit?: number; }
export interface ServiceData { active: boolean; category: ServiceCategory; createdAt: string; description: string; durationMinutes: number; imageUrl: string; priceUsd: number; serviceId: string; serviceName: string; shopId: string; tags: string[]; updatedAt: string; avgRating?: number; reviewCount?: number; shopName?: string; shopAddress?: string; shopPhone?: string; shopEmail?: string; }
export interface CreateServiceRequest { serviceName: string; description?: string; category?: string; priceUsd: number; durationMinutes?: number; imageUrl?: string; tags?: string[]; active?: boolean; }
export interface UpdateServiceData { serviceName?: string; description?: string; priceUsd?: number; durationMinutes?: number; category?: ServiceCategory; imageUrl?: string; tags?: string[]; active?: boolean; }

export interface CustomerNoShowStatus {
  customerAddress: string;
  noShowCount: number;
  tier: NoShowTier;
  depositRequired: boolean;
  lastNoShowAt?: string;
  bookingSuspendedUntil?: string;
  successfulAppointmentsSinceTier3: number;
  canBook: boolean;
  requiresDeposit: boolean;
  minimumAdvanceHours: number;
  restrictions: string[];
  isHomeShop?: boolean;
  maxRcnRedemptionPercent?: number;
}

export interface NoShowHistoryEntry {
  id: string;
  customerAddress: string;
  orderId: string;
  serviceId: string;
  shopId: string;
  scheduledTime: string;
  markedNoShowAt: string;
  markedBy?: string;
  notes?: string;
  gracePeriodMinutes: number;
  customerTierAtTime?: string;
  disputed: boolean;
  disputeStatus?: "pending" | "approved" | "rejected";
  disputeReason?: string;
  disputeSubmittedAt?: string;
  disputeResolvedAt?: string;
  createdAt: string;
}

export interface DisputeResponse {
  dispute: NoShowHistoryEntry;
  autoApproved: boolean;
  message: string;
}

export interface NoShowPolicy {
  shopId: string;
  enabled: boolean;
  gracePeriodMinutes: number;
  minimumCancellationHours: number;
  autoDetectionEnabled: boolean;
  autoDetectionDelayHours: number;
  cautionThreshold: number;
  cautionAdvanceBookingHours: number;
  depositThreshold: number;
  depositAmount: number;
  depositAdvanceBookingHours: number;
  depositResetAfterSuccessful: number;
  maxRcnRedemptionPercent: number;
  suspensionThreshold: number;
  suspensionDurationDays: number;
  sendEmailTier1: boolean;
  sendEmailTier2: boolean;
  sendEmailTier3: boolean;
  sendEmailTier4: boolean;
  sendSmsTier2: boolean;
  sendSmsTier3: boolean;
  sendSmsTier4: boolean;
  sendPushNotifications: boolean;
  allowDisputes: boolean;
  disputeWindowDays: number;
  autoApproveFirstOffense: boolean;
  requireShopReview: boolean;
}

export interface ServiceGroupLink {
  id: number;
  serviceId: string;
  groupId: string;
  tokenRewardPercentage: number;
  bonusMultiplier: number;
  active: boolean;
  groupName?: string;
  customTokenName?: string;
  customTokenSymbol?: string;
  icon?: string;
}

export interface CustomerSearchResult {
  customerAddress: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  totalBookings?: number;
  lastVisit?: string;
}

export type PaymentParams = {
  clientSecret: string;
  subscriptionId?: string;
  purchaseId?: string;
  amount?: string;
  totalCost?: string;
  type?: PaymentType;
};

export type PaymentSuccessParams = {
  type?: PaymentType;
  amount?: string;
  purchaseId?: string;
  totalCost?: string;
};

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
  serviceName: string;
  customerAddress: string;
  customerName: string | null;
  status: BookingStatus;
  totalAmount: number;
  createdAt: string;
  appointmentDate?: string | null;
  onPress?: () => void;
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

export interface BookingFilters {
  status?: BookingStatus | "all";
  page?: number;
  limit?: number;
}

export interface BookingFormData {
  serviceId: string;
  bookingDate?: string;
  bookingTime?: string;
  rcnToRedeem?: number;
  notes?: string;
}

export interface BookingData {
  orderId: string;
  shopId: string;
  serviceId: string;
  serviceName: string;
  serviceDescription: string | null;
  serviceCategory: string;
  serviceDuration: number;
  serviceImageUrl: string | null;
  customerAddress: string;
  customerName: string | null;
  status: BookingStatus;
  totalAmount: number;
  rcnEarned: number;
  stripePaymentIntentId: string | null;
  notes: string | null;
  bookingDate: string | null;
  bookingTimeSlot?: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  shopApproved?: boolean;
  approvedAt?: string | null;
  approvedBy?: string | null;
  shopName?: string;
  shopAddress?: string;
  shopPhone?: string;
  hasReview?: boolean;
}

export interface TimeSlotPickerProps {
  timeSlots: TimeSlot[] | undefined;
  selectedTime: string | null;
  isLoading: boolean;
  error: Error | null;
  onTimeSelect: (time: string) => void;
}

export interface BookingCardProps {
  serviceName: string;
  customerAddress: string;
  customerName: string | null;
  status: BookingStatus;
  totalAmount: number;
  createdAt: string;
  bookingDate?: string | null;
  onPress?: () => void;
}

export interface RcnRedeemInputProps {
  rcnToRedeem: string;
  maxRcnRedeemable: number;
  maxRcnLimit: number;
  onRcnChange: (value: string) => void;
  onMaxRcn: () => void;
}

export interface AppointmentSummaryCardProps {
  selectedDate: string;
  selectedTime: string;
  title?: string;
  variant?: "default" | "highlighted";
}

export interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export interface RcnBalanceCardProps {
  availableRcn: number;
}

export interface PriceSummaryCardProps {
  servicePrice: number;
  rcnValue?: number;
  rcnDiscount?: number;
  finalPrice: number;
  serviceName?: string;
}

export interface AppointmentPaymentScreenProps {
  selectedDate: string;
  selectedTime: string;
  serviceName: string;
  servicePrice: number;
  rcnValue: number;
  rcnDiscount: number;
  finalPrice: number;
  paymentError: string | null;
  onCardChange: (complete: boolean) => void;
}

export interface AppointmentScheduleScreenProps {
  selectedDate: string;
  selectedTime: string | null;
  timeSlots: TimeSlot[] | undefined;
  isLoadingSlots: boolean;
  slotsError: Error | null;
  shopAvailability: ShopAvailability[] | undefined;
  bookingAdvanceDays?: number;
  allowWeekendBooking?: boolean;
  onDateSelect: (day: DateData) => void;
  onTimeSelect: (time: string) => void;
}

export interface AppointmentDiscountScreenProps {
  selectedDate: string;
  selectedTime: string;
  availableRcn: number;
  rcnToRedeem: string;
  rcnValue: number;
  rcnDiscount: number;
  maxRcnRedeemable: number;
  maxRcnLimit: number;
  servicePrice: number;
  finalPrice: number;
  onRcnChange: (value: string) => void;
  onMaxRcn: () => void;
  redemptionMessage?: string;
}

export interface StripeCheckoutResponse {
  data: {
    orderId: string;
    checkoutUrl: string;
    sessionId: string;
    amount: number;
    currency: string;
    totalAmount?: number;
    rcnRedeemed?: number;
    rcnDiscountUsd?: number;
    finalAmount?: number;
  };
}

export interface ServiceOrderWithDetails {
  orderId: string;
  serviceId: string;
  shopId: string;
  status: string;
  totalAmount: number;
  bookingDate?: string;
  bookingTime?: string;
  bookingTimeSlot?: string;
  bookingEndTime?: string;
  serviceName: string;
  serviceImageUrl?: string;
  serviceCategory?: string;
  serviceDuration?: number;
  customerName?: string;
  customerPhone?: string;
  customerAddress: string;
  customerTier?: string;
  rcnEarned?: number;
  promoRcn?: number;
  rcnRedeemed?: number;
  rcnDiscountUsd?: number;
  shopApproved?: boolean;
  approvedAt?: string;
  rescheduledAt?: string;
  rescheduleReason?: string;
  rescheduleCount?: number;
  notes?: string;
  noShow?: boolean;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderStats {
  pending: number;
  paid: number;
  completed: number;
  revenue: number;
}

export interface BookingAnalytics {
  summary: {
    totalBookings: number;
    completed: number;
    noShows: number;
    cancelled: number;
    completionRate: number;
    noShowRate: number;
    cancellationRate: number;
    avgLeadTimeDays: number;
    rescheduledCount: number;
    avgRescheduleCount: number;
  };
  statusBreakdown: Array<{ status: string; count: number }>;
  busiestDays: Array<{ dayOfWeek: number; count: number }>;
  peakHours: Array<{ hour: number; count: number }>;
  cancellationReasons: Array<{ reason: string; count: number }>;
  bookingTrends: Array<{ date: string; count: number }>;
}

export interface DisputeEntry {
  id: string;
  customerAddress: string;
  orderId: string;
  serviceId: string;
  shopId: string;
  scheduledTime: string;
  markedNoShowAt: string;
  notes?: string;
  customerTierAtTime?: string;
  disputed: boolean;
  disputeStatus?: "pending" | "approved" | "rejected";
  disputeReason?: string;
  disputeSubmittedAt?: string;
  disputeResolvedAt?: string;
  disputeResolvedBy?: string;
  disputeResolutionNotes?: string;
  serviceName?: string;
  customerName?: string;
  customerEmail?: string;
  createdAt: string;
}

export interface DisputeListResponse {
  disputes: DisputeEntry[];
  total: number;
  pendingCount: number;
}

export interface RescheduleRequest {
  requestId: string;
  orderId: string;
  shopId: string;
  customerAddress: string;
  customerName?: string;
  originalDate: string;
  originalTimeSlot: string;
  originalEndTime?: string;
  requestedDate: string;
  requestedTimeSlot: string;
  requestedEndTime?: string;
  status: RescheduleRequestStatus;
  customerReason?: string;
  shopReason?: string;
  createdAt: string;
  expiresAt?: string;
  serviceName?: string;
  serviceId?: string;
  totalAmount?: number;
}

export interface ManualBookingData {
  customerAddress: string;
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  serviceId: string;
  bookingDate: string;
  bookingTimeSlot: string;
  bookingEndTime: string;
  paymentStatus: "paid" | "pending" | "unpaid";
  notes?: string;
  createNewCustomer?: boolean;
}

export interface ManualBookingResponse {
  success: boolean;
  data: {
    orderId: string;
    status: string;
    bookingDate: string;
    bookingTimeSlot: string;
  };
  message: string;
}

export interface TimeSlotsResponse extends BaseResponse<TimeSlot[]> {}
export interface ShopAvailabilityResponse extends BaseResponse<ShopAvailability[]> {}
export interface ShopAvailabilityDetailResponse extends BaseResponse<ShopAvailability> {}
export interface TimeSlotConfigResponse extends BaseResponse<TimeSlotConfig | null> {}
export interface TimeSlotConfigDetailResponse extends BaseResponse<TimeSlotConfig> {}
export interface DateOverridesResponse extends BaseResponse<DateOverride[]> {}
export interface DateOverrideDetailResponse extends BaseResponse<DateOverride> {}
export interface CalendarBookingsResponse extends BaseResponse<CalendarBooking[]> {}
export interface MyAppointmentsResponse extends BaseResponse<MyAppointment[]> {}
export interface BookingResponse extends BaseResponse<BookingData[]> {}
export interface ServiceResponse extends BaseResponse<ServiceData[]> {}
export interface ServiceDetailResponse extends BaseResponse<ServiceData> {}