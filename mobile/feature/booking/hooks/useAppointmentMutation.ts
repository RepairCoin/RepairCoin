import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/config/queryClient";
import { appointmentApi } from "../services";
import {
  ShopAvailability,
  TimeSlotConfig,
  DateOverride,
  UpdateAvailabilityRequest,
  CreateDateOverrideRequest,
} from "@/interfaces/appointment.interface";

// Mutation: Update shop availability
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

// Mutation: Update time slot configuration
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

// Mutation: Create date override
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

// Mutation: Delete date override
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

// Mutation: Update service duration
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

// Mutation: Cancel appointment
export function useCancelAppointmentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      return await appointmentApi.cancelAppointment(orderId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.appointments() });
    },
  });
}
