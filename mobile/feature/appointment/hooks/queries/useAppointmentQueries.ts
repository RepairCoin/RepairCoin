import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/config/queryClient";
import {
  TimeSlot,
  ShopAvailability,
  TimeSlotConfig,
  DateOverride,
  CalendarBooking,
} from "@/interfaces/appointment.interface";
import { appointmentApi } from "@/feature/appointment/services/appointment.services";

export function useAvailableTimeSlotsQuery(
  shopId: string,
  serviceId: string,
  date: string
) {
  return useQuery({
    queryKey: queryKeys.availableTimeSlots(shopId, serviceId, date),
    queryFn: async () => {
      const response = await appointmentApi.getAvailableTimeSlots(
        shopId,
        serviceId,
        date
      );
      return response.data as TimeSlot[];
    },
    enabled: !!shopId && !!serviceId && !!date,
    staleTime: 2 * 60 * 1000,
  });
}

export function useShopAvailabilityQuery(shopId: string) {
  return useQuery({
    queryKey: queryKeys.shopAvailability(shopId),
    queryFn: async () => {
      const response = await appointmentApi.getShopAvailability(shopId);
      return response.data as ShopAvailability[];
    },
    enabled: !!shopId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useTimeSlotConfigQuery() {
  return useQuery({
    queryKey: queryKeys.timeSlotConfig(),
    queryFn: async () => {
      const response = await appointmentApi.getTimeSlotConfig();
      return response.data as TimeSlotConfig | null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useDateOverridesQuery(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: queryKeys.dateOverrides(startDate, endDate),
    queryFn: async () => {
      const response = await appointmentApi.getDateOverrides(startDate, endDate);
      return response.data as DateOverride[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useShopCalendarQuery(startDate: string, endDate: string) {
  return useQuery({
    queryKey: queryKeys.shopCalendar(startDate, endDate),
    queryFn: async () => {
      const response = await appointmentApi.getShopCalendar(startDate, endDate);
      return response.data as CalendarBooking[];
    },
    enabled: !!startDate && !!endDate,
    staleTime: 2 * 60 * 1000,
  });
}

// Note: useMyAppointmentsQuery is now in @/shared/hooks/booking/useBooking.ts (global hook)
