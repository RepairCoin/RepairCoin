import { BaseResponse } from "./base.interface";

export interface TimeSlot {
  time: string;
  available: boolean;
  bookedCount: number;
  maxBookings: number;
}

export interface ShopAvailability {
  availabilityId: string;
  shopId: string;
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
  breakStartTime: string | null;
  breakEndTime: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimeSlotConfig {
  configId: string;
  shopId: string;
  slotDurationMinutes: number;
  bufferTimeMinutes: number;
  maxConcurrentBookings: number;
  bookingAdvanceDays: number;
  minBookingHours: number;
  allowWeekendBooking: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DateOverride {
  overrideId: string;
  shopId: string;
  overrideDate: string;
  isClosed: boolean;
  customOpenTime: string | null;
  customCloseTime: string | null;
  reason: string | null;
  createdAt: string;
}

export interface CalendarBooking {
  orderId: string;
  shopId: string;
  serviceId: string;
  serviceName: string;
  customerAddress: string;
  customerName: string | null;
  bookingDate: string;
  bookingTimeSlot: string | null;
  bookingEndTime: string | null;
  status: string;
  totalAmount: number;
  notes: string | null;
  createdAt: string;
}

export interface UpdateAvailabilityRequest {
  dayOfWeek: number;
  isOpen: boolean;
  openTime?: string;
  closeTime?: string;
  breakStartTime?: string;
  breakEndTime?: string;
}

export interface CreateDateOverrideRequest {
  overrideDate: string;
  isClosed?: boolean;
  customOpenTime?: string;
  customCloseTime?: string;
  reason?: string;
}

export interface MyAppointment {
  orderId: string;
  shopId: string;
  shopName: string;
  shopAddress: string | null;
  shopPhone: string | null;
  serviceId: string;
  serviceName: string;
  serviceImage: string | null;
  bookingDate: string;
  bookingTimeSlot: string | null;
  bookingEndTime: string | null;
  status: string;
  totalAmount: number;
  notes: string | null;
  createdAt: string;
  hasReview?: boolean;
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
