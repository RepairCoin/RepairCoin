"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  Clock,
  CreditCard,
  Globe,
  ShieldCheck,
} from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/services/api/client";

const PANEL =
  "rounded-2xl bg-[linear-gradient(90deg,#000000_0%,#1D1D1D_100%)] p-6 md:p-8";

// Screens 5 and 6 of the Figma flow. Steps 1-4 live in ShopRegistrationWizard; by the time
// we land here the shop row already exists, which is what lets us attach an acct_... to it.
const TOTAL_STEPS = 6;

const BENEFITS = [
  {
    icon: ShieldCheck,
    title: "Bank-Level Security",
    body: "FixFlow does not store your banking details. All sensitive data is processed directly by Stripe.",
  },
  {
    icon: CreditCard,
    title: "Automated Payments",
    body: "Enable seamless RCN purchases, subscriptions, and redemptions for your shop.",
  },
  {
    icon: BadgeCheck,
    title: "Instant Activation",
    body: "Once connected, your shop is officially verified and ready to operate inside the FixFlow network.",
  },
  {
    icon: Globe,
    title: "Global Payment Support",
    body: "Accept cards, wallets, and international payments with built-in compliance and automatic currency handling.",
  },
];

function StripeWordmark() {
  return (
    <span className="text-xl font-bold italic tracking-tight text-[#635BFF]">
      stripe
    </span>
  );
}

