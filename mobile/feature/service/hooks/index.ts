// Queries
export {
  useServicesTabQuery,
  useServiceDetailQuery,
  useServiceFormData,
  useShopAvailabilityWithConfigQuery,
} from "./queries";

// Mutations
export { useCreateServiceMutation, useUpdateServiceMutation } from "./mutations";

// UI Hooks
export {
  useServicesTabUI,
  useServiceFormUI,
  useServiceNavigation,
  useAvailabilityModal,
  useTrendingServices,
  useUnifiedServiceDetail,
} from "./ui";

// Tab UI hooks
export {
  useServiceTabUI,
  useShopServiceNavigation,
  useServiceStatusUI,
  useCustomerServiceTab,
  useServicesTab,
  useFavoritesTab,
  useBookingsTab,
  canCancelAppointment,
} from "./ui";

// Tab mutations
export { useServiceToggleMutation } from "./mutations";
