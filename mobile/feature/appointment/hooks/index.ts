// React Query hooks - queries
export {
  useAvailableTimeSlotsQuery,
  useShopAvailabilityQuery,
  useTimeSlotConfigQuery,
  useDateOverridesQuery,
  useShopCalendarQuery,
} from "./useAppointmentQueries";
export { useBalance } from "./useBalance";

// Re-exports from booking hooks (single source of truth)
export {
  useMyAppointmentsQuery,
  useShopBookingQuery,
  useCustomerBookingQuery,
} from "@/feature/transaction/booking/hooks";

// React Query hooks - mutations
export {
  useUpdateShopAvailabilityMutation,
  useUpdateTimeSlotConfigMutation,
  useCreateDateOverrideMutation,
  useDeleteDateOverrideMutation,
  useUpdateServiceDurationMutation,
} from "./useAppointmentMutations";
export {
  useCreateBookingMutation,
  useCreateStripeCheckoutMutation,
  useApproveOrderMutation,
  useCompleteOrderMutation,
  useCancelOrderMutation,
} from "./useBookingMutations";
export { useCancelAppointmentMutation } from "./useAppointmentMutations";

// UI hooks
export { useCalendarUI } from "./useCalendarUI";

// Re-exports from booking hooks (single source of truth)
export { useBookingsFilter, useBookingsData } from "@/feature/transaction/booking/hooks";
