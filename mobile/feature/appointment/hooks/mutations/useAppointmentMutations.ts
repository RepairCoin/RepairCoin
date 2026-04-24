import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/config/queryClient";
import {
  ShopAvailability,
  UpdateAvailabilityRequest,
  TimeSlotConfig,
  CreateDateOverrideRequest,
} from "@/shared/interfaces/appointment.interface";
import { appointmentApi } from "@/feature/appointment/services/appointment.services";

export function useUpdateShopAvailabilityMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (availability: UpdateAvailabilityRequest) => {
      return await appointmentApi.updateShopAvailability(availability) as ShopAvailability;
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
      return await appointmentApi.updateTimeSlotConfig(config) as TimeSlotConfig;
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
      return await appointmentApi.createDateOverride(override);
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
export { useCancelAppointmentMutation } from "@/feature/booking/hooks/useBooking";
