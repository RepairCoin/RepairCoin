import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/config/queryClient";
import { appointmentApi } from "@/services/appointment.services";

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
