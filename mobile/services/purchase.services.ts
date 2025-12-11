import apiClient from "@/utilities/axios";

class PurchaseApi {
  async createTokenPurchasePaymentIntent(amount: number): Promise<any> {
    try {
      return await apiClient.post<any>(
        "/shops/purchase/stripe-payment-intent",
        { amount }
      );
    } catch (error: any) {
      console.error(
        "Failed to create token purchase payment intent:",
        error.message
      );
      throw error;
    }
  }

  /**
   * Create a Stripe Checkout session for web-based payment
   * This avoids Apple's 30% IAP fee by redirecting to web checkout
   */
  async createStripeCheckout(amount: number): Promise<{
    data: {
      checkoutUrl: string;
      sessionId: string;
      purchaseId: string;
      amount: number;
      totalCost: number;
    };
  }> {
    try {
      return await apiClient.post("/shops/purchase/stripe-checkout", {
        amount,
        platform: "mobile", // Tell backend to use deep links for redirect
      });
    } catch (error: any) {
      console.error("Failed to create Stripe checkout session:", error.message);
      throw error;
    }
  }
}

export const purchaseApi = new PurchaseApi();
