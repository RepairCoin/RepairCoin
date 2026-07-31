import React, { useMemo } from "react";
import { Text, View, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Badge from "@/shared/components/ui/Badge";
import { useHaptics } from "@/shared/hooks/useHaptics";
import { AdPlacement } from "@/feature/services/services/service.interface";

interface SponsoredAdCardProps {
  ad: AdPlacement;
  onPress: () => void;
}

/**
 * Full-width sponsored card for in-app ad placements (ad_campaigns). Spans both columns of the
 * service grid, so it uses a landscape hero rather than ServiceCard's portrait tile — which is
 * why this is its own component instead of another ServiceCard variant.
 *
 * The "Sponsored" pill is deliberately always rendered and always legible: paid placement must
 * never be mistakable for organic content.
 *
 * Tapping opens the campaign's in-app landing page (AdLandingScreen) — the native twin of the web
 * /l/:campaignId page every off-platform ad click lands on.
 */
function SponsoredAdCard({ ad, onPress }: SponsoredAdCardProps) {
  const haptics = useHaptics();

  const imageSource = useMemo(
    () => (ad.imageUrl ? { uri: ad.imageUrl } : null),
    [ad.imageUrl],
  );
  const logoSource = useMemo(
    () => (ad.logoUrl ? { uri: ad.logoUrl } : null),
    [ad.logoUrl],
  );

  const handlePress = () => {
    haptics.light();
    onPress();
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.85} className="w-full">
      <View className="rounded-2xl overflow-hidden bg-zinc-900">
        {/* Hero */}
        <View className="relative">
          {imageSource ? (
            <Image source={imageSource} className="w-full h-40" resizeMode="cover" />
          ) : (
            <View className="w-full h-40 bg-zinc-800 items-center justify-center">
              <Ionicons name="megaphone-outline" size={32} color="#6B7280" />
            </View>
          )}

          <View className="absolute top-2 left-2">
            <Badge label="Sponsored" tone="neutral" icon={{ name: "megaphone" }} />
          </View>

          {ad.offer && (
            <View className="absolute bottom-2 left-2">
              <Badge label={ad.offer} tone="discount" icon={null} size="md" />
            </View>
          )}
        </View>

        {/* Body */}
        <View className="p-3">
          <View className="flex-row items-center mb-1.5">
            {logoSource ? (
              <Image source={logoSource} className="w-5 h-5 rounded-full mr-2" resizeMode="cover" />
            ) : (
              <View className="w-5 h-5 rounded-full bg-zinc-700 items-center justify-center mr-2">
                <Ionicons name="storefront-outline" size={11} color="#9CA3AF" />
              </View>
            )}
            <Text className="text-gray-400 text-xs flex-1" numberOfLines={1}>
              {ad.shopName}
            </Text>
          </View>

          <Text className="text-white text-base font-semibold" numberOfLines={2}>
            {ad.headline}
          </Text>

          {ad.body && (
            <Text className="text-gray-400 text-xs mt-1" numberOfLines={2}>
              {ad.body}
            </Text>
          )}

          <View className="flex-row items-center mt-2">
            {/* The tap goes to the campaign landing page, not the service/shop, so the label is
                offer-framed rather than naming `ad.target`. */}
            <Text className="text-[#FFCC00] text-xs font-semibold">
              {ad.offer ? "Claim offer" : "Learn more"}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={12}
              color="#FFCC00"
              style={{ marginLeft: 2 }}
            />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default React.memo(SponsoredAdCard);
