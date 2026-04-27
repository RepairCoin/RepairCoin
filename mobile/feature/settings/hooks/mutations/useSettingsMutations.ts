import { useLogout } from "@/feature/auth/hooks/useLogout";

export function useSettingsMutations() {
  const { logout, isLoggingOut } = useLogout();

  return {
    performLogout: logout,
    isLoggingOut,
  };
}
