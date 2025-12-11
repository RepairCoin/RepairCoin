import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface BookingSessionState {
  // Active checkout session order ID
  activeCheckoutOrderId: string | null;
  // Active checkout session ID (for confirming payment)
  activeCheckoutSessionId: string | null;

  // Set the active checkout order ID and session ID when initiating Stripe checkout
  setActiveCheckout: (orderId: string, sessionId: string) => void;

  // Validate and consume the session (returns sessionId if valid, clears after validation)
  validateAndConsumeSession: (orderId: string) => string | null;

  // Clear the session
  clearSession: () => void;
}

export const useBookingStore = create<BookingSessionState>()(
  devtools(
    (set, get) => ({
      activeCheckoutOrderId: null,
      activeCheckoutSessionId: null,

      setActiveCheckout: (orderId: string, sessionId: string) =>
        set(
          { activeCheckoutOrderId: orderId, activeCheckoutSessionId: sessionId },
          false,
          "setActiveCheckout"
        ),

      validateAndConsumeSession: (orderId: string) => {
        const { activeCheckoutOrderId, activeCheckoutSessionId } = get();

        // Valid if the order IDs match
        if (activeCheckoutOrderId && activeCheckoutOrderId === orderId) {
          const sessionId = activeCheckoutSessionId;
          // Clear the session so it can't be reused
          set(
            { activeCheckoutOrderId: null, activeCheckoutSessionId: null },
            false,
            "consumeSession"
          );
          return sessionId;
        }

        return null;
      },

      clearSession: () =>
        set(
          { activeCheckoutOrderId: null, activeCheckoutSessionId: null },
          false,
          "clearSession"
        ),
    }),
    { name: "booking-store" }
  )
);
