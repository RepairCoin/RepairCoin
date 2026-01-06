import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { appointmentApi } from "@/services/appointment.services";

interface UseAppointmentQueriesParams {
  shopId?: string;
}

export function useAppointmentQueries(params: UseAppointmentQueriesParams = {}) {
  const { userProfile } = useAuthStore();
  const authShopId = userProfile?.shopId ?? "";
  const effectiveShopId = params.shopId ?? authShopId;

  // Shop Availability Query
  const shopAvailabilityQuery = useQuery({
    queryKey: ["shopAvailability", effectiveShopId],
    queryFn: async () => {
      const [availRes, configRes] = await Promise.all([
        appointmentApi.getShopAvailability(effectiveShopId),
        appointmentApi.getTimeSlotConfig(),
      ]);

      const availability = availRes.data
        ? [...availRes.data].sort((a, b) => a.dayOfWeek - b.dayOfWeek)
        : [];

      return {
        availability,
        timeSlotConfig: configRes.data ?? null,
      };
    },
    enabled: !!effectiveShopId,
    staleTime: 5 * 60 * 1000,
  });

  return {
    shopAvailabilityQuery,
  };
}
