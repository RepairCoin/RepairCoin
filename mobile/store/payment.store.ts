import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type PaymentType = "service_booking" | "token_purchase" | "subscription";

interface PaymentSessionData {
  type: PaymentType;
  orderId: string;
  sessionId: string;
  // Additional data for display
  amount?: number;
  rcnRedeemed?: number;
  serviceName?: string;
  shopName?: string;
  tokenAmount?: number;
  totalCost?: number;
}

interface PaymentSessionState {
  // Active checkout session data
  activeSession: PaymentSessionData | null;
  // Hydration state
  _hasHydrated: boolean;

  // Set the active checkout session when initiating Stripe checkout
  setActiveSession: (data: PaymentSessionData) => void;

  // Validate and consume the session (returns session data if valid, clears after validation)
  validateAndConsumeSession: (orderId: string) => PaymentSessionData | null;

  // Clear the session
  clearSession: () => void;

  // Set hydration state
  setHasHydrated: (state: boolean) => void;
}

export const usePaymentStore = create<PaymentSessionState>()(
  devtools(
    persist(
      (set, get) => ({
        activeSession: null,
        _hasHydrated: false,

        setHasHydrated: (state: boolean) => {
          set({ _hasHydrated: state }, false, "setHasHydrated");
        },

        setActiveSession: (data: PaymentSessionData) =>
          set(
            { activeSession: data },
            false,
            "setActiveSession"
          ),

        validateAndConsumeSession: (orderId: string) => {
          const { activeSession } = get();

          // Valid if the order IDs match (convert both to string for comparison)
          if (activeSession && String(activeSession.orderId) === String(orderId)) {
            const sessionData = { ...activeSession };
            // Clear the session so it can't be reused
            set(
              { activeSession: null },
              false,
              "consumeSession"
            );
            return sessionData;
          }

          return null;
        },

        clearSession: () =>
          set(
            { activeSession: null },
            false,
            "clearSession"
          ),
      }),
      {
        name: "payment-session-storage",
        storage: createJSONStorage(() => AsyncStorage),
        onRehydrateStorage: () => (state) => {
          state?.setHasHydrated(true);
        },
      }
    ),
    { name: "payment-store" }
  )
);

// Helper to wait for hydration
export const waitForPaymentStoreHydration = (): Promise<void> => {
  return new Promise((resolve) => {
    if (usePaymentStore.getState()._hasHydrated) {
      resolve();
      return;
    }
    const unsubscribe = usePaymentStore.subscribe((state) => {
      if (state._hasHydrated) {
        unsubscribe();
        resolve();
      }
    });
  });
};
