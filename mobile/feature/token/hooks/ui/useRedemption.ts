import { useCallback } from "react";
import { RedemptionCallbacks } from "../../types";
import { useCustomerLookup } from "../queries";
import { useRedemptionSession } from "./useRedemptionSession";

/**
 * Main hook that combines customer lookup and redemption session management
 */
export const useRedemption = (callbacks?: RedemptionCallbacks) => {
  const customerLookup = useCustomerLookup();
  const redemptionSession = useRedemptionSession(callbacks);

  const resetRedemption = useCallback(() => {
    customerLookup.resetCustomer();
    redemptionSession.resetSession();
  }, [customerLookup, redemptionSession]);

  return {
    ...customerLookup,
    ...redemptionSession,
    resetRedemption,
  };
};
