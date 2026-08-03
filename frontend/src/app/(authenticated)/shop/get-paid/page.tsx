"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Check,
  Clock,
  FileText,
  Landmark,
  Receipt,
  ShieldCheck,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import apiClient from "@/services/api/client";
import { getApiBaseUrl } from "@/utils/apiUrl";
import GetPaidOnboarding from "@/components/shop/payments/GetPaidOnboarding";
import CardReaders from "@/components/shop/payments/CardReaders";

const PANEL =
  "rounded-2xl bg-[linear-gradient(90deg,#000000_0%,#1D1D1D_100%)] p-6 md:p-8";

type StepId =
  | "verify_business"
  | "business_details"
  | "owner_kyc"
  | "bank"
  | "tax"
  | "identity";

// The FixFlow-branded "Get Paid" journey. These are OUR labels around Stripe's embedded
// onboarding — the shop never sees Stripe's own step names.
//
// "Statement Descriptor" was removed: nothing in the app ever sets one (that needs an
// accounts.update call the embedded flow doesn't make), so the step could only ever render as
// complete. A permanently-green step is worse than no step.
const STEPS: { id: StepId; label: string; blurb: string; icon: LucideIcon }[] = [
  { id: "verify_business", label: "Verify Business", blurb: "Confirm your business type and registration.", icon: Building2 },
  { id: "business_details", label: "Business Details", blurb: "Name, address, website, and contact.", icon: FileText },
  { id: "owner_kyc", label: "Owner Verification", blurb: "Verify the business owner (KYC).", icon: UserCheck },
  { id: "bank", label: "Bank Account", blurb: "Where your payouts land.", icon: Landmark },
  { id: "tax", label: "Tax Information", blurb: "Tax ID for reporting.", icon: Receipt },
  { id: "identity", label: "Identity Verification", blurb: "Upload an ID document if requested.", icon: ShieldCheck },
];

// Best-effort bucketing of a Stripe requirement key into one of our 7 steps. Heuristic and
// defensive — an unrecognised key falls back to "Verify Business" rather than breaking the UI.
// Order matters: more specific checks first.
function stepForRequirement(key: string): StepId {
  const k = key.toLowerCase();
  if (k.includes("verification.document") || k.includes("verification.additional_document")) return "identity";
  if (k.includes("external_account")) return "bank";
  if (k.includes("tax_id") || k.includes("id_number") || k.includes("ssn_last_4")) return "tax";
  if (
    k.startsWith("individual") ||
    k.startsWith("person_") ||
    k.includes("representative") ||
    k.includes("owners") ||
    k.includes("directors") ||
    k.includes("executives") ||
    k.includes("relationship")
  )
    return "owner_kyc";
  if (
    k.includes("business_profile.url") ||
    (k.startsWith("company") && (k.includes("name") || k.includes("address") || k.includes("phone")))
  )
    return "business_details";
  return "verify_business";
}

interface ConnectStatus {
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsDue: string[];
  eventuallyDue: string[];
  pendingVerification: string[];
  disabledReason: string | null;
  // Positive confirmation for the two steps Stripe doesn't reliably list as requirements.
  taxIdProvided: boolean;
  identityVerification: "unverified" | "pending" | "verified";
  // 'standard' = the shop's own account, adopted via OAuth. Not editable from here.
  accountType: "express" | "standard" | null;
  terminalReady: boolean;
}

// Dashboard home rather than a deep link: Stripe surfaces the outstanding-requirements banner
// there, and the root is the one URL guaranteed to resolve for every account.
const STRIPE_DASHBOARD_URL = "https://dashboard.stripe.com/";

/**
 * Human wording for Stripe's raw requirement keys, used in the read-only Standard list.
 * Several keys describe one job — `tos_acceptance.date` and `.ip` are both "accept the terms" —
 * so callers dedupe on the returned label rather than the key.
 */
const REQUIREMENT_LABELS: Record<string, string> = {
  "business_profile.product_description": "Describe what your business sells",
  "business_profile.support_phone": "Add a customer support phone number",
  "business_profile.url": "Add your business website",
  "business_profile.mcc": "Choose your business category",
  "tos_acceptance.date": "Accept Stripe's terms of service",
  "tos_acceptance.ip": "Accept Stripe's terms of service",
  external_account: "Add a bank account for payouts",
};

