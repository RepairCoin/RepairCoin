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
