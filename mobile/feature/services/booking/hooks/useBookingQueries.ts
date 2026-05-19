import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/shared/config/queryClient";
import { serviceApi } from "@/feature/services/services/service.services";
import {
  BookingFilters,
  BookingResponse,
} from "@/feature/services/services/service.interface";
import { MyAppointment } from "@/feature/appointment/services/appointment.interface";
import {
  appointmentApi,
  CustomerSearchResult,
} from "@/feature/appointment/services/appointment.services";
import { TrendDays } from "@/feature/services/services/service.interface";

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
        await serviceApi.getShopBookings(filters);
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
      const response = await serviceApi.getShopBookings({ limit: 500 });
      return response.data || response.items || [];
    },
    staleTime: 30 * 1000,
  });
}

export function useBookingAnalyticsQuery(trendDays: TrendDays) {
  return useQuery({
    queryKey: ["repaircoin", "bookingAnalytics", trendDays],
    queryFn: () => serviceApi.getBookingAnalytics(trendDays),
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
        await serviceApi.getCustomerBookings(filters);
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
