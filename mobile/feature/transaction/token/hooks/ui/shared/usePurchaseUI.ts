import { useCallback } from "react";
import { useAppToast } from "@/shared/hooks";
import { useCreateStripeCheckoutMutation } from "../../mutations";

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
      // Show subscription modal if not qualified
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
        // Error handling is done in the mutation hook
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
