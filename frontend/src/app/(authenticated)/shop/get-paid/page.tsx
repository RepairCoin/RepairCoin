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
  Tag,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import apiClient from "@/services/api/client";
import GetPaidOnboarding from "@/components/shop/payments/GetPaidOnboarding";

const PANEL =
  "rounded-2xl bg-[linear-gradient(90deg,#000000_0%,#1D1D1D_100%)] p-6 md:p-8";

type StepId =
  | "verify_business"
  | "business_details"
  | "owner_kyc"
  | "bank"
  | "tax"
  | "identity"
  | "descriptor";

// The FixFlow-branded "Get Paid" journey. These are OUR labels around Stripe's embedded
// onboarding — the shop never sees Stripe's own step names.
const STEPS: { id: StepId; label: string; blurb: string; icon: LucideIcon }[] = [
  { id: "verify_business", label: "Verify Business", blurb: "Confirm your business type and registration.", icon: Building2 },
  { id: "business_details", label: "Business Details", blurb: "Name, address, website, and contact.", icon: FileText },
  { id: "owner_kyc", label: "Owner Verification", blurb: "Verify the business owner (KYC).", icon: UserCheck },
  { id: "bank", label: "Bank Account", blurb: "Where your payouts land.", icon: Landmark },
  { id: "tax", label: "Tax Information", blurb: "Tax ID for reporting.", icon: Receipt },
  { id: "identity", label: "Identity Verification", blurb: "Upload an ID document if requested.", icon: ShieldCheck },
  { id: "descriptor", label: "Statement Descriptor", blurb: "How charges appear on customer statements.", icon: Tag },
];

// Best-effort bucketing of a Stripe requirement key into one of our 7 steps. Heuristic and
// defensive — an unrecognised key falls back to "Verify Business" rather than breaking the UI.
// Order matters: more specific checks first.
function stepForRequirement(key: string): StepId {
  const k = key.toLowerCase();
  if (k.includes("verification.document") || k.includes("verification.additional_document")) return "identity";
  if (k.includes("statement_descriptor")) return "descriptor";
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
}

type StepState = "done" | "action" | "review" | "todo";

export default function GetPaidPage() {
  const router = useRouter();
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const body: any = await apiClient.get("/shops/connect/status");
      setStatus(body?.data ?? null);
    } catch (error) {
      console.error("Failed to read payment status:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const chargesEnabled = status?.chargesEnabled === true;
  const hasAccount = !!status?.accountId;
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
    // Not outstanding in any bucket and the account exists → this info is already provided.
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
          {showOnboarding ? (
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
            </div>
          )}
        </div>
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
