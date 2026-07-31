import React, { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useHaptics } from "@/shared/hooks/useHaptics";
import { useSubmitAdLeadMutation } from "../hooks/useFeatureTabQuery";

interface AdLeadFormProps {
  campaignId: string;
  /** CTA label from the campaign's landing config; the default matches the web form. */
  ctaLabel?: string;
  /** Shop name, used in the confirmation copy. */
  shopName?: string;
  /** Brand accent (hex) from the shop's brand kit. */
  accent: string;
  /** Known contact details for the signed-in customer — saves them retyping. */
  prefill?: { name?: string; phone?: string; email?: string };
  /** Fires once the lead is captured, so the screen can drop its sticky CTA. */
  onSubmitted?: () => void;
}

/**
 * In-app twin of the web AdLeadForm (frontend/src/components/ads/AdLeadForm.tsx). Posts to the
 * same public webform endpoint, so leads from the app and from a Meta/Google ad click land in one
 * pipeline and dedupe against each other by phone.
 *
 * Phone-first ordering is deliberate and matches web: it's the fastest contact channel AND the
 * key the backend dedupes on. Either phone or email is required — never both.
 */
export function AdLeadForm({
  campaignId,
  ctaLabel,
  shopName,
  accent,
  prefill,
  onSubmitted,
}: AdLeadFormProps) {
  const haptics = useHaptics();
  const [form, setForm] = useState({
    name: prefill?.name ?? "",
    phone: prefill?.phone ?? "",
    email: prefill?.email ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const { mutate: submitLead, isPending } = useSubmitAdLeadMutation();

  const handleSubmit = () => {
    setError(null);
    if (!form.phone.trim() && !form.email.trim()) {
      setError("Please add a phone number or email so we can reach you.");
      return;
    }
    haptics.medium();
    submitLead(
      {
        campaignId,
        name: form.name.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        // The app has no URL to read UTMs from, so it stamps its own — this is what separates
        // an in-app lead from a Meta/Google click in attribution reporting.
        utm: {
          utm_source: "repaircoin_app",
          utm_medium: "in_app_ad",
          utm_campaign: campaignId,
        },
      },
      {
        onSuccess: () => {
          setDone(true);
          onSubmitted?.();
        },
        onError: (err: any) =>
          setError(
            err?.response?.data?.error || "Something went wrong. Please try again.",
          ),
      },
    );
  };

  if (done) {
    return (
      <View className="rounded-2xl border border-green-500/30 bg-green-900/10 p-6 items-center">
        <Ionicons name="checkmark-circle" size={36} color="#4ADE80" />
        <Text className="text-white text-base font-semibold mt-2">You&apos;re all set! 🎉</Text>
        <Text className="text-gray-300 text-sm text-center mt-1">
          {shopName ? `${shopName} will reach out shortly` : "We'll reach out shortly"} — keep an
          eye on your phone.
        </Text>
      </View>
    );
  }

  return (
    <View className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
      <Text className="text-white text-lg font-semibold">
        Claim this offer — leave your details
      </Text>
      <Text className="text-gray-400 text-sm mt-0.5">
        Tell us how to reach you and we&apos;ll get right back to you.
      </Text>

      <View className="mt-3 gap-3">
        <TextInput
          className="w-full px-3 py-3 bg-zinc-950 border border-zinc-700 rounded-xl text-white text-base"
          placeholder="Phone number"
          placeholderTextColor="#6B7280"
          keyboardType="phone-pad"
          value={form.phone}
          onChangeText={(phone) => setForm((f) => ({ ...f, phone }))}
        />
        <TextInput
          className="w-full px-3 py-3 bg-zinc-950 border border-zinc-700 rounded-xl text-white text-base"
          placeholder="Your name"
          placeholderTextColor="#6B7280"
          value={form.name}
          onChangeText={(name) => setForm((f) => ({ ...f, name }))}
        />
        <TextInput
          className="w-full px-3 py-3 bg-zinc-950 border border-zinc-700 rounded-xl text-white text-base"
          placeholder="Email (optional)"
          placeholderTextColor="#6B7280"
          keyboardType="email-address"
          autoCapitalize="none"
          value={form.email}
          onChangeText={(email) => setForm((f) => ({ ...f, email }))}
        />
      </View>

      {error && <Text className="text-red-400 text-sm mt-3">{error}</Text>}

      <Pressable
        onPress={handleSubmit}
        disabled={isPending}
        style={{ backgroundColor: accent, opacity: isPending ? 0.5 : 1 }}
        className="mt-4 w-full flex-row items-center justify-center rounded-xl py-3.5"
        android_ripple={{ color: "rgba(0,0,0,0.08)" }}
      >
        {isPending && <ActivityIndicator size="small" color="#000" style={{ marginRight: 8 }} />}
        <Text className="text-black text-base font-bold">
          {isPending ? "Sending…" : ctaLabel || "Get my free quote"}
        </Text>
      </Pressable>

      <View className="flex-row items-center justify-center gap-1.5 mt-3">
        <Ionicons name="shield-checkmark-outline" size={13} color="#6B7280" />
        <Text className="text-gray-500 text-xs">
          No obligation · we never share your details.
        </Text>
      </View>
    </View>
  );
}

export default AdLeadForm;
