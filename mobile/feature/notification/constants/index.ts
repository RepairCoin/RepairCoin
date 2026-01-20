export const NOTIFICATIONS_PER_PAGE = 10;

export const NOTIFICATION_ROUTES = {
  // Reward notifications
  reward_issued: {
    shop: "/(dashboard)/shop/tabs/history",
    customer: "/(dashboard)/customer/tabs/history",
  },
  token_gifted: {
    shop: "/(dashboard)/shop/tabs/history",
    customer: "/(dashboard)/customer/tabs/history",
  },
  // Redemption notifications
  redemption_approval_requested: {
    shop: "/(dashboard)/shop/redeem-token",
    customer: "/(dashboard)/customer/redeem",
  },
  redemption_approval_request: {
    shop: "/(dashboard)/shop/redeem-token",
    customer: "/(dashboard)/customer/redeem",
  },
  redemption_approved: {
    shop: "/(dashboard)/shop/tabs/history",
    customer: "/(dashboard)/customer/tabs/history",
  },
  redemption_rejected: {
    shop: "/(dashboard)/shop/tabs/history",
    customer: "/(dashboard)/customer/tabs/history",
  },
  // Booking notifications
  booking_confirmed: {
    shop: "/(dashboard)/shop/booking",
    customer: "/(dashboard)/customer/tabs/service/",
  },
  service_booking_received: {
    shop: "/(dashboard)/shop/booking",
    customer: "/(dashboard)/customer/tabs/service/",
  },
  appointment_reminder: {
    shop: "/(dashboard)/shop/booking",
    customer: "/(dashboard)/customer/tabs/service/",
  },
  upcoming_appointment: {
    shop: "/(dashboard)/shop/booking",
    customer: "/(dashboard)/customer/tabs/service/",
  },
  service_order_completed: {
    shop: "/(dashboard)/shop/booking",
    customer: "/(dashboard)/customer/tabs/service/",
  },
  order_completed: {
    shop: "/(dashboard)/shop/booking",
    customer: "/(dashboard)/customer/tabs/service/",
  },
  // Reschedule notifications
  reschedule_request_created: {
    shop: "/(dashboard)/shop/booking",
    customer: "/(dashboard)/customer/tabs/service/",
  },
  reschedule_request_approved: {
    shop: "/(dashboard)/shop/booking",
    customer: "/(dashboard)/customer/tabs/service/",
  },
  reschedule_request_rejected: {
    shop: "/(dashboard)/shop/booking",
    customer: "/(dashboard)/customer/tabs/service/",
  },
  // Subscription notifications (shop only)
  subscription_expiring: {
    shop: "/(dashboard)/shop/subscription",
    customer: null,
  },
  subscription_expired: {
    shop: "/(dashboard)/shop/subscription",
    customer: null,
  },
  subscription_renewed: {
    shop: "/(dashboard)/shop/subscription",
    customer: null,
  },
} as const;
