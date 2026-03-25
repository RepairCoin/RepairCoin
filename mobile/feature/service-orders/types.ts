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
