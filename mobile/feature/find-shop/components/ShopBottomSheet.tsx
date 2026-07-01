import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ServiceGridItem } from "@/shared/components/shared/ServiceGridItem";
import { ShopWithLocation } from "../types";
import { ServiceData } from "@/feature/services/services/service.interface";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.6;
const DRAG_CLOSE_THRESHOLD = 80;

interface ShopBottomSheetProps {
  visible: boolean;
  shop: ShopWithLocation | null;
  services: ServiceData[];
  isLoadingServices?: boolean;
  onClose: () => void;
  onViewShop: () => void;
  onDirections: () => void;
}

export function ShopBottomSheet({
  visible,
  shop,
  services,
  isLoadingServices = false,
  onClose,
  onViewShop,
  onDirections,
}: ShopBottomSheetProps) {
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  const ratingServices = services.filter((s) => s.avgRating && s.avgRating > 0);
  const avgRating =
    ratingServices.length > 0
      ? ratingServices.reduce((sum, s) => sum + (s.avgRating ?? 0), 0) /
        ratingServices.length
      : null;
  const totalReviews = services.reduce((sum, s) => sum + (s.reviewCount ?? 0), 0);

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(SHEET_HEIGHT);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    }
  }, [visible, slideAnim]);

  const closeSheet = () => {
    Animated.timing(slideAnim, {
      toValue: SHEET_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => onClose());
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 4,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) slideAnim.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DRAG_CLOSE_THRESHOLD || g.vy > 0.5) {
          closeSheet();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 65,
            friction: 11,
          }).start();
        }
      },
    })
  ).current;

  if (!shop) return null;

  const address = [shop.address, shop.location?.city, shop.location?.state]
    .filter(Boolean)
    .join(", ");

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={closeSheet}
    >
      {/* Backdrop */}
      <Pressable className="flex-1 bg-black/30" onPress={closeSheet} />

      {/* Bottom Sheet */}
      <Animated.View
        style={[
          {
            transform: [{ translateY: slideAnim }],
            height: SHEET_HEIGHT,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
          },
        ]}
        className="absolute bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 overflow-hidden"
      >
        {/* Drag Handle */}
        <View
          {...panResponder.panHandlers}
          className="items-center pt-3 pb-2"
        >
          <View className="w-10 h-1 rounded-full bg-zinc-700" />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 36 }}
          scrollEventThrottle={16}
        >
          {/* Facebook-style profile header */}
          <View className="flex-row items-center gap-4 px-4 pt-2 pb-5 border-b border-zinc-800">
            {/* Circular avatar */}
            <View className="w-16 h-16 rounded-full overflow-hidden bg-zinc-800 items-center justify-center border-2 border-zinc-700">
              {shop.logoUrl ? (
                <Image
                  source={{ uri: shop.logoUrl }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              ) : (
                <View className="w-full h-full items-center justify-center bg-[#FFCC00]/10">
                  <Ionicons name="storefront" size={28} color="#FFCC00" />
                </View>
              )}
            </View>

            {/* Shop info */}
            <View className="flex-1">
              {/* Name + Verified */}
              <View className="flex-row items-center gap-1.5 flex-wrap">
                <Text className="text-white text-lg font-bold" numberOfLines={1}>
                  {shop.name || "Unknown Shop"}
                </Text>
                {shop.verified && (
                  <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                )}
              </View>

              {/* Rating */}
              <View className="flex-row items-center gap-1 mt-0.5">
                <Ionicons name="star" size={13} color="#FFCC00" />
                {avgRating !== null ? (
                  <>
                    <Text className="text-white text-sm font-semibold">
                      {avgRating.toFixed(1)}
                    </Text>
                    <Text className="text-zinc-500 text-xs">
                      ({totalReviews} review{totalReviews !== 1 ? "s" : ""})
                    </Text>
                  </>
                ) : (
                  <Text className="text-zinc-500 text-xs">No reviews yet</Text>
                )}
              </View>

              {/* Address */}
              {address ? (
                <View className="flex-row items-start gap-1 mt-1">
                  <Ionicons name="location-outline" size={12} color="#71717a" style={{ marginTop: 1 }} />
                  <Text className="text-zinc-500 text-xs flex-1 leading-4" numberOfLines={2}>
                    {address}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View className="px-4 pt-4">
            {/* Action Buttons */}
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => {
                  closeSheet();
                  setTimeout(onViewShop, 280);
                }}
                className="flex-1 bg-zinc-800 py-3.5 rounded-xl flex-row items-center justify-center"
              >
                <Ionicons name="storefront-outline" size={19} color="#FFCC00" />
                <Text className="text-white font-semibold ml-2">View Shop</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  closeSheet();
                  setTimeout(onDirections, 280);
                }}
                className="flex-1 bg-[#FFCC00] py-3.5 rounded-xl flex-row items-center justify-center"
              >
                <Ionicons name="navigate" size={19} color="#000" />
                <Text className="text-black font-semibold ml-2">Directions</Text>
              </Pressable>
            </View>
          </View>

          {/* Services — reuses ServiceCard (same component as Services tab) */}
          <View className="mt-5">
            <Text className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mb-1 px-4">
              Services Offered
            </Text>

            {isLoadingServices ? (
              <View className="py-6 items-center">
                <ActivityIndicator size="small" color="#FFCC00" />
                <Text className="text-zinc-500 text-xs mt-2">Loading services...</Text>
              </View>
            ) : services.length === 0 ? (
              <View className="mx-4 py-6 items-center bg-zinc-800/50 rounded-2xl">
                <Ionicons name="construct-outline" size={32} color="#52525b" />
                <Text className="text-zinc-400 text-sm font-medium mt-2">No services available</Text>
                <Text className="text-zinc-600 text-xs mt-1 text-center">
                  This shop hasn't listed any services yet.
                </Text>
              </View>
            ) : (
              <>
                <View style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16 }}>
                  {services.slice(0, 6).map((service) => (
                    <ServiceGridItem key={service.serviceId} service={service} />
                  ))}
                </View>
                {services.length > 6 && (
                  <Text className="text-zinc-500 text-xs text-center mb-2">
                    +{services.length - 6} more · tap View Shop to see all
                  </Text>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}
