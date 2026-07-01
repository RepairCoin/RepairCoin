import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Text, View, TouchableOpacity, Image } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useToggleFavoriteMutation } from "@/feature/services/services-main/feature-tab/hooks/useFeatureTabQuery";
import { useHaptics } from "@/shared/hooks/useHaptics";
import { getCategoryLabel } from "@/shared/utilities/getCategoryLabel";
import Badge from "@/shared/components/ui/Badge";

interface ServiceCardProps {
  imageUrl?: string | null;
  category: string;
  title: string;
  description?: string | null;
  price: number;
  duration?: number;
  date?: string | null;
  status?: {
    label: string;
    bgColor: string;
    textColor: string;
  };
  statusPosition?: "image" | "body";
  badgeStatus?: {
    label: string;
    active: boolean;
  };
  onPress?: () => void;
  showMenu?: boolean;
  menuPosition?: "image" | "footer";
  onMenuPress?: () => void;
  variant?: "grid" | "list";
  showTrendingBadge?: boolean;
  avgRating?: number;
  reviewCount?: number;
  showFavoriteButton?: boolean;
  serviceId?: string;
  isFavorited?: boolean;
  /** Original (pre-discount) price. When > price, shows a strikethrough + discount pill. */
  originalPrice?: number;
  /** Overrides the derived "N% OFF" discount label. */
  discountLabel?: string;
  /** Shows a "Bonus Group Reward" pill. */
  showGroupReward?: boolean;
  /** Shows a rank pill (e.g. "#1 Trending Service"). */
  rankBadge?: string;
  /** When set, rating shows "(N booked)" instead of the review count. */
  bookingCount?: number;
  /** Address line rendered with a pin icon in the footer. */
  location?: string;
  /** Shop/vendor name shown under the title (V2 white card). */
  shopName?: string;
}

