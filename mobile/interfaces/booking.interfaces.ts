import { BaseResponse } from "./base.interface";

export type BookingStatus = "pending" | "paid" | "completed" | "cancelled" | "refunded";

export interface BookingFilters {
  status?: BookingStatus | "all";
  page?: number;
  limit?: number;
}

export interface BookingData {
  orderId: string;
  shopId: string;
  serviceId: string;
  serviceName: string;
  serviceDescription: string | null;
  serviceCategory: string;
  serviceDuration: number;
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
}

export interface BookingResponse extends BaseResponse<BookingData> {}
