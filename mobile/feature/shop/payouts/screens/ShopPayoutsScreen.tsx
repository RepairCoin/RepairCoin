import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from "react-native";
import { AntDesign, Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ThemedView } from "@/shared/components/ui/ThemedView";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import {
  useConnectStatusQuery,
  useConnectSummaryQuery,
  useCreateConnectOnboardingLinkMutation,
  useCreateHostedOnboardingLinkMutation,
} from "../hooks/useShopPayoutsQuery";

type StepId =
  | "verify_business"
  | "business_details"
  | "owner_kyc"
  | "bank"
  | "tax"
  | "identity";

// The FixFlow-branded "Get Paid" journey — OUR labels around Stripe's embedded onboarding.
// Mirrors frontend/src/app/(authenticated)/shop/get-paid/page.tsx; keep the two in sync.
const STEPS: {
  id: StepId;
  label: string;
  blurb: string;
  icon: keyof typeof Feather.glyphMap;
}[] = [
  { id: "verify_business", label: "Verify Business", blurb: "Confirm your business type and registration.", icon: "briefcase" },
  { id: "business_details", label: "Business Details", blurb: "Name, address, website, and contact.", icon: "file-text" },
  { id: "owner_kyc", label: "Owner Verification", blurb: "Verify the business owner (KYC).", icon: "user-check" },
  { id: "bank", label: "Bank Account", blurb: "Where your payouts land.", icon: "credit-card" },
  { id: "tax", label: "Tax Information", blurb: "Tax ID for reporting.", icon: "percent" },
  { id: "identity", label: "Identity Verification", blurb: "Upload an ID document if requested.", icon: "shield" },
];

// Best-effort bucketing of a Stripe requirement key into one of our steps. Heuristic and
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

type StepState = "done" | "action" | "review" | "todo";

function StepBadge({ state }: { state: StepState }) {
  if (state === "done") {
    return (
      <View className="w-6 h-6 rounded-full bg-green-500/20 items-center justify-center">
        <Feather name="check" size={14} color="#22C55E" />
      </View>
    );
  }
  if (state === "action") {
    return (
      <View className="rounded-full bg-[#FFCC00]/20 px-2.5 py-1">
        <Text className="text-[#FFCC00] text-xs font-medium">Action needed</Text>
      </View>
    );
  }
  if (state === "review") {
    return (
      <View className="rounded-full bg-white/10 px-2.5 py-1">
        <Text className="text-gray-400 text-xs font-medium">In review</Text>
      </View>
    );
  }
  return (
    <View className="rounded-full border border-white/10 px-2.5 py-1">
      <Text className="text-gray-400 text-xs font-medium">To do</Text>
    </View>
  );
}

