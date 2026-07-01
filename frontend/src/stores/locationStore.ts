import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LocationState {
  // null = "All locations". Persisted so the shop's active location survives reloads.
  activeLocationId: string | null;
  setActiveLocation: (id: string | null) => void;
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      activeLocationId: null,
      setActiveLocation: (id) => set({ activeLocationId: id }),
    }),
    { name: 'shop-active-location' }
  )
);
