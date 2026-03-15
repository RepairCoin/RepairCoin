import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export type FontSize = 'small' | 'medium' | 'large' | 'xlarge';

interface AccessibilityState {
  // Font Size
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;

  // Helper to get font scale percentage
  getFontScale: () => number;
}

export const useAccessibilityStore = create<AccessibilityState>()(
  devtools(
    persist(
      (set, get) => ({
        // Default state
        fontSize: 'medium',

        // Actions
        setFontSize: (size: FontSize) => {
          set({ fontSize: size });

          // Apply font size to document root
          const scale = get().getFontScale();
          document.documentElement.style.fontSize = `${scale}%`;
        },

        // Helpers
        getFontScale: () => {
          const { fontSize } = get();
          switch (fontSize) {
            case 'small':
              return 90;
            case 'medium':
              return 100;
            case 'large':
              return 115;
            case 'xlarge':
              return 130;
            default:
              return 100;
          }
        },
      }),
      {
        name: 'accessibility-storage', // localStorage key
      }
    )
  )
);

// Initialize font size on app load
if (typeof window !== 'undefined') {
  const store = useAccessibilityStore.getState();
  const scale = store.getFontScale();
  document.documentElement.style.fontSize = `${scale}%`;
}
