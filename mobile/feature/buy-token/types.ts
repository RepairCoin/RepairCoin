/**
 * Buy Token feature types
 */

/** Response from Stripe checkout session creation */
export interface StripeCheckoutResponse {
  data: {
    checkoutUrl: string;
    sessionId: string;
    purchaseId: string;
    amount: number;
    totalCost: number;
  };
}

/** Item displayed in the "How It Works" modal */
export interface HowItWorksItem {
  icon: string;
  title: string;
  desc: string;
}
