import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/shared/store/auth.store";
import { appointmentApi } from "@/feature/appointment/services/appointment.services";

export function useShopAvailabilityWithConfigQuery(shopId?: string) {
  const { userProfile } = useAuthStore();
  const authShopId = userProfile?.shopId ?? "";
  const effectiveShopId = shopId ?? authShopId;

  return useQuery({
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
}
