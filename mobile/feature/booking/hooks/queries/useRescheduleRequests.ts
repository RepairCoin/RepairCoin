import { useQuery } from "@tanstack/react-query";
import {
  appointmentApi,
  RescheduleRequest,
  RescheduleRequestStatus,
} from "@/shared/services/appointment.services";

/**
 * Hook to fetch reschedule requests for a shop
 */
export function useRescheduleRequestsQuery(
  status?: RescheduleRequestStatus | "all",
  options?: { enabled?: boolean }
) {
  return useQuery<RescheduleRequest[]>({
    queryKey: ["repaircoin", "reschedule-requests", status || "all"],
    queryFn: () => appointmentApi.getShopRescheduleRequests(status),
    staleTime: 30 * 1000, // 30 seconds
    enabled: options?.enabled !== false,
  });
}

/**
 * Hook to get the count of pending reschedule requests (for badge)
 */
export function useRescheduleRequestCountQuery(
  options?: { enabled?: boolean }
) {
  return useQuery<number>({
    queryKey: ["repaircoin", "reschedule-requests", "count"],
    queryFn: () => appointmentApi.getShopRescheduleRequestCount(),
    staleTime: 60 * 1000, // 1 minute
    enabled: options?.enabled !== false,
  });
}
