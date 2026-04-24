// Appointment-specific queries
export {
  useAvailableTimeSlotsQuery,
  useShopAvailabilityQuery,
  useTimeSlotConfigQuery,
  useDateOverridesQuery,
  useShopCalendarQuery,
} from "./useAppointmentQueries";

// Re-export from global hooks (single source of truth)
export {
  useShopBookingQuery,
  useCustomerBookingQuery,
  useMyAppointmentsQuery,
} from "@/feature/booking/hooks/useBooking";
