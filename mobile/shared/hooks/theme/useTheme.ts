import { Colors } from "@/constants/Colors";
import { useThemeStore } from "@/store/theme.store";

export function useTheme() {
  const useThemeColor = () => {
    const { colorScheme, setColorScheme, toggleColorScheme } = useThemeStore();
    const theme = Colors[colorScheme];

    return {
      theme,
      colorScheme,
      isLightMode: colorScheme === "light",
      isDarkMode: colorScheme === "dark",
      setColorScheme,
      toggleColorScheme,
    };
  };

  return {
    useThemeColor,
  };
}
