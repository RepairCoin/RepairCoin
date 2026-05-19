// Booking tab re-exports React Query hooks from the booking feature
// The actual query/mutation logic lives in @/feature/booking/hooks
export {
  useMyAppointmentsQuery,
  useShopBookingQuery,
  useCustomerBookingQuery,
} from "@/feature/services/booking/hooks";

export { useCancelAppointmentMutation } from "@/feature/services/booking/hooks";
