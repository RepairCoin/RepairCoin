import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { AdLandingService } from "@/feature/services/services/service.interface";
import { useAdLandingQuery } from "../../feature-tab/hooks/useFeatureTabQuery";
import { AdLeadForm } from "../../feature-tab/components/AdLeadForm";

/** Brand fallback when the shop has no brand kit — same value the web landing page uses. */
const ACCENT_FALLBACK = "#FFCC00";

const fmtPrice = (p: number | null) =>
  p == null ? null : `$${p % 1 === 0 ? p.toFixed(0) : p.toFixed(2)}`;

/**
 * In-app ad landing page — the native twin of the web page at /l/:campaignId
 * (frontend/src/components/ads/LandingView.tsx), reached by tapping a sponsored card.
 *
 * Both surfaces read the same public GET /ads/landing/:campaignId and post to the same webform
 * endpoint, so the offer copy, promoted services and lead pipeline stay identical — the only
 * intentional divergences are native ones: no Meta Pixel (web-only), the lead form prefills from
 * the signed-in customer, and promoted services deep-link into the app's own service detail
 * screen instead of being static tiles.
 */
export default function AdLandingScreen() {
  const { campaignId } = useLocalSearchParams<{ campaignId: string }>();
  const { data, isLoading, error } = useAdLandingQuery(campaignId ?? "");
  const { userProfile } = useAuthStore();

  const scrollRef = useRef<ScrollView>(null);
  const formOffset = useRef(0);
  const [leadCaptured, setLeadCaptured] = useState(false);

  // Registered customers already gave us these — don't make them retype to claim an offer.
  const prefill = useMemo(() => {
    const p = userProfile?.customer ?? userProfile;
    return { name: p?.name ?? "", phone: p?.phone ?? "", email: p?.email ?? "" };
  }, [userProfile]);

  const scrollToForm = useCallback(() => {
    scrollRef.current?.scrollTo({ y: Math.max(formOffset.current - 24, 0), animated: true });
  }, []);

  const handleServicePress = useCallback((service: AdLandingService) => {
    router.push(`/customer/service/${service.id}` as any);
  }, []);

  if (isLoading) {
    return (
      <View className="flex-1 bg-zinc-950">
        <AppHeader title="Sponsored" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={ACCENT_FALLBACK} />
        </View>
      </View>
    );
  }

  // A campaign can end or be deleted between the placement being cached and the tap landing here.
  if (error || !data) {
    return (
      <View className="flex-1 bg-zinc-950">
        <AppHeader title="Sponsored" />
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="pricetag-outline" size={56} color="#6B7280" />
          <Text className="text-gray-400 text-base text-center mt-4">
            This offer isn&apos;t available right now.
          </Text>
        </View>
      </View>
    );
  }

  const accent = data.primaryColor || ACCENT_FALLBACK;
  const location = [data.city, data.state].filter(Boolean).join(", ");
  const showTrust = (data.rating != null && data.reviewCount > 0) || !!location;
  const ctaLabel = data.ctaLabel || "Get my free quote";

  return (
    <View className="flex-1 bg-zinc-950">
      <AppHeader title="Sponsored" />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 16, paddingBottom: leadCaptured ? 40 : 120 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Shop header */}
          <View className="items-center gap-2">
            {data.logoUrl && (
              <Image
                source={{ uri: data.logoUrl }}
                className="h-12 w-32"
                resizeMode="contain"
              />
            )}
            <Text className="text-gray-500 text-xs uppercase tracking-wide">
              Special offer from
            </Text>
            <Text className="text-white text-2xl font-bold text-center">{data.shopName}</Text>
          </View>

          {/* Trust bar — rating + location chips */}
          {showTrust && (
            <View className="flex-row items-center justify-center flex-wrap gap-2 mt-4">
              {data.rating != null && data.reviewCount > 0 && (
                <View className="flex-row items-center gap-1.5 rounded-full border border-white/10 bg-zinc-900 px-3 py-1.5">
                  <Ionicons name="star" size={14} color={ACCENT_FALLBACK} />
                  <Text className="text-white text-sm font-semibold">{data.rating}</Text>
                  <Text className="text-gray-400 text-sm">
                    · {data.reviewCount} review{data.reviewCount === 1 ? "" : "s"}
                  </Text>
                </View>
              )}
              {!!location && (
                <View className="flex-row items-center gap-1.5 rounded-full border border-white/10 bg-zinc-900 px-3 py-1.5">
                  <Ionicons name="location-outline" size={14} color="#9CA3AF" />
                  <Text className="text-gray-300 text-sm">Serving {location}</Text>
                </View>
              )}
            </View>
          )}

          {/* Hero — the approved ad creative, or the first promoted service photo */}
          {data.heroImageUrl && (
            <View className="rounded-2xl overflow-hidden border border-white/10 mt-4">
              <Image
                source={{ uri: data.heroImageUrl }}
                className="w-full h-52"
                resizeMode="cover"
              />
            </View>
          )}

          {/* Urgency / scarcity */}
          {data.urgencyText && (
            <View className="flex-row items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 mt-4">
              <Ionicons name="time-outline" size={16} color="#FCA5A5" />
              <Text className="text-red-300 text-sm flex-1">{data.urgencyText}</Text>
            </View>
          )}

          {/* Offer headline + subhead */}
          {data.headline && (
            <View
              className="rounded-2xl border px-4 py-4 mt-4"
              style={{ borderColor: `${accent}66`, backgroundColor: `${accent}1A` }}
            >
              <Text className="text-xl font-bold text-center" style={{ color: accent }}>
                {data.headline}
              </Text>
              {data.subhead && (
                <Text className="text-gray-300 text-sm text-center mt-1.5">{data.subhead}</Text>
              )}
            </View>
          )}

          {/* Benefit bullets */}
          {data.benefitBullets.length > 0 && (
            <View className="gap-2 mt-4">
              {data.benefitBullets.map((bullet, i) => (
                <View key={`${i}-${bullet}`} className="flex-row items-start gap-2">
                  <Ionicons
                    name="checkmark"
                    size={16}
                    color={accent}
                    style={{ marginTop: 2 }}
                  />
                  <Text className="text-gray-200 text-sm flex-1">{bullet}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Primary CTA — the lead form (+ optional call-now + trust line) */}
          <View
            className="mt-5"
            onLayout={(e) => {
              formOffset.current = e.nativeEvent.layout.y;
            }}
          >
            <AdLeadForm
              campaignId={campaignId ?? ""}
              ctaLabel={ctaLabel}
              shopName={data.shopName}
              accent={accent}
              prefill={prefill}
              onSubmitted={() => setLeadCaptured(true)}
            />

            {data.callNow && (
              <TouchableOpacity
                onPress={() => Linking.openURL(`tel:${data.callNow!.phone}`)}
                activeOpacity={0.8}
                className="mt-3 flex-row items-center justify-center gap-2 px-4 py-3 rounded-xl border border-white/15"
              >
                <Ionicons name="call-outline" size={16} color="#FFFFFF" />
                <Text className="text-white text-sm font-medium">
                  Or call now: {data.callNow.phone}
                </Text>
              </TouchableOpacity>
            )}

            <View className="flex-row items-center justify-center gap-1.5 mt-3">
              <Ionicons name="shield-checkmark-outline" size={13} color="#6B7280" />
              <Text className="text-gray-500 text-xs">Verified FixFlow shop</Text>
            </View>
          </View>

          {/* Testimonial — social proof */}
          {data.testimonial && (
            <View className="rounded-2xl border border-white/10 bg-zinc-900 p-4 mt-5">
              <Ionicons name="chatbox-ellipses" size={18} color={ACCENT_FALLBACK} />
              <Text className="text-gray-200 text-sm italic mt-1.5">
                “{data.testimonial.quote}”
              </Text>
              <View className="flex-row items-center gap-1 mt-2">
                {Array.from({ length: data.testimonial.rating }).map((_, i) => (
                  <Ionicons key={i} name="star" size={11} color={ACCENT_FALLBACK} />
                ))}
                <Text className="text-gray-400 text-xs ml-1">Verified customer</Text>
              </View>
            </View>
          )}

          {/* Promoted services — tappable in-app, unlike the web page's static tiles */}
          {data.services.length > 0 && (
            <View className="mt-6">
              <Text className="text-gray-400 text-sm font-medium mb-3">
                What we&apos;re offering
              </Text>
              <View className="gap-3">
                {data.services.map((service) => (
                  <TouchableOpacity
                    key={service.id}
                    onPress={() => handleServicePress(service)}
                    activeOpacity={0.85}
                    className="rounded-2xl border border-white/10 bg-zinc-900 overflow-hidden"
                  >
                    {service.imageUrl && (
                      <Image
                        source={{ uri: service.imageUrl }}
                        className="w-full h-36"
                        resizeMode="cover"
                      />
                    )}
                    <View className="p-3 flex-row items-center">
                      <View className="flex-1">
                        <Text className="text-white text-base font-medium" numberOfLines={2}>
                          {service.name}
                        </Text>
                        {fmtPrice(service.priceUsd) && (
                          <Text className="text-sm mt-0.5" style={{ color: accent }}>
                            {fmtPrice(service.priceUsd)}
                          </Text>
                        )}
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#6B7280" />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <Text className="text-gray-600 text-xs text-center mt-6">Powered by FixFlow</Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Sticky CTA — always one tap from the form, and gone once the lead is in. */}
      {!leadCaptured && (
        <View className="absolute bottom-0 left-0 right-0 p-3 bg-zinc-950/95 border-t border-white/10">
          <Pressable
            onPress={scrollToForm}
            style={{ backgroundColor: accent }}
            className="w-full items-center justify-center rounded-2xl py-4"
            android_ripple={{ color: "rgba(0,0,0,0.08)" }}
          >
            <Text className="text-black text-base font-extrabold">{ctaLabel}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
