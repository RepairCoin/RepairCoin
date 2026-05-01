import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { appointmentApi } from "@/feature/transaction/appointment/services/appointment.services";

export function useShopAvailabilityWithConfigQuery(shopId?: string) {
  const { userProfile } = useAuthStore();
  const authShopId = userProfile?.shopId ?? "";
  const effectiveShopId = shopId ?? authShopId;

  return useQuery({
    queryKey: ["shopAvailability", effectiveShopId],
    queryFn: async () => {
      const [availability, timeSlotConfig] = await Promise.all([
        appointmentApi.getShopAvailability(effectiveShopId),
        appointmentApi.getTimeSlotConfig(),
      ]);

      const sorted = availability
        ? [...availability].sort((a, b) => a.dayOfWeek - b.dayOfWeek)
        : [];

      return {
        availability: sorted,
        timeSlotConfig: timeSlotConfig ?? null,
      };
    },
    enabled: !!effectiveShopId,
    staleTime: 5 * 60 * 1000,
  });
}