function requirementLabel(key: string): string {
  const known = REQUIREMENT_LABELS[key];
  if (known) return known;
  // Unknown key — make it readable rather than dropping it: Stripe adds requirements over time
  // and a missing line would look like nothing is outstanding.
  const words = key
    .replace(/^individual\.|^company\.|^business_profile\./, "")
    .replace(/_/g, " ")
    .replace(/\./g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Connect a Stripe account the shop ALREADY owns, via OAuth in a child window.
 *
 * Adopting an existing account is only possible through Stripe-hosted OAuth — Express accounts
 * are created by the platform and can't take over one someone already has. A popup keeps this
 * tab mounted, so the shop never loses their place: the callback messages us back and closes.
 */
function useConnectExisting(onConnected: () => void) {
  const [connecting, setConnecting] = useState(false);

  const start = useCallback(async () => {
    setConnecting(true);
    try {
      const body: any = await apiClient.post("/shops/connect/onboarding-link", {
        platform: "popup",
      });
      const url = body?.data?.url;
      if (!url) throw new Error(body?.error || "Could not start Stripe sign-in");

      const popup = window.open(url, "fixflow-stripe-connect", "width=620,height=760");
      if (!popup) {
        // Blocked — fall back to this tab rather than leaving the shop with a dead button.
        window.location.href = url;
        return;
      }

      // The callback page is served by the BACKEND, so the message arrives from the API
      // origin — not this app's. Comparing against window.location.origin would drop it.
      const apiOrigin = new URL(getApiBaseUrl(), window.location.href).origin;

      const onMessage = (event: MessageEvent) => {
        if (event.origin !== apiOrigin) return;
        if (event.data?.source !== "fixflow-connect-oauth") return;
        window.removeEventListener("message", onMessage);
        clearInterval(poll);
        setConnecting(false);
        if (event.data.connected) onConnected();
      };
      window.addEventListener("message", onMessage);

      // The shop can also just close the window; nothing would message us then.
      const poll = setInterval(() => {
        if (popup.closed) {
          clearInterval(poll);
          window.removeEventListener("message", onMessage);
          setConnecting(false);
          onConnected();
        }
      }, 700);
    } catch (error) {
      console.error("Failed to start Stripe connection:", error);
      setConnecting(false);
    }
  }, [onConnected]);

  return { start, connecting };
}

type StepState = "done" | "action" | "review" | "todo";

export default function GetPaidPage() {
  const router = useRouter();
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  // A failed read leaves `status` null, which is indistinguishable from a shop that has never
  // connected anything — and that renders "Set Up Payments", which would create a second,
  // FixFlow-managed account for a shop that already has its own. Track the failure so the page
  // can say so instead of guessing.
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const body: any = await apiClient.get("/shops/connect/status");
      setStatus(body?.data ?? null);
      setLoadFailed(false);
    } catch (error) {
      console.error("Failed to read payment status:", error);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { start: connectExisting, connecting } = useConnectExisting(load);

  const chargesEnabled = status?.chargesEnabled === true;
  const hasAccount = !!status?.accountId;
  const isStandard = status?.accountType === "standard";

  // Deduped on the label: Stripe lists tos_acceptance.date and .ip separately, but telling a
  // shop to "accept the terms" twice reads like a bug.
  const outstanding = Array.from(
    new Set((status?.requirementsDue ?? []).map(requirementLabel))
  );
  const dueSteps = new Set((status?.requirementsDue ?? []).map(stepForRequirement));
  const reviewSteps = new Set((status?.pendingVerification ?? []).map(stepForRequirement));
  // Fields Stripe will require but hasn't collected yet → still "to do", NOT done. Without this,
  // anything not in the immediate currently_due set would look already-complete on a fresh account.
  const upcomingSteps = new Set((status?.eventuallyDue ?? []).map(stepForRequirement));

  const stepState = (id: StepId): StepState => {
    if (chargesEnabled) return "done";
    if (dueSteps.has(id)) return "action"; // needed now
    if (reviewSteps.has(id)) return "review"; // submitted, under review
    if (upcomingSteps.has(id)) return "todo"; // will be needed — not provided yet

    // Tax and identity are frequently absent from every requirements bucket — Stripe asks for
    // them only when it needs them — so silence there says nothing about whether the shop
    // provided anything. Read the account's own fields instead of inferring.
    if (id === "tax") return status?.taxIdProvided ? "done" : "todo";
    if (id === "identity") {
      if (status?.identityVerification === "verified") return "done";
      if (status?.identityVerification === "pending") return "review";
      return "todo";
    }

    // For the rest, Stripe does demand the data up front, so "not outstanding" on an existing
    // account genuinely means provided.
    return hasAccount ? "done" : "todo";
  };

  const overall: "active" | "action" | "review" | "not_started" = chargesEnabled
    ? "active"
    : dueSteps.size > 0
    ? "action"
    : hasAccount &&
      (reviewSteps.size > 0 || status?.disabledReason === "requirements.pending_verification")
    ? "review"
    : hasAccount
    ? "review"
    : "not_started";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#191919]">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[#FFCC00]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#191919] pb-24 pt-8">
      <div className="mx-auto w-full max-w-[880px] space-y-6 px-6">
        <button
          type="button"
          onClick={() => router.push("/shop")}
          className="inline-flex cursor-pointer items-center gap-3 text-sm text-white transition-colors hover:text-[#FFCC00]"
        >
          <ArrowLeft className="h-4 w-4 text-[#FFCC00]" />
          Back to Dashboard
        </button>

        {/* Header + overall status */}
        <div className={PANEL}>
          <h1 className="text-2xl font-bold text-[#FFCC00]">Get Paid</h1>
          <p className="mt-2 text-sm text-[#999999]">
            Set up FixFlow Payments to accept cards and receive payouts — all inside FixFlow.
            Your details are verified securely by Stripe; FixFlow never stores your banking
            information.
          </p>

          {overall === "active" && (
            <div className="mt-4 flex items-center gap-2 rounded-md border border-[#22C55E]/30 bg-[#22C55E]/[0.08] p-3 text-sm text-[#22C55E]">
              <Check className="h-4 w-4" /> Payments are active — you&apos;re ready to get paid.
            </div>
          )}
          {overall === "review" && (
            <div className="mt-4 flex items-center gap-2 rounded-md border border-[#FFCC00]/30 bg-[#FFCC00]/[0.08] p-3 text-sm text-white">
              <Clock className="h-4 w-4 text-[#FFCC00]" /> Your details are being reviewed —
              payments turn on automatically once approved.
            </div>
          )}
        </div>

        {/* The 7-step journey */}
        <div className={PANEL}>
          <h2 className="text-sm font-semibold text-white">Your setup</h2>
          <ul className="mt-4 space-y-3">
            {STEPS.map(({ id, label, blurb, icon: Icon }) => {
              const state = stepState(id);
              return (
                <li
                  key={id}
                  className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.04]">
                    <Icon className="h-4 w-4 text-[#FFCC00]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">{label}</p>
                    <p className="truncate text-xs text-[#999999]">{blurb}</p>
                  </div>
                  <StepBadge state={state} />
                </li>
              );
            })}
          </ul>
        </div>

        {/* Onboarding action / embedded component */}
        <div className={PANEL}>
          {loadFailed && !status ? (
            /* Status unknown — not "no account". Offering setup here can point the shop at a new
               account while their existing one is still taking payments. */
            <div className="text-center">
              <p className="text-sm text-[#999999]">
                We couldn&apos;t load your payment status just now.
              </p>
              <button
                onClick={load}
                className="mx-auto mt-4 block h-12 w-full max-w-[416px] cursor-pointer rounded-md bg-[#FFCC00] text-base font-medium text-black transition-colors hover:bg-[#E5BB00]"
              >
                Try again
              </button>
              <p className="mx-auto mt-3 max-w-[420px] text-xs leading-relaxed text-[#999999]">
                Nothing has changed about your account — this is only a display problem.
              </p>
            </div>
          ) : isStandard ? (
            /* The shop's own Stripe account. We can't mint an Account Session for it, so the
               embedded editor is impossible — and offering "Set Up Payments" here would create
               a SEPARATE Express account and point us away from the one taking their money.
               Show what Stripe still wants and send them where they can actually change it. */
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFCC00]/10">
                  <Landmark className="h-4 w-4 text-[#FFCC00]" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">Your own Stripe account</p>
                  {status?.accountId && (
                    <code className="mt-0.5 block truncate font-mono text-xs text-[#6B6B6B]">
                      {status.accountId}
                    </code>
                  )}
                </div>
                <span
                  className={`ml-auto shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                    chargesEnabled
                      ? "bg-[#22C55E]/15 text-[#22C55E]"
                      : "bg-[#FFCC00]/15 text-[#FFCC00]"
                  }`}
                >
                  {chargesEnabled ? "Active" : "Action needed"}
                </span>
              </div>

              {chargesEnabled ? (
                <p className="mt-4 text-sm leading-relaxed text-[#999999]">
                  Payments are active. Manage payouts, details, and bank accounts from your
                  Stripe dashboard.
                </p>
              ) : (
                <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <p className="text-xs leading-relaxed text-[#999999]">
                    Because this account is yours, these can only be completed in Stripe — we
                    can&apos;t edit it from here.
                  </p>
                  {outstanding.length > 0 ? (
                    <ul className="mt-3 space-y-2">
                      {outstanding.map((label) => (
                        <li key={label} className="flex items-start gap-2.5">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FFCC00]" />
                          <span className="text-sm text-white">{label}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-white">
                      Nothing outstanding — Stripe may still be reviewing your details.
                    </p>
                  )}
                </div>
              )}
              {/* Opens in a sized window so this page keeps its place. Falls through to the
                  href (a normal new tab) if the browser blocks the popup — and the href also
                  preserves middle-click / open-in-new-tab. Wide, because the Stripe dashboard
                  is a full application, not a form. */}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <a
                  href={STRIPE_DASHBOARD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    const w = window.open(
                      STRIPE_DASHBOARD_URL,
                      "fixflow-stripe-dashboard",
                      "width=1100,height=820"
                    );
                    if (w) e.preventDefault();
                  }}
                  className="inline-flex h-11 items-center justify-center rounded-md bg-[#FFCC00] px-5 text-sm font-medium text-black transition-colors hover:bg-[#E5BB00]"
                >
                  Open Stripe Dashboard →
                </a>
                <button
                  onClick={load}
                  className="inline-flex h-11 cursor-pointer items-center justify-center rounded-md border border-[#303236] px-5 text-sm font-medium text-[#999999] transition-colors hover:bg-white/[0.04] hover:text-white"
                >
                  Refresh status
                </button>
              </div>
              <p className="mt-3 text-xs text-[#6B6B6B]">
                Finished in Stripe? Come back and hit refresh.
              </p>
            </div>
          ) : showOnboarding ? (
            <div className="rounded-xl border border-white/10 bg-[#1D1D1D] p-4 sm:p-6">
              <GetPaidOnboarding
                onExit={() => {
                  setShowOnboarding(false);
                  load();
                }}
              />
            </div>
          ) : overall === "active" ? (
            <div className="text-center">
              <p className="text-sm text-[#999999]">
                Everything&apos;s set up. Manage payouts and details from your Payments area.
              </p>
              <button
                onClick={() => setShowOnboarding(true)}
                className="mx-auto mt-4 block cursor-pointer text-xs text-[#999999] underline underline-offset-4 transition-colors hover:text-white"
              >
                Update payment details
              </button>
            </div>
          ) : (
            <div className="text-center">
              <button
                onClick={() => setShowOnboarding(true)}
                className="h-12 w-full max-w-[416px] cursor-pointer rounded-md bg-[#FFCC00] text-base font-medium text-black transition-colors hover:bg-[#E5BB00]"
              >
                {overall === "not_started" ? "Set Up Payments →" : "Continue Setup →"}
              </button>
              <p className="mx-auto mt-3 max-w-[420px] text-xs leading-relaxed text-[#999999]">
                Complete your setup securely inside FixFlow — no need to visit Stripe.
              </p>

              {/* Existing-account path. Shown alongside the setup button until payments go
                  live — a shop often only remembers it has a Stripe account partway through
                  setting one up. */}
              <div className="mx-auto mt-6 max-w-[420px] border-t border-white/10 pt-5">
                <p className="text-xs text-[#999999]">Already have a Stripe account?</p>
                <button
                  onClick={connectExisting}
                  disabled={connecting}
                  className="mt-2 cursor-pointer text-sm font-medium text-[#FFCC00] underline underline-offset-4 transition-colors hover:text-[#E5BB00] disabled:opacity-50"
                >
                  {connecting ? "Waiting for Stripe…" : "Connect it instead →"}
                </button>
                <p className="mt-2 text-xs leading-relaxed text-[#6B6B6B]">
                  Opens Stripe in a new window to sign in. Your payouts keep going to that
                  account.
                </p>
              </div>
            </div>
          )}
        </div>

        {status?.terminalReady && <CardReaders />}
      </div>
    </div>
  );
}

function StepBadge({ state }: { state: StepState }) {
  if (state === "done") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#22C55E]/20">
        <Check className="h-3.5 w-3.5 text-[#22C55E]" />
      </span>
    );
  }
  if (state === "action") {
    return (
      <span className="shrink-0 rounded-full bg-[#FFCC00]/20 px-2.5 py-1 text-xs font-medium text-[#FFCC00]">
        Action needed
      </span>
    );
  }
  if (state === "review") {
    return (
      <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-[#999999]">
        In review
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-xs font-medium text-[#999999]">
      To do
    </span>
  );
}
