// Re-export from local useBooking (single source of truth)
export {
  useShopBookingQuery,
  useCustomerBookingQuery,
  useMyAppointmentsQuery,
} from "../useBooking";

// Reschedule request queries
export {
  useRescheduleRequestsQuery,
  useRescheduleRequestCountQuery,
} from "./useRescheduleRequests";

// Customer search query
export { useCustomerSearchQuery } from "./useCustomerSearch";

// Service Orders query (merged from feature/service-orders)
export { useServiceOrdersQuery } from "./useServiceOrdersQuery";

// Booking Analytics query (merged from feature/booking-analytics)
export { useBookingAnalyticsQuery } from "./useBookingAnalyticsQuery";
