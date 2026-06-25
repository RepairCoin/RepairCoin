import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface BootState {
  // True from process start until the first landed screen has its data ready
  // (or the safety timeout fires). While true, AppBootSplash covers the app
  // with the branded logo so a cold start — including opening from a push —
  // never reveals an empty, data-loading screen.
  isBooting: boolean;
  endBoot: () => void;
}

export const useBootStore = create<BootState>()(
  devtools(
    (set) => ({
      isBooting: true,
      endBoot: () => set({ isBooting: false }, false, "endBoot"),
    }),
    { name: "boot-store" }
  )
);
