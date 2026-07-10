import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { getCategoryIcon } from "@/shared/constants/service-categories";

interface ShopGridCardProps {
  imageUrl?: string | null;
  name: string;
  address?: string | null;
  verified?: boolean;
  /** Shop category — its icon is shown when no image is available. */
  category?: string | null;
  /** Average rating (0–5). Rating row is hidden when undefined. */
  rating?: number;
  reviewCount?: number;
  /** Pre-formatted distance/eta, e.g. "4.5km/50min". Hidden when undefined. */
  distanceLabel?: string;
  /** Photo height in dp. Defaults to 160; pass a screen-derived value to scale. */
  imageHeight?: number;
  onPress?: () => void;
}

/**
 * V2 marketplace-style shop card (white, image-on-top) matching the Figma
 * "Card" design: photo, name, address, rating, and a divided distance row.
 * Rating and distance rows render only when their data is provided.
 */
function ShopGridCard({
  imageUrl,
  name,
  address,
  verified,
  category,
  rating,
  reviewCount,
  distanceLabel,
  imageHeight = 160,
  onPress,
}: ShopGridCardProps) {
  const hasRating = rating != null && rating > 0;
  const reviewLabel =
    reviewCount != null
      ? `(${reviewCount} ${reviewCount === 1 ? "review" : "reviews"})`
      : "";

  // Fallback icon scales with the photo area so it stays proportional on any screen.
  const iconSize = Math.round(imageHeight * 0.6);

  // Fall back to the category icon when there's no URL OR the image fails to load.
  const [imageFailed, setImageFailed] = React.useState(false);
  React.useEffect(() => setImageFailed(false), [imageUrl]);
  const showImage = !!imageUrl && !imageFailed;

  return (
    <View
      className="bg-white rounded-2xl overflow-hidden flex-1"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 3,
      }}
    >
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} className="flex-1">
        {/* Photo — inset with its own rounded corners */}
        <View className="p-3 pb-0">
          <View className="rounded-2xl overflow-hidden bg-gray-100">
            {showImage ? (
              <Image
                source={{ uri: imageUrl! }}
                className="w-full"
                style={{ height: imageHeight }}
                resizeMode="cover"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <View
                className="w-full items-center justify-center"
                style={{ height: imageHeight }}
              >
                <Ionicons
                  name={getCategoryIcon(category)}
                  size={iconSize}
                  color="#9CA3AF"
                />
              </View>
            )}
          </View>
        </View>

        <View className="flex-1 p-3">
          {/* Name */}
          <View className="flex-row items-center">
            <Text
              className="text-gray-900 text-[17px] font-bold flex-1"
              numberOfLines={1}
            >
              {name || "Shop"}
            </Text>
            {verified && (
              <Ionicons
                name="checkmark-circle"
                size={16}
                color="#22C55E"
                style={{ marginLeft: 4 }}
              />
            )}
          </View>

          {/* Address */}
          {address ? (
            <View className="flex-row items-start mt-1.5">
              <Ionicons
                name="location-outline"
                size={13}
                color="#9CA3AF"
                style={{ marginTop: 1 }}
              />
              <Text
                className="text-gray-500 text-xs ml-1 flex-1 leading-4"
                numberOfLines={2}
              >
                {address}
              </Text>
            </View>
          ) : null}

          {/* Rating */}
          {hasRating && (
            <View className="flex-row items-center mt-1.5">
              <Ionicons name="star" size={14} color="#F59E0B" />
              <Text className="text-gray-900 text-xs font-bold ml-1">
                {rating!.toFixed(1)}
              </Text>
              {reviewLabel ? (
                <Text className="text-gray-400 text-xs ml-1">{reviewLabel}</Text>
              ) : null}
            </View>
          )}

          {/* Distance / ETA — pinned to the bottom */}
          {distanceLabel ? (
            <View className="flex-row items-center mt-auto pt-2 border-t border-gray-100">
              <MaterialCommunityIcons name="run" size={16} color="#F59E0B" />
              <Text className="text-gray-500 text-xs ml-1">{distanceLabel}</Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    </View>
  );
}

export default React.memo(ShopGridCard);
