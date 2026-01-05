import { Alert } from "react-native";
import { usePurchase } from "@/hooks/purchase/usePurchase";
import { useAuthStore } from "@/store/auth.store";

export function useBuyTokenMutation() {
  const { userProfile } = useAuthStore();
  const { useCreateStripeCheckout } = usePurchase();

  const {
    mutateAsync: createStripeCheckoutAsync,
    isPending: isCreatingCheckout,
    error,
  } = useCreateStripeCheckout(userProfile?.shopId);

  const handlePurchase = async (
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
      Alert.alert("Invalid Amount", "Minimum purchase amount is 5 RCN");
      return;
    }

    try {
      // Create Stripe Checkout session and open in browser
      // This avoids Apple's 30% IAP fee
      await createStripeCheckoutAsync(purchaseAmount);
      // The hook will automatically open the checkout URL in browser
    } catch (err) {
      // Error handling is done in the mutation hook
      console.error("Purchase initiation failed:", err);
    }
  };

  return {
    handlePurchase,
    isCreatingCheckout,
    error,
  };
}
