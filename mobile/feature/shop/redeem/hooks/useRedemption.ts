import { useCallback } from "react";
import { useRedemptionSession } from "../hooks/useRedemptionSession";
import { useCustomerLookup } from "../../customers/hooks/useCustomerLookup";
import { RedemptionCallbacks } from "../../services/shop.interface";

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
