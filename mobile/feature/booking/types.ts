import { TimeSlot, ShopAvailability } from "@/shared/interfaces/appointment.interface";
import { BookingStatus } from "@/shared/interfaces/booking.interfaces";
import { DateData } from "react-native-calendars";

// ============================================
// Component Props
// ============================================

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

// ============================================
// Screen Props
// ============================================

export interface BookingPaymentScreenProps {
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

export interface BookingScheduleScreenProps {
  selectedDate: string;
  selectedTime: string | null;
  timeSlots: TimeSlot[] | undefined;
  isLoadingSlots: boolean;
  slotsError: Error | null;
  shopAvailability: ShopAvailability[] | undefined;
  onDateSelect: (day: DateData) => void;
  onTimeSelect: (time: string) => void;
}

export interface BookingDiscountScreenProps {
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
}

// ============================================
// Screen Types
// ============================================

export type BookingStep = "schedule" | "discount";

export type BookingFilterStatus = "all" | "approved" | BookingStatus;

// ============================================
// Service Response Types
// ============================================

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

// ============================================
// Service Orders Types (from service-orders)
// ============================================

export type OrderFilterType = "all" | "pending" | "paid" | "completed" | "cancelled" | "no_show";

export type BookingStage = "requested" | "paid" | "approved" | "scheduled" | "completed";

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

// ============================================
// Booking Analytics Types (from booking-analytics)
// ============================================

export type TrendDays = 7 | 30 | 90;

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

// ============================================
// Payment Types (from payment)
// ============================================

export type PaymentType = "subscription" | "token_purchase";

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