export default function ShopPayoutsScreen() {
  const router = useRouter();

  // Summary keeps the DB-only gate cache warm; status is the live Stripe read this
  // screen renders from (this is the one screen allowed to enable it on mount).
  useConnectSummaryQuery();
  const {
    data: status,
    isLoading: isLoadingStatus,
    isError: statusFailed,
    refetch: refetchStatus,
  } = useConnectStatusQuery({ enabled: true });

  // Opens Stripe's hosted onboarding in the auth browser and refreshes the connect
  // queries when the shop comes back (the hook owns that whole round trip).
  const { mutate: startHostedOnboarding, isPending: isStartingOnboarding } =
    useCreateHostedOnboardingLinkMutation();
  const { mutate: connectExisting, isPending: isConnectingExisting } =
    useCreateConnectOnboardingLinkMutation();

  const chargesEnabled = status?.chargesEnabled === true;
  const hasAccount = !!status?.accountId;
  const isStandard = status?.accountType === "standard";
  // A failed read leaves `status` undefined — indistinguishable from a shop that never
  // connected anything, which would render "Set Up Payments" and create a second,
  // FixFlow-managed account for a shop that already has its own. Retry only.
  const loadFailed = statusFailed && !status;

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

  return (
    <ThemedView className="flex-1">
      {/* Header */}
      <View className="pt-14 pb-4 px-5">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
            <AntDesign name="arrowleft" color="white" size={24} />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Get Paid</Text>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {isLoadingStatus ? (
          <View className="items-center py-16">
            <ActivityIndicator size="small" color="#FFCC00" />
          </View>
        ) : loadFailed ? (
          /* Status unknown — not "no account". Offering setup here could point the shop at a
             new account while their existing one is still taking payments. */
          <View className="px-5 mt-4">
            <View className="bg-[#1A1A1A] rounded-2xl p-6 items-center">
              <Text className="text-gray-400 text-sm text-center mb-4">
                We couldn't load your payment status just now.
              </Text>
              <PrimaryButton title="Try Again" onPress={() => refetchStatus()} />
              <Text className="text-gray-500 text-xs text-center mt-3">
                Nothing has changed about your account — this is only a display
                problem.
              </Text>
            </View>
          </View>
        ) : isStandard ? (
          /* The shop's own Stripe account. We can't mint an Account Session for it, so the
             embedded editor is impossible — and offering "Set Up Payments" here would create
             a SEPARATE Express account and point us away from the one taking their money.
             Show what Stripe still wants and send them where they can actually change it. */
          <View className="px-5 mt-4">
            <View className="bg-[#1A1A1A] rounded-2xl p-5">
              <View className="flex-row items-center">
                <View className="w-9 h-9 rounded-full bg-[#FFCC00]/10 items-center justify-center mr-3">
                  <Feather name="credit-card" size={16} color="#FFCC00" />
                </View>
                <View className="flex-1">
                  <Text className="text-white font-medium text-sm">
                    Your own Stripe account
                  </Text>
                  {status?.accountId && (
                    <Text
                      className="text-gray-500 text-xs mt-0.5"
                      numberOfLines={1}
                    >
                      {status.accountId}
                    </Text>
                  )}
                </View>
                <View
                  className={`rounded-full px-2.5 py-1 ${
                    chargesEnabled ? "bg-green-500/20" : "bg-[#FFCC00]/20"
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      chargesEnabled ? "text-green-500" : "text-[#FFCC00]"
                    }`}
                  >
                    {chargesEnabled ? "Active" : "Action needed"}
                  </Text>
                </View>
              </View>

              {chargesEnabled ? (
                <Text className="text-gray-400 text-sm mt-4 leading-5">
                  Payments are active. Manage payouts, details, and bank accounts
                  from your Stripe dashboard.
                </Text>
              ) : (
                <View className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
                  <Text className="text-gray-400 text-xs leading-5">
                    Because this account is yours, these can only be completed in
                    Stripe — we can't edit it from here.
                  </Text>
                  {outstanding.length > 0 ? (
                    <View className="mt-3">
                      {outstanding.map((label) => (
                        <View key={label} className="flex-row items-start mb-2">
                          <View className="w-1.5 h-1.5 rounded-full bg-[#FFCC00] mt-1.5 mr-2.5" />
                          <Text className="text-white text-sm flex-1">{label}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text className="text-white text-sm mt-3">
                      Nothing outstanding — Stripe may still be reviewing your
                      details.
                    </Text>
                  )}
                </View>
              )}

              <PrimaryButton
                title="Open Stripe Dashboard"
                onPress={() => Linking.openURL(STRIPE_DASHBOARD_URL)}
                className="mt-5"
              />
              <TouchableOpacity
                onPress={() => refetchStatus()}
                className="mt-3 py-2 items-center"
              >
                <Text className="text-gray-400 text-sm">Refresh status</Text>
              </TouchableOpacity>
              <Text className="text-gray-500 text-xs text-center mt-1">
                Finished in Stripe? Come back and hit refresh.
              </Text>
            </View>
          </View>
        ) : chargesEnabled ? (
          <View className="px-5">
            <View className="bg-[#1A1A1A] rounded-2xl p-6 items-center border border-green-500/30 mt-4">
              <View className="bg-green-500/20 rounded-full p-4 mb-4">
                <Ionicons name="checkmark-circle" size={40} color="#22C55E" />
              </View>
              <Text className="text-white text-lg font-bold mb-1">
                Payouts Connected
              </Text>
              <Text className="text-gray-400 text-sm text-center">
                Your Stripe account is connected. Customer payments settle
                directly to your shop.
              </Text>
            </View>
          </View>
        ) : (
          <>
            <View className="px-5 mt-2 mb-4">
              <Text className="text-[#FFCC00] text-lg font-bold mb-2">
                Get Paid
              </Text>
              <Text className="text-gray-400 text-sm">
                Set up FixFlow Payments to accept cards and receive payouts — all
                inside the app. Your details are verified securely by Stripe;
                FixFlow never stores your banking information.
              </Text>
            </View>

            {overall === "review" && (
              <View className="px-5 mb-4">
                <View className="bg-[#FFCC00]/10 border border-[#FFCC00]/30 rounded-2xl p-4 flex-row items-center">
                  <Feather name="clock" size={16} color="#FFCC00" />
                  <Text className="text-white text-sm ml-3 flex-1">
                    Your details are being reviewed — payments turn on
                    automatically once approved.
                  </Text>
                </View>
              </View>
            )}

            <View className="px-5">
              {STEPS.map(({ id, label, blurb, icon }) => {
                const state = stepState(id);
                return (
                  <View
                    key={id}
                    className="bg-[#1A1A1A] rounded-2xl p-4 mb-3 flex-row items-center"
                  >
                    <View className="w-9 h-9 rounded-full bg-[#FFCC00]/20 items-center justify-center mr-3">
                      <Feather name={icon} size={16} color="#FFCC00" />
                    </View>
                    <View className="flex-1 mr-3">
                      <Text className="text-white font-semibold text-sm mb-0.5">
                        {label}
                      </Text>
                      <Text className="text-gray-400 text-xs" numberOfLines={1}>
                        {blurb}
                      </Text>
                    </View>
                    <StepBadge state={state} />
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      {!isLoadingStatus && !loadFailed && !isStandard && !chargesEnabled && (
        <View className="px-5 py-4 border-t border-gray-800 bg-black">
          <PrimaryButton
            title={
              isStartingOnboarding
                ? "Opening Stripe..."
                : overall === "not_started"
                ? "Set Up Payments"
                : "Continue Setup"
            }
            onPress={() => startHostedOnboarding()}
            loading={isStartingOnboarding}
            disabled={isStartingOnboarding}
          />
          <Text className="text-gray-500 text-center text-xs mt-2">
            You'll be securely redirected to Stripe. FixFlow never stores your
            banking information.
          </Text>
          {/* Existing-account path: adopting a Stripe account the shop already owns is only
              possible through Stripe-hosted OAuth (external browser → deep link back). */}
          <TouchableOpacity
            onPress={() => connectExisting()}
            disabled={isConnectingExisting}
            className="mt-3 py-1 items-center"
          >
            <Text className="text-[#FFCC00] text-sm font-medium">
              {isConnectingExisting
                ? "Waiting for Stripe..."
                : "Already have a Stripe account? Connect it instead"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </ThemedView>
  );
}
