import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type PaymentType = "service_booking" | "token_purchase" | "subscription";

interface PaymentSessionData {
  type: PaymentType;
  orderId: string;
  sessionId: string;
  amount?: number;
  rcnRedeemed?: number;
  serviceName?: string;
  shopName?: string;
  tokenAmount?: number;
  totalCost?: number;
}

interface PaymentSessionState {
  activeSession: PaymentSessionData | null;
  _hasHydrated: boolean;
  setActiveSession: (data: PaymentSessionData) => void;
  validateAndConsumeSession: (orderId: string) => PaymentSessionData | null;
  clearSession: () => void;
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

          if (activeSession && String(activeSession.orderId) === String(orderId)) {
            const sessionData = { ...activeSession };
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
