import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { useService } from "@/shared/service/useService";
import { queryKeys } from "@/config/queryClient";

export function useServiceMutations() {
  const queryClient = useQueryClient();
  const { userProfile } = useAuthStore();
  const { useUpdateService } = useService();
  const { mutateAsync: updateServiceMutation } = useUpdateService();

  const shopId = userProfile?.shopId;

  const toggleServiceStatus = useCallback(
    async (serviceId: string, active: boolean) => {
      await updateServiceMutation({
        serviceId,
        serviceData: { active },
      });

      // Invalidate and refetch services list
      await queryClient.invalidateQueries({
        queryKey: queryKeys.shopServices(shopId!),
      });
    },
    [updateServiceMutation, queryClient, shopId]
  );

  return {
    toggleServiceStatus,
  };
}
