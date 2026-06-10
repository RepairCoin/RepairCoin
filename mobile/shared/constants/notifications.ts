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
    shop: "/(dashboard)/shop/service-orders",
    customer: "/(dashboard)/customer/tabs/service/?tab=Bookings",
  },
  service_booking_received: {
    shop: "/(dashboard)/shop/service-orders",
    customer: "/(dashboard)/customer/tabs/service/?tab=Bookings",
  },
  appointment_reminder: {
    shop: "/(dashboard)/shop/service-orders",
    customer: "/(dashboard)/customer/tabs/service/?tab=Bookings",
  },
  upcoming_appointment: {
    shop: "/(dashboard)/shop/service-orders",
    customer: "/(dashboard)/customer/tabs/service/?tab=Bookings",
  },
  service_order_completed: {
    shop: "/(dashboard)/shop/service-orders",
    customer: "/(dashboard)/customer/tabs/service/?tab=Bookings",
  },
  order_completed: {
    shop: "/(dashboard)/shop/service-orders",
    customer: "/(dashboard)/customer/tabs/service/?tab=Bookings",
  },
  // Reschedule notifications
  reschedule_request_created: {
    shop: "/(dashboard)/shop/reschedule-requests",
    customer: "/(dashboard)/customer/tabs/service/",
  },
  reschedule_request_approved: {
    shop: "/(dashboard)/shop/reschedule-requests",
    customer: "/(dashboard)/customer/tabs/service/",
  },
  reschedule_request_rejected: {
    shop: "/(dashboard)/shop/reschedule-requests",
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
  // Review notifications
  customer_review_received: {
    shop: "/(dashboard)/shop/tabs/service",
    customer: null,
  },
  shop_review_response: {
    shop: null,
    customer: "/(dashboard)/customer/tabs/service",
  },
  review_comment: {
    shop: "/(dashboard)/shop/tabs/service",
    customer: "/(dashboard)/customer/tabs/service",
  },
} as const;
