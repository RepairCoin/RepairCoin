import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/config/queryClient";
import { MyAppointment } from "@/interfaces/appointment.interface";
import { appointmentApi } from "@/services/appointment.services";

export function useMyAppointmentsQuery(startDate: string, endDate: string) {
  return useQuery({
    queryKey: queryKeys.myAppointments(startDate, endDate),
    queryFn: async () => {
      const response = await appointmentApi.getMyAppointments(
        startDate,
        endDate
      );
      return response.data as MyAppointment[];
    },
    enabled: !!startDate && !!endDate,
    staleTime: 2 * 60 * 1000,
  });
}
