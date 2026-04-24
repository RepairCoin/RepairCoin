import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/shared/config/queryClient";
import {
  TimeSlot,
  ShopAvailability,
  TimeSlotConfig,
  DateOverride,
  CalendarBooking,
} from "@/shared/interfaces/appointment.interface";
import { appointmentApi } from "@/shared/services/appointment.services";

export function useAvailableTimeSlotsQuery(
  shopId: string,
  serviceId: string,
  date: string
) {
  return useQuery({
    queryKey: queryKeys.availableTimeSlots(shopId, serviceId, date),
    queryFn: async () => {
      return await appointmentApi.getAvailableTimeSlots(shopId, serviceId, date) as TimeSlot[];
    },
    enabled: !!shopId && !!serviceId && !!date,
    staleTime: 2 * 60 * 1000,
  });
}

export function useShopAvailabilityQuery(shopId: string) {
  return useQuery({
    queryKey: queryKeys.shopAvailability(shopId),
    queryFn: async () => {
      return await appointmentApi.getShopAvailability(shopId) as ShopAvailability[];
    },
    enabled: !!shopId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useTimeSlotConfigQuery() {
  return useQuery({
    queryKey: queryKeys.timeSlotConfig(),
    queryFn: async () => {
      return await appointmentApi.getTimeSlotConfig() as TimeSlotConfig | null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useDateOverridesQuery(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: queryKeys.dateOverrides(startDate, endDate),
    queryFn: async () => {
      return await appointmentApi.getDateOverrides(startDate, endDate) as DateOverride[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useShopCalendarQuery(startDate: string, endDate: string) {
  return useQuery({
    queryKey: queryKeys.shopCalendar(startDate, endDate),
    queryFn: async () => {
      return await appointmentApi.getShopCalendar(startDate, endDate) as CalendarBooking[];
    },
    enabled: !!startDate && !!endDate,
    staleTime: 2 * 60 * 1000,
  });
}

// Note: useMyAppointmentsQuery is now in @/shared/hooks/booking/useBooking.ts (global hook)
