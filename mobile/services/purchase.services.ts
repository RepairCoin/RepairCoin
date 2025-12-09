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
}

export const purchaseApi = new PurchaseApi();
