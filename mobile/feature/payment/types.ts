export type PaymentType = "subscription" | "token_purchase";

export type PaymentParams = {
  clientSecret: string;
  subscriptionId?: string;
  purchaseId?: string;
  amount?: string;
  totalCost?: string;
  type?: PaymentType;
};

export type PaymentSuccessParams = {
  type?: PaymentType;
  amount?: string;
  purchaseId?: string;
  totalCost?: string;
};