function ServiceCard({
  imageUrl,
  category: rawCategory,
  title,
  description,
  price,
  duration,
  date,
  status,
  statusPosition = "body",
  badgeStatus,
  onPress,
  showMenu,
  menuPosition = "image",
  onMenuPress,
  variant = "grid",
  showTrendingBadge = false,
  avgRating,
  reviewCount,
  showFavoriteButton = false,
  serviceId,
  isFavorited: initialFavorited,
  originalPrice,
  discountLabel,
  showGroupReward = false,
  rankBadge,
  bookingCount,
  location,
  shopName,
}: ServiceCardProps) {
  const category = getCategoryLabel(rawCategory);
  const { toggleFavorite } = useToggleFavoriteMutation();
  const haptics = useHaptics();

  const hasDiscount = originalPrice != null && originalPrice > price;
  const resolvedDiscountLabel =
    discountLabel ??
    (hasDiscount
      ? `${Math.round(((originalPrice! - price) / originalPrice!) * 100)}% OFF`
      : null);
  const ratingCountLabel =
    bookingCount != null
      ? `(${bookingCount} booked)`
      : reviewCount != null
      ? `(${reviewCount} ${reviewCount === 1 ? "review" : "reviews"})`
      : "";

  const [localFavorited, setLocalFavorited] = useState(initialFavorited);

  useEffect(() => {
    setLocalFavorited(initialFavorited);
  }, [initialFavorited]);

  const imageSource = useMemo(
    () => (imageUrl ? { uri: imageUrl } : null),
    [imageUrl]
  );

  const handleFavoritePress = useCallback(() => {
    if (!serviceId) return;
    haptics.selection();
    setLocalFavorited((prev) => {
      toggleFavorite(serviceId, !!prev);
      return !prev;
    });
  }, [serviceId, toggleFavorite, haptics]);

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "Not scheduled";
    const dateObj = new Date(dateString);
    return dateObj.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (variant === "list") {
    return (
      <View className="mx-4 my-2">
        <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
          <View className="bg-gray-900 rounded-xl overflow-hidden flex-row">
            <View className="relative">
              {imageSource ? (
                <Image
                  source={imageSource}
                  className="w-24 h-24"
                  resizeMode="cover"
                />
              ) : (
                <View className="w-24 h-24 bg-gray-800 items-center justify-center">
                  <Ionicons name="image-outline" size={24} color="#6B7280" />
                </View>
              )}
              {showTrendingBadge && (
                <View
                  className="absolute top-1 left-1 flex-row items-center px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: "#FF6B35" }}
                >
                  <MaterialCommunityIcons name="fire" size={10} color="white" />
                  <Text className="text-white text-[10px] font-semibold ml-0.5">
                    Trending
                  </Text>
                </View>
              )}
            </View>

            <View className="flex-1 p-3 justify-between">
              <View>
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-xs text-gray-500 uppercase tracking-wide">
                    {category}
                  </Text>
                  {status && (
                    <View className={`px-2 py-0.5 rounded-full ${status.bgColor}`}>
                      <Text className={`text-xs font-medium capitalize ${status.textColor}`}>
                        {status.label}
                      </Text>
                    </View>
                  )}
                </View>
                <Text className="text-white text-base font-semibold" numberOfLines={1}>
                  {title}
                </Text>
              </View>

              <View className="flex-row items-center justify-between mt-2">
                <View className="flex-row items-center">
                  <Text className="text-[#FFCC00] font-bold text-lg">${price}</Text>
                  {avgRating != null && avgRating > 0 && (
                    <View className="flex-row items-center ml-3">
                      <Ionicons name="star" size={12} color="#FFCC00" />
                      <Text className="text-white text-xs font-semibold ml-0.5">{avgRating.toFixed(1)}</Text>
                      <Text className="text-gray-500 text-xs ml-1">({reviewCount})</Text>
                    </View>
                  )}
                </View>
                <View className="flex-row items-center">
                  {duration !== undefined ? (
                    <>
                      <Ionicons name="time-outline" size={14} color="#9CA3AF" />
                      <Text className="text-gray-400 text-xs ml-1">{duration} min</Text>
                    </>
                  ) : date !== undefined ? (
                    <>
                      <Ionicons name="calendar-outline" size={14} color="#9CA3AF" />
                      <Text className="text-gray-400 text-xs ml-1">{formatDate(date)}</Text>
                    </>
                  ) : null}
                </View>
              </View>
            </View>

            {showMenu && (
              <TouchableOpacity
                onPress={onMenuPress}
                className="p-3 justify-center"
                activeOpacity={0.7}
              >
                <Ionicons name="ellipsis-vertical" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  // V2 white card. Rating renders as a 5-star row (rounded to avgRating).
  const ratingValue = avgRating ?? 0;
  const stars = [1, 2, 3, 4, 5];
  const subLabel = shopName ?? category;

  return (
    <View
      className="bg-white rounded-2xl overflow-hidden"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 3,
      }}
    >
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        {imageUrl !== undefined && (
          <View className="relative bg-white">
            {imageSource ? (
              <Image
                source={imageSource}
                className="w-full h-40"
                resizeMode="cover"
              />
            ) : (
              <View className="w-full h-40 bg-gray-100 items-center justify-center">
                <Ionicons name="image-outline" size={32} color="#9CA3AF" />
              </View>
            )}
            {showMenu && menuPosition === "image" && (
              <TouchableOpacity
                onPress={onMenuPress}
                className="absolute top-2 right-2 bg-black/40 rounded-full p-1"
                activeOpacity={0.7}
              >
                <Ionicons name="ellipsis-vertical" size={18} color="white" />
              </TouchableOpacity>
            )}
            {badgeStatus && (
              <View
                className={`absolute top-2 left-2 px-2 py-1 rounded-full ${
                  badgeStatus.active ? "bg-green-500" : "bg-gray-500"
                }`}
              >
                <Text className="text-white text-xs font-medium">
                  {badgeStatus.label}
                </Text>
              </View>
            )}
            {status && statusPosition === "image" && (
              <View
                className={`absolute top-2 left-2 px-2 py-1 rounded-full ${status.bgColor}`}
              >
                <Text
                  className={`text-xs font-medium capitalize ${status.textColor}`}
                >
                  {status.label}
                </Text>
              </View>
            )}
            {showFavoriteButton &&
              serviceId &&
              !showMenu &&
              !badgeStatus &&
              !(status && statusPosition === "image") && (
                <TouchableOpacity
                  onPress={handleFavoritePress}
                  className="absolute top-2 right-2 bg-white/90 rounded-full p-1.5"
                  activeOpacity={0.7}
                  style={{
                    shadowColor: "#000",
                    shadowOpacity: 0.15,
                    shadowRadius: 3,
                    elevation: 2,
                  }}
                >
                  <Ionicons
                    name={localFavorited ? "heart" : "heart-outline"}
                    size={18}
                    color={localFavorited ? "#EF4444" : "#111827"}
                  />
                </TouchableOpacity>
              )}
          </View>
        )}

        <View className="p-3">
          <Text
            className="text-gray-900 text-[15px] font-bold leading-5"
            numberOfLines={2}
          >
            {title}
          </Text>

          {subLabel ? (
            <Text className="text-gray-500 text-xs mt-1" numberOfLines={1}>
              {subLabel}
            </Text>
          ) : null}

          {/* Price */}
          <View className="flex-row items-center flex-wrap mt-1.5">
            <Text className="text-gray-900 font-bold text-lg">$ {price}</Text>
            {hasDiscount && (
              <>
                <Text className="text-gray-400 text-sm line-through ml-2">
                  $ {originalPrice}
                </Text>
                {resolvedDiscountLabel && (
                  <View className="ml-2">
                    <Badge tone="discount" label={resolvedDiscountLabel} />
                  </View>
                )}
              </>
            )}
          </View>

          {/* Rating */}
          {ratingValue > 0 && (
            <View className="flex-row items-center mt-1.5">
              {stars.map((s) => (
                <Ionicons
                  key={s}
                  name={s <= Math.round(ratingValue) ? "star" : "star-outline"}
                  size={13}
                  color="#FFCC00"
                  style={{ marginRight: 1 }}
                />
              ))}
              {ratingCountLabel ? (
                <Text className="text-gray-500 text-xs ml-1.5">
                  {ratingCountLabel}
                </Text>
              ) : null}
            </View>
          )}

          {/* Rank / group / trending badges */}
          {(rankBadge || showGroupReward || showTrendingBadge) && (
            <View className="flex-row flex-wrap items-center gap-1.5 mt-2">
              {showTrendingBadge && !rankBadge && (
                <Badge tone="trending" label="Trending" />
              )}
              {rankBadge && <Badge tone="rank" label={rankBadge} />}
              {showGroupReward && (
                <Badge tone="group" label="Bonus Group Reward" />
              )}
            </View>
          )}

          {/* Location */}
          {location && (
            <View className="flex-row items-center mt-2">
              <Ionicons name="location-outline" size={12} color="#9CA3AF" />
              <Text
                className="text-gray-500 text-xs ml-1 flex-1"
                numberOfLines={1}
              >
                {location}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

export default React.memo(ServiceCard);
