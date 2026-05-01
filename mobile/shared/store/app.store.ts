import { create } from 'zustand';
import { storage } from '../storage/storage';

type AppState = {
  hasSeenOnboarding: boolean;
  hasHydrated: boolean;
  initApp: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
};

export const useAppStore = create<AppState>((set) => ({
  hasSeenOnboarding: false,
  hasHydrated: false,

  initApp: async () => {
    const value = await storage.get('hasSeenOnboarding');

    set({
      hasSeenOnboarding: value ?? false,
      hasHydrated: true,
    });
  },

  completeOnboarding: async () => {
    await storage.set('hasSeenOnboarding', true);
    set({ hasSeenOnboarding: true });
  },
}));