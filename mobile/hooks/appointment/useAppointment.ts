import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/config/queryClient";
import { appointmentApi } from "@/services/appointment.services";
import {
  TimeSlot,
  ShopAvailability,
  TimeSlotConfig,
  DateOverride,
  CalendarBooking,
  UpdateAvailabilityRequest,
  CreateDateOverrideRequest,
} from "@/interfaces/appointment.interface";

export function useAppointment() {
  const queryClient = useQueryClient();

  // Query: Get available time slots for a service on a specific date
  const useAvailableTimeSlotsQuery = (
    shopId: string,
    serviceId: string,
    date: string
  ) => {
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
  };

  // Query: Get shop availability (operating hours)
  const useShopAvailabilityQuery = (shopId: string) => {
    return useQuery({
      queryKey: queryKeys.shopAvailability(shopId),
      queryFn: async () => {
        const response = await appointmentApi.getShopAvailability(shopId);
        return response.data as ShopAvailability[];
      },
      enabled: !!shopId,
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };

  // Query: Get time slot configuration
  const useTimeSlotConfigQuery = () => {
    return useQuery({
      queryKey: queryKeys.timeSlotConfig(),
      queryFn: async () => {
        const response = await appointmentApi.getTimeSlotConfig();
        return response.data as TimeSlotConfig | null;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };

  // Query: Get date overrides
  const useDateOverridesQuery = (startDate?: string, endDate?: string) => {
    return useQuery({
      queryKey: queryKeys.dateOverrides(startDate, endDate),
      queryFn: async () => {
        const response = await appointmentApi.getDateOverrides(startDate, endDate);
        return response.data as DateOverride[];
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };

  // Query: Get shop calendar bookings
  const useShopCalendarQuery = (startDate: string, endDate: string) => {
    return useQuery({
      queryKey: queryKeys.shopCalendar(startDate, endDate),
      queryFn: async () => {
        const response = await appointmentApi.getShopCalendar(startDate, endDate);
        return response.data as CalendarBooking[];
      },
      enabled: !!startDate && !!endDate,
      staleTime: 2 * 60 * 1000, // 2 minutes
    });
  };

  // Mutation: Update shop availability
  const useUpdateShopAvailabilityMutation = () => {
    return useMutation({
      mutationFn: async (availability: UpdateAvailabilityRequest) => {
        const response = await appointmentApi.updateShopAvailability(availability);
        return response.data as ShopAvailability;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.appointments() });
      },
    });
  };

  // Mutation: Update time slot configuration
  const useUpdateTimeSlotConfigMutation = () => {
    return useMutation({
      mutationFn: async (config: Partial<TimeSlotConfig>) => {
        const response = await appointmentApi.updateTimeSlotConfig(config);
        return response.data as TimeSlotConfig;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.timeSlotConfig() });
      },
    });
  };

  // Mutation: Create date override
  const useCreateDateOverrideMutation = () => {
    return useMutation({
      mutationFn: async (override: CreateDateOverrideRequest) => {
        const response = await appointmentApi.createDateOverride(override);
        return response.data as DateOverride;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.appointments() });
      },
    });
  };

  // Mutation: Delete date override
  const useDeleteDateOverrideMutation = () => {
    return useMutation({
      mutationFn: async (date: string) => {
        return await appointmentApi.deleteDateOverride(date);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.appointments() });
      },
    });
  };

  // Mutation: Update service duration
  const useUpdateServiceDurationMutation = () => {
    return useMutation({
      mutationFn: async ({
        serviceId,
        durationMinutes,
      }: {
        serviceId: string;
        durationMinutes: number;
      }) => {
        return await appointmentApi.updateServiceDuration(serviceId, durationMinutes);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.services() });
      },
    });
  };

  return {
    // Queries
    useAvailableTimeSlotsQuery,
    useShopAvailabilityQuery,
    useTimeSlotConfigQuery,
    useDateOverridesQuery,
    useShopCalendarQuery,
    // Mutations
    useUpdateShopAvailabilityMutation,
    useUpdateTimeSlotConfigMutation,
    useCreateDateOverrideMutation,
    useDeleteDateOverrideMutation,
    useUpdateServiceDurationMutation,
  };
}
