// Queries & Mutations
export {
  useAllServicesQuery,
  useInfiniteServicesQuery,
  useShopServicesQuery,
  useGetServiceQuery,
  useGetTrendingServicesQuery,
  useGetRecentlyViewedQuery,
  useGetSimilarServicesQuery,
  useTrackRecentlyViewedMutation,
  useDeleteServiceMutation,
  useGetFavoritesQuery,
  useCheckFavoriteQuery,
  useToggleFavoriteMutation,
  useServiceReviewsQuery,
  useSubmitReviewMutation,
} from "./useFeatureTabQuery";

// UI Hooks
export { useCustomerServiceTab } from "./useCustomerServiceTab";
export { useServicesTab } from "./useServicesTab";
export { useFavoritesTab } from "./useFavoritesTab";
export { useTrendingServices } from "./useTrendingServices";
export { useUnifiedServiceDetail } from "./useUnifiedServiceDetail";
export { useServiceReviews } from "./useServiceReviews";
export { useWriteReview } from "./useWriteReview";
export { useServiceNavigation } from "./useServiceNavigation";
