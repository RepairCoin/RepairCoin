import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/shared/store/auth.store";

export function useSettingsMutations() {
  const queryClient = useQueryClient();
  const logout = useAuthStore((state) => state.logout);

  const performLogout = useCallback(async () => {
    queryClient.clear();
    await queryClient.cancelQueries();
    queryClient.removeQueries();
    queryClient.resetQueries();
    await logout(true);
  }, [queryClient, logout]);

  return {
    performLogout,
  };
}
