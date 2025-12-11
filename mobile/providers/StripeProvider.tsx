import React from 'react';
import { StripeProvider as StripeNativeProvider } from "@stripe/stripe-react-native";

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

interface StripeProviderProps {
  children: React.ReactElement;
}

export function StripeProvider({ children }: StripeProviderProps) {
  if (!STRIPE_PUBLISHABLE_KEY) {
    console.warn("Stripe publishable key is not set. Payment features will not work.");
    return <>{children}</>;
  }

  return (
    <StripeNativeProvider
      publishableKey={STRIPE_PUBLISHABLE_KEY}
      merchantIdentifier="merchant.com.repaircoin"
      urlScheme="khalid2025"
    >
      {children}
    </StripeNativeProvider>
  );
}
