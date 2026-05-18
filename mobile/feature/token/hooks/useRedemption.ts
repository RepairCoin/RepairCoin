import { useCallback } from "react";
import { RedemptionCallbacks } from "../types";
import { useCustomerLookup } from "./useTokensQuery";
import { useRedemptionSession } from "./useRedemptionSession";

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
