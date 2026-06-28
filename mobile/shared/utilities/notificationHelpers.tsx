import React from "react";
import { Ionicons, MaterialCommunityIcons, FontAwesome5, Feather } from "@expo/vector-icons";
import { Notification, NotificationStyle } from "@/feature/notification/types";
import { NOTIFICATION_ROUTES } from "@/shared/constants/notifications";

/**
 * Data-driven display: notifications emitted through the backend
 * NotificationGateway carry metadata.display = { title, icon, color }. `icon`
 * is a semantic token mapped here to a vector icon + tint, so new notification
 * types that reuse a token need NO change to this file. Legacy/un-migrated
 * types have no metadata.display and fall through to the per-type switch.
 */
const DISPLAY_TOKEN_STYLE: Record<string, NotificationStyle> = {
  cancelled: {
    icon: <MaterialCommunityIcons name="calendar-remove" size={20} color="#EF4444" />,
    bgColor: "bg-red-500/20",
    borderColor: "border-red-500/30",
  },
  calendar: {
    icon: <Ionicons name="calendar-outline" size={20} color="#3B82F6" />,
    bgColor: "bg-blue-500/20",
    borderColor: "border-blue-500/30",
  },
  alarm: {
    icon: <Ionicons name="alarm" size={20} color="#8B5CF6" />,
    bgColor: "bg-purple-500/20",
    borderColor: "border-purple-500/30",
  },
  campaign: {
    icon: <Ionicons name="megaphone" size={20} color="#EC4899" />,
    bgColor: "bg-pink-500/20",
    borderColor: "border-pink-500/30",
  },
  reward: {
    icon: <FontAwesome5 name="coins" size={20} color="#FFCC00" />,
    bgColor: "bg-yellow-500/20",
    borderColor: "border-yellow-500/30",
  },
  default: {
    icon: <Ionicons name="notifications" size={20} color="#9CA3AF" />,
    bgColor: "bg-gray-500/20",
    borderColor: "border-gray-500/30",
  },
};

export function getNotificationStyle(
  type: string,
  metadata?: Record<string, any>
): NotificationStyle {
  // Prefer the gateway-provided display token; fall back to the legacy switch.
  const token = metadata?.display?.icon;
  if (token && DISPLAY_TOKEN_STYLE[token]) return DISPLAY_TOKEN_STYLE[token];
  switch (type) {
    case "reward_issued":
      return {
        icon: <FontAwesome5 name="coins" size={20} color="#FFCC00" />,
        bgColor: "bg-yellow-500/20",
        borderColor: "border-yellow-500/30",
      };
    case "token_gifted":
      return {
        icon: <Ionicons name="gift" size={20} color="#EC4899" />,
        bgColor: "bg-pink-500/20",
        borderColor: "border-pink-500/30",
      };
    case "redemption_approval_requested":
    case "redemption_approval_request":
      return {
        icon: <MaterialCommunityIcons name="cash-refund" size={20} color="#F97316" />,
        bgColor: "bg-orange-500/20",
        borderColor: "border-orange-500/30",
      };
    case "redemption_approved":
      return {
        icon: <Ionicons name="checkmark-circle" size={20} color="#22C55E" />,
        bgColor: "bg-green-500/20",
        borderColor: "border-green-500/30",
      };
    case "redemption_rejected":
      return {
        icon: <Ionicons name="close-circle" size={20} color="#EF4444" />,
        bgColor: "bg-red-500/20",
        borderColor: "border-red-500/30",
      };
    case "booking_confirmed":
    case "service_booking_received":
      return {
        icon: <Ionicons name="calendar-outline" size={20} color="#3B82F6" />,
        bgColor: "bg-blue-500/20",
        borderColor: "border-blue-500/30",
      };
    case "appointment_reminder":
    case "upcoming_appointment":
      return {
        icon: <Ionicons name="alarm" size={20} color="#8B5CF6" />,
        bgColor: "bg-purple-500/20",
        borderColor: "border-purple-500/30",
      };
    case "service_order_completed":
    case "order_completed":
      return {
        icon: <Ionicons name="checkmark-done" size={20} color="#22C55E" />,
        bgColor: "bg-green-500/20",
        borderColor: "border-green-500/30",
      };
    case "service_order_cancelled":
    // Legacy type kept as an alias so notifications created before the
    // consolidation to 'service_order_cancelled' still render correctly.
    case "service_cancelled_by_shop":
      return {
        icon: <MaterialCommunityIcons name="calendar-remove" size={20} color="#EF4444" />,
        bgColor: "bg-red-500/20",
        borderColor: "border-red-500/30",
      };
    case "subscription_expiring":
      return {
        icon: <Ionicons name="warning" size={20} color="#F59E0B" />,
        bgColor: "bg-amber-500/20",
        borderColor: "border-amber-500/30",
      };
    case "reschedule_request_created":
    case "reschedule_request_approved":
    case "reschedule_request_rejected":
      return {
        icon: <Feather name="clock" size={20} color="#06B6D4" />,
        bgColor: "bg-cyan-500/20",
        borderColor: "border-cyan-500/30",
      };
    default:
      return {
        icon: <Ionicons name="notifications" size={20} color="#9CA3AF" />,
        bgColor: "bg-gray-500/20",
        borderColor: "border-gray-500/30",
      };
  }
}

