// Re-export from local useBooking (single source of truth)
export {
  useShopBookingQuery,
  useCustomerBookingQuery,
  useMyAppointmentsQuery,
} from "../useBooking";

// Shop queries
export {
  useRescheduleRequestsQuery,
  useRescheduleRequestCountQuery,
} from "./shop/useRescheduleRequests";
export { useCustomerSearchQuery } from "./shop/useCustomerSearch";
export { useServiceOrdersQuery } from "./shop/useServiceOrdersQuery";
export { useBookingAnalyticsQuery } from "./shop/useBookingAnalyticsQuery";
