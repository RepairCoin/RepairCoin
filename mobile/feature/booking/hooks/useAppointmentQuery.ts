import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/config/queryClient";
import { appointmentApi } from "../services";
import {
  TimeSlot,
  ShopAvailability,
  TimeSlotConfig,
  DateOverride,
  CalendarBooking,
  MyAppointment,
} from "@/interfaces/appointment.interface";

// Query: Get available time slots for a service on a specific date
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
    staleTime: 2 * 60 * 1000, // 2 minutes (slots can change frequently)
  });
}

// Query: Get shop availability (operating hours)
export function useShopAvailabilityQuery(shopId: string) {
  return useQuery({
    queryKey: queryKeys.shopAvailability(shopId),
    queryFn: async () => {
      const response = await appointmentApi.getShopAvailability(shopId);
      return response.data as ShopAvailability[];
    },
    enabled: !!shopId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Query: Get time slot configuration
export function useTimeSlotConfigQuery() {
  return useQuery({
    queryKey: queryKeys.timeSlotConfig(),
    queryFn: async () => {
      const response = await appointmentApi.getTimeSlotConfig();
      return response.data as TimeSlotConfig | null;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Query: Get date overrides
export function useDateOverridesQuery(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: queryKeys.dateOverrides(startDate, endDate),
    queryFn: async () => {
      const response = await appointmentApi.getDateOverrides(startDate, endDate);
      return response.data as DateOverride[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Query: Get shop calendar bookings
export function useShopCalendarQuery(startDate: string, endDate: string) {
  return useQuery({
    queryKey: queryKeys.shopCalendar(startDate, endDate),
    queryFn: async () => {
      const response = await appointmentApi.getShopCalendar(startDate, endDate);
      return response.data as CalendarBooking[];
    },
    enabled: !!startDate && !!endDate,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Query: Get my appointments (customer)
export function useMyAppointmentsQuery(startDate: string, endDate: string) {
  return useQuery({
    queryKey: queryKeys.myAppointments(startDate, endDate),
    queryFn: async () => {
      const response = await appointmentApi.getMyAppointments(startDate, endDate);
      return response.data as MyAppointment[];
    },
    enabled: !!startDate && !!endDate,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
