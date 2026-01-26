import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/config/queryClient";
import {
  ShopAvailability,
  UpdateAvailabilityRequest,
  TimeSlotConfig,
  DateOverride,
  CreateDateOverrideRequest,
} from "@/interfaces/appointment.interface";
import { appointmentApi } from "@/feature/appointment/services/appointment.services";

export function useUpdateShopAvailabilityMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (availability: UpdateAvailabilityRequest) => {
      const response = await appointmentApi.updateShopAvailability(availability);
      return response.data as ShopAvailability;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.appointments() });
    },
  });
}

export function useUpdateTimeSlotConfigMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: Partial<TimeSlotConfig>) => {
      const response = await appointmentApi.updateTimeSlotConfig(config);
      return response.data as TimeSlotConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timeSlotConfig() });
    },
  });
}

export function useCreateDateOverrideMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (override: CreateDateOverrideRequest) => {
      const response = await appointmentApi.createDateOverride(override);
      return response.data as DateOverride;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.appointments() });
    },
  });
}

export function useDeleteDateOverrideMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (date: string) => {
      return await appointmentApi.deleteDateOverride(date);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.appointments() });
    },
  });
}

export function useUpdateServiceDurationMutation() {
  const queryClient = useQueryClient();

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
}

// Re-export from global hooks (single source of truth)
export { useCancelAppointmentMutation } from "@/shared/hooks/booking/useBooking";
