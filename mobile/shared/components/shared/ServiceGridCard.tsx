import React, { memo, useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { getCategoryLabel } from "@/shared/utilities/getCategoryLabel";
import { ServiceData } from "@/feature/services/services/service.interface";
import { SERVICE_GRID_ITEM_WIDTH } from "./ServiceGridItem";

interface ServiceGridCardProps {
  service: ServiceData;
  isFavorited: boolean;
  /** Receives the whole service so the parent can pass a single stable callback. */
  onPress: (service: ServiceData) => void;
  /** Favorite mutation is owned by the list (one instance), not per card. */
  onToggleFavorite: (serviceId: string, isFavorited: boolean) => void;
}

const STARS = [1, 2, 3, 4, 5];

// Fixed card geometry so the FlatList can use getItemLayout — with a known row
// height it skips async measurement while scrolling, which is what removes the
// scroll jank. Keep SERVICE_GRID_ROW_HEIGHT in sync if the card layout changes.
const CARD_HEIGHT = 300;
const CARD_MARGIN_V = 8;
export const SERVICE_GRID_ROW_HEIGHT = CARD_HEIGHT + CARD_MARGIN_V * 2;

/**
 * Lightweight grid card for the customer Services list.
 *
 * Unlike the shared `ServiceCard`, this mounts NO React Query / mutation hooks
 * per cell — the favorite mutation lives once in the list and is passed down.
 * That keeps a long FlatList cheap (dozens of cells no longer each spin up a
 * mutation + query-client subscription). Memoized so only the toggled card
 * re-renders when the favorites set changes.
 */
function ServiceGridCardBase({
  service,
  isFavorited,
  onPress,
  onToggleFavorite,
}: ServiceGridCardProps) {
  const { serviceId, imageUrl, serviceName, category, priceUsd, avgRating, reviewCount } =
    service;

  // Local optimistic state for instant heart feedback — a cheap useState, not
  // a query hook. Kept in sync with the authoritative favorites set via prop.
  const [favorited, setFavorited] = useState(isFavorited);
  useEffect(() => setFavorited(isFavorited), [isFavorited]);

  const handlePress = useCallback(() => onPress(service), [onPress, service]);

  const handleFavorite = useCallback(() => {
    Haptics.selectionAsync();
    setFavorited((prev) => {
      onToggleFavorite(serviceId, prev);
      return !prev;
    });
  }, [onToggleFavorite, serviceId]);

  const rating = avgRating ?? 0;
  const rounded = Math.round(rating);
  const ratingLabel =
    reviewCount != null
      ? `(${reviewCount} ${reviewCount === 1 ? "review" : "reviews"})`
      : "";

  return (
    <View
      className="bg-white rounded-2xl overflow-hidden"
      style={{
        width: SERVICE_GRID_ITEM_WIDTH,
        height: CARD_HEIGHT,
        marginHorizontal: 4,
        marginVertical: CARD_MARGIN_V,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 3,
      }}
    >
      <TouchableOpacity onPress={handlePress} activeOpacity={0.85} className="flex-1">
        <View className="relative bg-white">
          {imageUrl ? (
            // expo-image caches decoded bitmaps (memory + disk), so cells that
            // unmount/remount while scrolling don't re-decode from scratch —
            // fixes the flicker/jank when scrolling back up.
            <Image
              source={{ uri: imageUrl }}
              style={{ width: "100%", height: 160 }}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={120}
            />
          ) : (
            <View className="w-full h-40 bg-gray-100 items-center justify-center">
              <Ionicons name="image-outline" size={32} color="#9CA3AF" />
            </View>
          )}

          <TouchableOpacity
            onPress={handleFavorite}
            activeOpacity={0.7}
            hitSlop={8}
            className="absolute top-2 right-2 bg-white/90 rounded-full p-1.5"
            style={{
              shadowColor: "#000",
              shadowOpacity: 0.15,
              shadowRadius: 3,
              elevation: 2,
            }}
          >
            <Ionicons
              name={favorited ? "heart" : "heart-outline"}
              size={18}
              color={favorited ? "#EF4444" : "#111827"}
            />
          </TouchableOpacity>
        </View>

        <View className="flex-1 p-3">
          {/* Title — fixed 2-line height so cards align regardless of wrap. */}
          <Text
            className="text-gray-900 text-[15px] font-bold leading-5"
            numberOfLines={2}
            ellipsizeMode="tail"
            style={{ height: 40 }}
          >
            {serviceName}
          </Text>

          {/* Category — fixed height keeps the row aligned across cards. */}
          <View className="flex-row items-center mt-1.5" style={{ height: 18 }}>
            <Text className="text-gray-500 text-xs flex-1" numberOfLines={1}>
              {getCategoryLabel(category)}
            </Text>
          </View>

          {/* Rating */}
          {rating > 0 ? (
            <View className="flex-row items-center pt-1.5">
              {STARS.map((s) => (
                <Ionicons
                  key={s}
                  name={s <= rounded ? "star" : "star-outline"}
                  size={13}
                  color="#FFCC00"
                  style={{ marginRight: 1 }}
                />
              ))}
              {ratingLabel ? (
                <Text className="text-gray-500 text-xs ml-1.5">{ratingLabel}</Text>
              ) : null}
            </View>
          ) : (
            <View className="flex-row items-center pt-1.5">
              <Ionicons
                name="star-outline"
                size={13}
                color="#6B7280"
                style={{ marginRight: 4 }}
              />
              <Text className="text-gray-500 text-xs">Not yet rated</Text>
            </View>
          )}

          {/* Price */}
          <View className="pt-1.5">
            <Text className="text-gray-900 font-bold text-lg">$ {priceUsd}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

export const ServiceGridCard = memo(ServiceGridCardBase);
