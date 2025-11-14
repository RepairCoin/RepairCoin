import { useThemeStore } from '@/store/themeStore';

export function useTheme() {
  const { colorScheme, setColorScheme, toggleColorScheme } = useThemeStore();
  
  return {
    colorScheme,
    isLightMode: colorScheme === 'light',
    isDarkMode: colorScheme === 'dark',
    setColorScheme,
    toggleColorScheme,
  };
}