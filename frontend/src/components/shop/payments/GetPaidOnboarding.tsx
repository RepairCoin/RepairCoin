"use client";

import { useCallback, useState } from "react";
import { loadConnectAndInitialize } from "@stripe/connect-js";
import {
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
} from "@stripe/react-connect-js";
import apiClient from "@/services/api/client";

/**
 * Fetch a fresh Account Session client secret from our backend. @stripe/connect-js calls
 * this on init AND whenever it needs to refresh, so it must always mint a NEW secret — which
 * POST /shops/connect/account-session does (it also creates the Express account on first call).
 */
async function fetchClientSecret(): Promise<string> {
  const body: any = await apiClient.post("/shops/connect/account-session");
  const secret = body?.data?.clientSecret;
  if (!secret) {
    throw new Error(body?.error || "Could not start payment onboarding");
  }
  return secret;
}

// Load the app's brand font (Poppins) into the component's sandbox so it matches FixFlow.
const FIXFLOW_FONTS = [
  {
    cssSrc:
      "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap",
  },
];

// FixFlow theme for the Stripe Connect embedded components (Appearance API). Stripe renders
// these in a sandbox, so only the exposed variables can be set — no arbitrary CSS or layout
// changes — but this maps them onto the app's dark + gold Poppins look.
const FIXFLOW_APPEARANCE = {
  variables: {
    fontFamily: "Poppins, system-ui, sans-serif",
    fontSizeBase: "14px",
    borderRadius: "12px",
    spacingUnit: "9px",

    colorPrimary: "#FFCC00",
    colorBackground: "#1D1D1D",
    colorText: "#FFFFFF",
    colorSecondaryText: "#999999",
    colorBorder: "#2E2E2E",
    colorDanger: "#F87171",

    buttonPrimaryColorBackground: "#FFCC00",
    buttonPrimaryColorBorder: "#FFCC00",
    buttonPrimaryColorText: "#000000",
    buttonSecondaryColorBackground: "#2F2F2F",
    buttonSecondaryColorBorder: "#3A3A3A",
    buttonSecondaryColorText: "#FFFFFF",
    buttonBorderRadius: "8px",
    buttonLabelFontWeight: "600",

    formBackgroundColor: "#141414",
    formHighlightColorBorder: "#FFCC00",
    formAccentColor: "#FFCC00",
    formPlaceholderTextColor: "#6B6B6B",
    formBorderRadius: "8px",

    badgeSuccessColorBackground: "rgba(34,197,94,0.15)",
    badgeSuccessColorText: "#22C55E",
    badgeSuccessColorBorder: "rgba(34,197,94,0.30)",
    badgeWarningColorBackground: "rgba(255,204,0,0.12)",
    badgeWarningColorText: "#FFCC00",
    badgeWarningColorBorder: "rgba(255,204,0,0.30)",
    badgeDangerColorBackground: "rgba(248,113,113,0.12)",
    badgeDangerColorText: "#F87171",
    badgeDangerColorBorder: "rgba(248,113,113,0.30)",
    badgeNeutralColorBackground: "rgba(255,255,255,0.06)",
    badgeNeutralColorText: "#999999",
    badgeNeutralColorBorder: "rgba(255,255,255,0.10)",

    actionPrimaryColorText: "#FFCC00",
    actionSecondaryColorText: "#999999",

    overlayBackdropColor: "rgba(0,0,0,0.70)",
    overlayBorderRadius: "16px",
  },
};

interface GetPaidOnboardingProps {
  /** Fired when the shop finishes or exits the embedded onboarding step. */
  onExit?: () => void;
}

/**
 * Embedded Stripe Connect onboarding — the "Get Paid" flow rendered INSIDE FixFlow, with no
 * redirect to Stripe. Stripe still owns the secure fields, KYC, identity, and bank
 * verification underneath; FixFlow owns the surrounding experience.
 *
 * Prerequisites (see the payments plan): NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY set, and the
 * Connect embedded "account onboarding" component enabled on the platform's Stripe account.
 */
export default function GetPaidOnboarding({ onExit }: GetPaidOnboardingProps) {
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  // Initialize once per mount (useState initializer keeps the same instance across renders).
  // Returns null when the publishable key is missing so we can render a clear error instead
  // of letting Connect throw.
  const [connectInstance] = useState(() => {
    if (!publishableKey) return null;
    return loadConnectAndInitialize({
      publishableKey,
      fetchClientSecret,
      fonts: FIXFLOW_FONTS,
      appearance: FIXFLOW_APPEARANCE,
    });
  });

  const handleExit = useCallback(() => {
    onExit?.();
  }, [onExit]);

  if (!connectInstance) {
    return (
      <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
        Payments aren&apos;t configured yet (missing Stripe publishable key). Contact support.
      </div>
    );
  }

  return (
    <ConnectComponentsProvider connectInstance={connectInstance}>
      <ConnectAccountOnboarding onExit={handleExit} />
    </ConnectComponentsProvider>
  );
}
