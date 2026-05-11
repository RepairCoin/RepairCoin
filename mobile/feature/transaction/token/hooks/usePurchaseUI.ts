import { useCallback } from "react";
import { useAppToast } from "@/shared/hooks";
import { useCreateStripeCheckoutMutation } from "./useTokensMutation";

export function usePurchaseUI() {
  const { mutateAsync: createStripeCheckout, isPending: isCreatingCheckout } =
    useCreateStripeCheckoutMutation();
  const { showError } = useAppToast();

  const handlePurchase = useCallback(
    async (
      purchaseAmount: number,
      isQualified: boolean,
      isValidAmount: boolean,
      onShowSubscriptionModal: () => void
    ) => {
      if (!isQualified) {
        onShowSubscriptionModal();
        return;
      }

      if (!isValidAmount) {
        showError("Minimum purchase amount is 5 RCN");
        return;
      }

      try {
        await createStripeCheckout(purchaseAmount);
      } catch (err) {
        console.error("Purchase initiation failed:", err);
      }
    },
    [createStripeCheckout, showError]
  );

  return {
    handlePurchase,
    isCreatingCheckout,
  };
}
