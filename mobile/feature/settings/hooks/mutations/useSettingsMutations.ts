import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/feature/auth/store/auth.store";

export function useSettingsMutations() {
  const queryClient = useQueryClient();
  const logout = useAuthStore((state) => state.logout);

  const performLogout = useCallback(async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await logout(true);
  }, [queryClient, logout]);

  return {
    performLogout,
  };
}
