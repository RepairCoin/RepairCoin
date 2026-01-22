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
  useServiceDetailUI,
  useServiceNavigation,
  useAvailabilityModal,
  // Customer-side
  useServiceDetail,
  useTrendingServices,
} from "./ui";
