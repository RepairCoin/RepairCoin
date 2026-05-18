import { useCallback } from "react";
import { useRedemptionSession } from "./useRedemptionSession";
import { useCustomerLookup } from "@/feature/shop/customers/hooks/useCustomerLookup";
import { RedemptionCallbacks } from "../../services/token.interface";

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
