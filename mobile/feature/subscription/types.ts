export type SubscriptionFormData = {
  shopName: string;
  email: string;
  phoneNumber: string;
  shopAddress: string;
  acceptTerms: boolean;
};

export type SubscriptionResponse = {
  success: boolean;
  error?: string;
  data?: {
    isPendingResume?: boolean;
    message?: string;
    paymentUrl?: string;
    nextSteps?: string;
    clientSecret?: string;
    subscriptionId?: string;
  };
};

export type SubscriptionFeature = {
  id: string;
  label: string;
};
