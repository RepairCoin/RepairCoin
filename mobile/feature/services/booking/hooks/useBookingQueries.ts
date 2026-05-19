import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/shared/config/queryClient";
import { bookingApi } from "../services/booking.services";
import { bookingAnalyticsApi } from "../services/bookingAnalytics.services";
import {
  BookingFilters,
  BookingResponse,
} from "@/feature/services/booking/services/booking.interfaces";
import { MyAppointment } from "@/feature/appointment/services/appointment.interface";
import {
  appointmentApi,
  CustomerSearchResult,
  RescheduleRequest,
  RescheduleRequestStatus,
} from "@/feature/appointment/services/appointment.services";
import { TrendDays } from "../types";

interface QueryOptions {
  enabled?: boolean;
}

// ─── Shop Booking Queries ───────────────────────────────────────────────────

export function useShopBookingQuery(
  filters?: BookingFilters,
  options?: QueryOptions
) {
  return useQuery({
    queryKey: queryKeys.shopBookings(filters),
    queryFn: async () => {
      const response: BookingResponse =
        await bookingApi.getShopBookings(filters);
      return response.data;
    },
    staleTime: 30 * 1000,
    enabled: options?.enabled ?? true,
  });
}

export function useServiceOrdersQuery() {
  return useQuery({
    queryKey: ["repaircoin", "serviceOrders"],
    queryFn: async () => {
      const response = await bookingApi.getShopBookings({ limit: 500 });
      return response.data || response.items || [];
    },
    staleTime: 30 * 1000,
  });
}

export function useBookingAnalyticsQuery(trendDays: TrendDays) {
  return useQuery({
    queryKey: ["repaircoin", "bookingAnalytics", trendDays],
    queryFn: () => bookingAnalyticsApi.getBookingAnalytics(trendDays),
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Customer Booking Queries ───────────────────────────────────────────────

export function useCustomerBookingQuery(
  filters?: BookingFilters,
  options?: QueryOptions
) {
  return useQuery({
    queryKey: queryKeys.customerBookings(filters),
    queryFn: async () => {
      const response: BookingResponse =
        await bookingApi.getCustomerBookings(filters);
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}

export function useMyAppointmentsQuery(startDate: string, endDate: string) {
  return useQuery({
    queryKey: queryKeys.myAppointments(startDate, endDate),
    queryFn: async () => {
      return (await appointmentApi.getMyAppointments(
        startDate,
        endDate
      )) as MyAppointment[];
    },
    enabled: !!startDate && !!endDate,
    staleTime: 2 * 60 * 1000,
  });
}

// ─── Reschedule Queries ─────────────────────────────────────────────────────

export function useRescheduleRequestsQuery(
  status?: RescheduleRequestStatus | "all",
  options?: QueryOptions
) {
  return useQuery<RescheduleRequest[]>({
    queryKey: ["repaircoin", "reschedule-requests", status || "all"],
    queryFn: () => appointmentApi.getShopRescheduleRequests(status),
    staleTime: 30 * 1000,
    enabled: options?.enabled !== false,
  });
}

export function useRescheduleRequestCountQuery(options?: QueryOptions) {
  return useQuery<number>({
    queryKey: ["repaircoin", "reschedule-requests", "count"],
    queryFn: () => appointmentApi.getShopRescheduleRequestCount(),
    staleTime: 60 * 1000,
    enabled: options?.enabled !== false,
  });
}

// ─── Customer Search Query ──────────────────────────────────────────────────

export function useCustomerSearchQuery(
  shopId: string | undefined,
  query: string,
  options?: QueryOptions
) {
  return useQuery<CustomerSearchResult[]>({
    queryKey: ["repaircoin", "customer-search", shopId, query],
    queryFn: () => appointmentApi.searchCustomers(shopId!, query),
    staleTime: 30 * 1000,
    enabled: options?.enabled !== false && !!shopId && query.length >= 2,
  });
}
