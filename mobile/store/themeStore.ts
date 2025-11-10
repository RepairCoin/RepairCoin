import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ThemeState {
  colorScheme: 'light' | 'dark';
  setColorScheme: (scheme: 'light' | 'dark') => void;
  toggleColorScheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      colorScheme: 'dark',
      setColorScheme: (scheme) => set({ colorScheme: scheme }),
      toggleColorScheme: () => 
        set((state) => ({ 
          colorScheme: state.colorScheme === 'dark' ? 'light' : 'dark' 
        })),
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);