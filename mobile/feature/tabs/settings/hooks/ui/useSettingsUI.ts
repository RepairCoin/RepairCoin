import { useAuthStore } from "@/store/auth.store";
import { useTheme } from "@/shared/theme/useTheme";

export function useSettingsUI() {
  const { account } = useAuthStore();
  const { useThemeColor } = useTheme();
  const { toggleColorScheme, isDarkMode } = useThemeColor();

  // Format wallet address for display
  const walletDisplay = account?.address
    ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}`
    : "Not connected";

  return {
    walletDisplay,
    isDarkMode,
    handleToggleTheme: toggleColorScheme,
  };
}
