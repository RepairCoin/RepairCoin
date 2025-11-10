import { Colors } from '@/constants/Colors';
import { useThemeStore } from '@/store/themeStore';

export function useThemeColor() {
  const colorScheme = useThemeStore((state) => state.colorScheme);

  return Colors[colorScheme];
}
