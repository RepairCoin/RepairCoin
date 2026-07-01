import React from "react";
import { View, Text, ScrollView, Pressable, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useShop } from "@/feature/shop/account/hooks/useShopQuery";
import { ShopData } from "@/feature/shop/services/shop.interface";
import SectionHeader from "@/shared/components/ui/SectionHeader";
import { SkeletonHorizontalCards } from "@/shared/components/ui/Skeleton";

const CARD_WIDTH = 260;

/**
 * V2 Home "Nearby Shops" carousel. Sourced from the shops list; distance/rating
 * are omitted until geolocation + shop-rating data are wired (see follow-ups).
 */
function NearbyShopsSection() {
  const { useGetShops } = useShop();
  const { data, isLoading } = useGetShops();

  const shops: ShopData[] = React.useMemo(() => {
    const list = data?.shops ?? [];
    return list.filter((s) => s.active !== false).slice(0, 8);
  }, [data]);

  if (!isLoading && shops.length === 0) return null;

  return (
    <View>
      <SectionHeader
        title="Nearby Shops"
        onSeeAll={() => router.push("/customer/tabs/find-shop")}
      />
      {isLoading ? (
        <SkeletonHorizontalCards count={3} cardWidth={CARD_WIDTH} />
      ) : (
        <View style={{ marginHorizontal: -16 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            decelerationRate="fast"
            snapToInterval={CARD_WIDTH + 12}
          >
            {shops.map((shop) => (
              <Pressable
                key={shop.shopId}
                onPress={() => router.push("/customer/tabs/find-shop")}
                style={{ width: CARD_WIDTH, marginRight: 12 }}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden active:border-[#FFCC00]/50"
              >
                {shop.bannerUrl || shop.logoUrl ? (
                  <Image
                    source={{ uri: shop.bannerUrl || shop.logoUrl }}
                    className="w-full h-32"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="w-full h-32 bg-zinc-800 items-center justify-center">
                    <Ionicons name="storefront" size={32} color="#FFCC00" />
                  </View>
                )}
                <View className="p-3">
                  <View className="flex-row items-center">
                    <Text
                      className="text-white text-base font-bold flex-1"
                      numberOfLines={1}
                    >
                      {shop.name || "Shop"}
                    </Text>
                    {shop.verified && (
                      <Ionicons
                        name="checkmark-circle"
                        size={15}
                        color="#22C55E"
                        style={{ marginLeft: 4 }}
                      />
                    )}
                  </View>
                  <View className="flex-row items-center mt-1">
                    <Ionicons name="location-outline" size={12} color="#9CA3AF" />
                    <Text
                      className="text-zinc-400 text-xs ml-1 flex-1"
                      numberOfLines={1}
                    >
                      {shop.address || "No address"}
                    </Text>
                  </View>
                  {shop.rcg_tier ? (
                    <View className="flex-row mt-2">
                      <View className="bg-[#FFCC00]/15 px-2 py-0.5 rounded-full">
                        <Text className="text-[#FFCC00] text-[10px] font-medium capitalize">
                          {shop.rcg_tier}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

export default React.memo(NearbyShopsSection);