function ProgressPanel({ step, label }: { step: number; label: string }) {
  return (
    <div className={`${PANEL} py-5 md:py-5`}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs text-[#999999]">Your progress</p>
          <p className="mt-1 text-sm font-medium text-[#FFCC00]">{label}</p>
        </div>
        {step < TOTAL_STEPS && (
          <div className="flex shrink-0 items-center gap-1.5 text-xs text-[#999999]">
            <Clock className="h-3.5 w-3.5" />
            <span>7 mins</span>
          </div>
        )}
      </div>
      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#E0E0E0]"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={TOTAL_STEPS}
        aria-label={`Step ${step} of ${TOTAL_STEPS}: ${label}`}
      >
        <div
          className="h-full rounded-full bg-[#008000] transition-all duration-300"
          style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
        />
      </div>
    </div>
  );
}

export default function ShopPayoutsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [connecting, setConnecting] = useState(false);
  const [checking, setChecking] = useState(true);
  const [connected, setConnected] = useState(false);

  const returnedFromStripe = searchParams.get("connected") === "1";
  const linkExpired = searchParams.get("refresh") === "1";

  // Stripe's return_url only tells us the shop came back — not that Stripe approved them.
  // charges_enabled is the real signal, so always ask the API.
  const checkStatus = useCallback(async () => {
    setChecking(true);
    try {
      // apiClient sends the auth cookie AND auto-refreshes the access token on 401.
      // Returns the response body directly: { success, data: { chargesEnabled } }.
      const body: any = await apiClient.get("/shops/connect/status");
      setConnected(body?.data?.chargesEnabled === true);
    } catch (error) {
      console.error("Failed to read Stripe connection status:", error);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  useEffect(() => {
    if (linkExpired) {
      toast("That Stripe link expired — start again when you're ready.", {
        icon: "⏱️",
      });
    }
  }, [linkExpired]);

  const startOnboarding = async () => {
    setConnecting(true);
    try {
      // apiClient handles auth + token refresh; returns the body: { success, data: { url } }.
      // A non-2xx response rejects, so it lands in catch below.
      const body: any = await apiClient.post("/shops/connect/onboarding-link");

      if (!body?.data?.url) {
        throw new Error(body?.error || "Could not start Stripe onboarding");
      }

      // Leaves the app for Stripe-hosted onboarding; Stripe returns to ?connected=1.
      window.location.href = body.data.url;
    } catch (error: any) {
      console.error("Failed to start Stripe onboarding:", error);
      toast.error(
        error?.response?.data?.error ||
          (error instanceof Error ? error.message : "Could not start Stripe onboarding")
      );
      setConnecting(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#191919]">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[#FFCC00]" />
      </div>
    );
  }

  // Screen 6 — connected
  if (connected) {
    return (
      <div className="min-h-screen bg-[#191919] pb-24 pt-28 md:pt-32">
        <div className="mx-auto w-full max-w-[880px] space-y-6 px-6">
          <ProgressPanel step={6} label="Enter the FixFlow Platform" />

          <div className={`${PANEL} text-center`}>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#22C55E]">
              <Check className="h-6 w-6 text-[#22C55E]" />
            </div>

            <h1 className="mt-5 text-2xl font-bold text-[#22C55E]">
              Stripe Connected Successfully!
            </h1>
            <p className="mt-3 text-sm text-[#999999]">
              Your Stripe account is securely connected.
            </p>
            <p className="text-sm text-[#999999]">
              Your business is now ready to accept payments and operate on the
              FixFlow platform.
            </p>

            <button
              onClick={() => router.push("/shop?tab=profile")}
              className="mx-auto mt-6 h-12 w-full max-w-[416px] cursor-pointer rounded-md bg-[#FFCC00] text-base font-medium text-black transition-colors hover:bg-[#E5BB00]"
            >
              Proceed to Dashboard →
            </button>

            <hr className="my-6 border-white/10" />
            <div className="flex items-center justify-center gap-2">
              <span className="text-xs font-medium text-white">Powered by:</span>
              <StripeWordmark />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Screen 5 — not yet connected
  return (
    <div className="min-h-screen bg-[#191919] pb-24 pt-28 md:pt-32">
      <div className="mx-auto w-full max-w-[880px] space-y-6 px-6">
        <button
          type="button"
          onClick={() => router.push("/register/shop")}
          className="inline-flex cursor-pointer items-center gap-3 text-sm text-white transition-colors hover:text-[#FFCC00]"
        >
          <ArrowLeft className="h-4 w-4 text-[#FFCC00]" />
          Back to Previous Page
        </button>

        <ProgressPanel step={5} label="Connect with Stripe" />

        <div className={PANEL}>
          <h1 className="text-lg font-bold text-[#FFCC00]">
            Secure Your Payouts with Stripe
          </h1>
          <p className="mt-2 text-sm text-[#999999]">
            Connect your Stripe account to securely receive customer payments,
            payouts, and future transactions through FixFlow.
          </p>

          {returnedFromStripe && (
            <p className="mt-4 rounded-md border border-[#FFCC00]/30 bg-[#FFCC00]/[0.08] p-3 text-sm text-white">
              Stripe hasn&apos;t confirmed your account yet. This can take a
              moment, or Stripe may still need more information from you — resume
              below.
            </p>
          )}

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {BENEFITS.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
              >
                <div className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#FFCC00]" />
                  <div>
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-[#999999]">
                      {body}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <button
              onClick={startOnboarding}
              disabled={connecting}
              className="h-12 w-full max-w-[416px] cursor-pointer rounded-md bg-[#FFCC00] text-base font-medium text-black transition-colors hover:bg-[#E5BB00] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {connecting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                  Redirecting to Stripe...
                </span>
              ) : returnedFromStripe ? (
                "Resume Stripe Setup →"
              ) : (
                "Connect with Stripe →"
              )}
            </button>

            <p className="mx-auto mt-3 max-w-[420px] text-xs leading-relaxed text-[#999999]">
              You&apos;ll be securely redirected to Stripe to complete your
              payment setup. FixFlow never stores your banking information.
            </p>
          </div>

          <hr className="my-6 border-white/10" />
          <div className="flex items-center justify-center gap-2">
            <span className="text-xs font-medium text-white">Powered by:</span>
            <StripeWordmark />
          </div>
        </div>
      </div>
    </div>
  );
}
