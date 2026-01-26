import { BaseResponse } from "./base.interface";

export type BookingStatus = "pending" | "paid" | "in_progress" | "completed" | "cancelled" | "refunded";

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
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  shopApproved?: boolean;
  approvedAt?: string | null;
  approvedBy?: string | null;
  // Shop info (returned for customer bookings)
  shopName?: string;
  shopAddress?: string;
  shopPhone?: string;
  // Review status
  hasReview?: boolean;
}

export interface BookingResponse extends BaseResponse<BookingData[]> {}
