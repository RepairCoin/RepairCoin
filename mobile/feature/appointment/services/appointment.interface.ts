import { BaseResponse } from "@/shared/interfaces/base.interface";
import { BookingStatus } from "@/feature/services/booking/services/booking.interfaces";
import { DateData } from "react-native-calendars";

// ============================================
// Shared Appointment Types
// ============================================

export interface TimeSlot { time: string; available: boolean; bookedCount: number; maxBookings: number; }
export interface ShopAvailability { availabilityId: string; shopId: string; dayOfWeek: number; isOpen: boolean; openTime: string | null; closeTime: string | null; breakStartTime: string | null; breakEndTime: string | null; createdAt: string; updatedAt: string; }
export interface TimeSlotConfig { configId: string; shopId: string; slotDurationMinutes: number; bufferTimeMinutes: number; maxConcurrentBookings: number; bookingAdvanceDays: number; minBookingHours: number; allowWeekendBooking: boolean; createdAt: string; updatedAt: string; }
export interface DateOverride { overrideId: string; shopId: string; overrideDate: string; isClosed: boolean; customOpenTime: string | null; customCloseTime: string | null; reason: string | null; createdAt: string; }
export interface CalendarBooking { orderId: string; shopId: string; serviceId: string; serviceName: string; customerAddress: string; customerName: string | null; bookingDate: string; bookingTimeSlot: string | null; bookingEndTime: string | null; status: string; totalAmount: number; notes: string | null; createdAt: string; }
export interface UpdateAvailabilityRequest { dayOfWeek: number; isOpen: boolean; openTime?: string; closeTime?: string; breakStartTime?: string; breakEndTime?: string; }
export interface CreateDateOverrideRequest { overrideDate: string; isClosed?: boolean; customOpenTime?: string; customCloseTime?: string; reason?: string; }
export interface MyAppointment { orderId: string; shopId: string; shopName: string; shopAddress: string | null; shopPhone: string | null; serviceId: string; serviceName: string; serviceImage: string | null; bookingDate: string; bookingTimeSlot: string | null; bookingEndTime: string | null; status: string; totalAmount: number; notes: string | null; createdAt: string; hasReview?: boolean; }
export interface TimeSlotsResponse extends BaseResponse<TimeSlot[]> {}
export interface ShopAvailabilityResponse extends BaseResponse<ShopAvailability[]> {}
export interface ShopAvailabilityDetailResponse extends BaseResponse<ShopAvailability> {}
export interface TimeSlotConfigResponse extends BaseResponse<TimeSlotConfig | null> {}
export interface TimeSlotConfigDetailResponse extends BaseResponse<TimeSlotConfig> {}
export interface DateOverridesResponse extends BaseResponse<DateOverride[]> {}
export interface DateOverrideDetailResponse extends BaseResponse<DateOverride> {}
export interface CalendarBookingsResponse extends BaseResponse<CalendarBooking[]> {}
export interface MyAppointmentsResponse extends BaseResponse<MyAppointment[]> {}

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

// ============================================
// Screen Types
// ============================================

export type AppointmentStep = "schedule" | "discount";

export type AppointmentFilterStatus = "all" | "approved" | BookingStatus;

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