/**
 * Human-readable title for a notification type. Mirrors the web
 * NotificationBell's getNotificationTitle so the detail modal headers match.
 */
export function getNotificationTitle(
  type: string,
  metadata?: Record<string, any>
): string {
  // Prefer the gateway-provided display title; fall back to the legacy switch.
  if (metadata?.display?.title) return metadata.display.title as string;
  switch (type) {
    case "reward_issued":
      return "Reward Received";
    case "redemption_approval_requested":
    case "redemption_approval_request":
      return "Redemption Request";
    case "redemption_approved":
      return "Redemption Approved";
    case "redemption_rejected":
      return "Redemption Rejected";
    case "redemption_cancelled":
      return "Redemption Cancelled";
    case "token_gifted":
      return "Tokens Received";
    case "marketing_campaign":
      return metadata?.campaignName || "Campaign";
    case "subscription_cancelled":
      return "Subscription Cancelled by Admin";
    case "subscription_self_cancelled":
      return "Subscription Cancellation Confirmed";
    case "subscription_paused":
      return "Subscription Paused";
    case "subscription_resumed":
      return "Subscription Resumed";
    case "subscription_reactivated":
      return "Subscription Reactivated";
    case "subscription_expiring":
      return "Subscription Expiring";
    case "subscription_expired":
      return "Subscription Expired";
    case "subscription_renewed":
      return "Subscription Renewed";
    case "support_message_received":
      return "Support Reply";
    case "support_ticket_created":
      return "New Support Ticket";
    case "support_ticket_updated":
      return "Support Ticket Updated";
    case "service_booking_received":
    case "new_booking":
      return "New Booking";
    case "service_order_completed":
    case "order_completed":
      return "Order Completed";
    case "service_payment_failed":
      return "Payment Failed";
    case "service_order_cancelled":
    case "service_cancelled_by_shop":
      return "Order Cancelled";
    case "appointment_reminder":
    case "upcoming_appointment":
    case "upcoming_appointment_2h":
      return "Appointment Reminder";
    case "booking_confirmed":
      return "Booking Confirmed";
    case "reschedule_request_created":
      return "Reschedule Request";
    case "reschedule_request_approved":
      return "Reschedule Approved";
    case "reschedule_request_rejected":
      return "Reschedule Rejected";
    case "reschedule_request_expired":
      return "Reschedule Expired";
    case "booking_rescheduled_by_shop":
      return "Booking Rescheduled";
    case "shop_suspended":
      return "Shop Suspended";
    case "shop_unsuspended":
      return "Shop Unsuspended";
    case "new_message":
      return "New Message";
    default:
      return "Notification";
  }
}

export type NotificationDetailRow = { label: string; value: string };

/**
 * Build the "Details" rows for a notification's metadata. Mirrors the
 * metadata fields the web NotificationModal surfaces.
 */
export function getNotificationDetails(
  metadata?: Record<string, any>
): NotificationDetailRow[] {
  if (!metadata) return [];

  const rows: NotificationDetailRow[] = [];
  const push = (label: string, value: unknown) => {
    if (value === undefined || value === null || value === "") return;
    rows.push({ label, value: String(value) });
  };

  push("Amount", metadata.amount != null ? `${metadata.amount} RCN` : null);
  push("Shop", metadata.shopName);
  push("From", metadata.fromCustomerName);
  push("Subject", metadata.subject);
  push("Service", metadata.serviceName);
  push("Customer", metadata.customerName);
  push("Time", metadata.bookingTime);
  push(
    "Date",
    metadata.bookingDate
      ? new Date(metadata.bookingDate).toLocaleDateString()
      : null
  );
  push("Total", metadata.totalAmount != null ? `$${metadata.totalAmount}` : null);
  push(
    "RCN Earned",
    metadata.rcnEarned != null ? `${metadata.rcnEarned} RCN` : null
  );
  push("Reason", metadata.reason);
  push("Transaction ID", metadata.transactionId);
  push("Ticket ID", metadata.ticketId);
  push("Order ID", metadata.orderId);

  return rows;
}

export function getNavigationRoute(
  notification: Notification,
  userType: string | null
): string | null {
  const { notificationType, metadata } = notification;
  const isShop = userType === "shop";

  // Review notifications: deep-link to the specific service's reviews when serviceId is present
  const reviewTypes = ["customer_review_received", "shop_review_response", "review_comment"];
  if (reviewTypes.includes(notificationType) && metadata?.serviceId) {
    return isShop
      ? `/(dashboard)/shop/service/${metadata.serviceId}/reviews`
      : `/(dashboard)/customer/review/service/${metadata.serviceId}`;
  }

  const routes = NOTIFICATION_ROUTES[notificationType as keyof typeof NOTIFICATION_ROUTES];

  if (!routes) return null;

  return isShop ? routes.shop : routes.customer;
}
