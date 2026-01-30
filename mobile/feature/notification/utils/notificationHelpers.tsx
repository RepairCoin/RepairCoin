import React from "react";
import { Ionicons, MaterialCommunityIcons, FontAwesome5, Feather } from "@expo/vector-icons";
import { Notification, NotificationStyle } from "../types";
import { NOTIFICATION_ROUTES } from "../constants";

export function getNotificationStyle(type: string): NotificationStyle {
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

export function getNavigationRoute(
  notification: Notification,
  userType: string | null
): string | null {
  const { notificationType } = notification;
  const routes = NOTIFICATION_ROUTES[notificationType as keyof typeof NOTIFICATION_ROUTES];

  if (!routes) return null;

  const isShop = userType === "shop";
  return isShop ? routes.shop : routes.customer;
}
