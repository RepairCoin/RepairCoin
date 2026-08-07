import React, { useEffect } from "react";
import { View, StyleSheet, ViewStyle, ScrollView } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

// =============================================================================
// SkeletonBox - Base shimmer component
// =============================================================================

type SkeletonBoxProps = {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
};

export function SkeletonBox({
  width = "100%",
  height = 20,
  borderRadius = 4,
  style,
}: SkeletonBoxProps) {
  const shimmerProgress = useSharedValue(0);

  useEffect(() => {
    shimmerProgress.value = withRepeat(
      withTiming(1, { duration: 1200 }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      shimmerProgress.value,
      [0, 1],
      [-200, 200]
    );
    return {
      transform: [{ translateX }],
    };
  });

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: "#27272a",
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
        <LinearGradient
          colors={["transparent", "rgba(255,255,255,0.08)", "transparent"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

// =============================================================================
// SkeletonServiceCard - Matches ServiceCard layout (grid variant)
// =============================================================================

const SERVICE_CARD_HEIGHT = 240;

export function SkeletonServiceCard() {
  return (
    <View
      style={{
        width: "100%",
        height: SERVICE_CARD_HEIGHT,
        borderRadius: 12,
        backgroundColor: "#18181b",
        overflow: "hidden",
      }}
    >
      {/* Image placeholder */}
      <SkeletonBox width="100%" height={112} borderRadius={0} />

      {/* Content */}
      <View style={{ padding: 12 }}>
        {/* Category */}
        <SkeletonBox width="30%" height={12} borderRadius={4} />

        {/* Title */}
        <SkeletonBox
          width="80%"
          height={18}
          borderRadius={4}
          style={{ marginTop: 8 }}
        />

        {/* Description */}
        <SkeletonBox
          width="100%"
          height={14}
          borderRadius={4}
          style={{ marginTop: 6 }}
        />
        <SkeletonBox
          width="60%"
          height={14}
          borderRadius={4}
          style={{ marginTop: 4 }}
        />

        {/* Price */}
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: "#27272a",
            paddingTop: 12,
            marginTop: 12,
          }}
        >
          <SkeletonBox width="25%" height={20} borderRadius={4} />
        </View>
      </View>
    </View>
  );
}

// =============================================================================
// SkeletonListItem - For conversations, customers, transactions
// =============================================================================

export function SkeletonListItem() {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#27272a",
      }}
    >
      {/* Avatar */}
      <SkeletonBox width={48} height={48} borderRadius={24} />

      {/* Content */}
      <View style={{ flex: 1, marginLeft: 12 }}>
        {/* Name row */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <SkeletonBox width="50%" height={16} borderRadius={4} />
          <SkeletonBox width={50} height={12} borderRadius={4} />
        </View>

        {/* Subtitle */}
        <SkeletonBox
          width="70%"
          height={14}
          borderRadius={4}
          style={{ marginTop: 6 }}
        />
      </View>
    </View>
  );
}

// =============================================================================
// SkeletonCustomerCard - Mirrors CustomerCard (shop customer list)
// Geometry is kept in step with feature/shop/customers/components/CustomerCard.tsx:
// same card chrome, 56px avatar, stats bar and secondary row — otherwise the list
// visibly jumps when real data replaces the placeholders.
// =============================================================================

export function SkeletonCustomerCard() {
  return (
    <View
      style={{
        marginBottom: 12,
        borderRadius: 16,
        backgroundColor: "#1a1a1a",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.08)",
        padding: 16,
      }}
    >
      {/* Avatar + info */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <SkeletonBox width={56} height={56} borderRadius={28} />

        <View style={{ flex: 1, marginLeft: 16 }}>
          {/* Name row + action chips */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <SkeletonBox width="55%" height={16} borderRadius={4} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <SkeletonBox width={26} height={26} borderRadius={13} />
              <SkeletonBox width={26} height={26} borderRadius={13} />
            </View>
          </View>

          {/* Tier badge + last activity pill */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <SkeletonBox width={72} height={22} borderRadius={11} />
            <SkeletonBox width={64} height={22} borderRadius={11} />
          </View>
        </View>
      </View>

      {/* Stats bar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: 16,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: "#27272a",
        }}
      >
        {[0, 1].map((i) => (
          <React.Fragment key={i}>
            {i === 1 && (
              <View
                style={{
                  width: 1,
                  height: 32,
                  backgroundColor: "#27272a",
                  marginHorizontal: 12,
                }}
              />
            )}
            <View
              style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
            >
              <SkeletonBox width={26} height={26} borderRadius={13} />
              <View style={{ marginLeft: 8, flex: 1 }}>
                <SkeletonBox width="60%" height={10} borderRadius={4} />
                <SkeletonBox
                  width="45%"
                  height={14}
                  borderRadius={4}
                  style={{ marginTop: 4 }}
                />
              </View>
            </View>
          </React.Fragment>
        ))}
      </View>

      {/* Secondary stats row */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: 8,
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: "rgba(39, 39, 42, 0.5)",
        }}
      >
        <SkeletonBox width={86} height={12} borderRadius={4} />
        <View style={{ width: 16 }} />
        <SkeletonBox width={72} height={12} borderRadius={4} />
      </View>
    </View>
  );
}

// =============================================================================
// SkeletonNotificationItem - For notification items
// =============================================================================

export function SkeletonNotificationItem() {
  return (
    <View
      style={{
        flexDirection: "row",
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#27272a",
      }}
    >
      {/* Icon circle */}
      <SkeletonBox width={40} height={40} borderRadius={20} />

      {/* Content */}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <SkeletonBox width="90%" height={16} borderRadius={4} />
        <SkeletonBox
          width="60%"
          height={14}
          borderRadius={4}
          style={{ marginTop: 6 }}
        />
        <SkeletonBox
          width="30%"
          height={12}
          borderRadius={4}
          style={{ marginTop: 6 }}
        />
      </View>
    </View>
  );
}

// =============================================================================
// SkeletonTransactionItem - For transaction history
// =============================================================================

export function SkeletonTransactionItem() {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: "#27272a",
      }}
    >
      {/* Left side - icon + text */}
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
        <SkeletonBox width={40} height={40} borderRadius={20} />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <SkeletonBox width="60%" height={16} borderRadius={4} />
          <SkeletonBox
            width="40%"
            height={12}
            borderRadius={4}
            style={{ marginTop: 4 }}
          />
        </View>
      </View>

      {/* Right side - amount */}
      <SkeletonBox width={60} height={18} borderRadius={4} />
    </View>
  );
}

// =============================================================================
// SkeletonList - Renders multiple skeleton items
// =============================================================================

type SkeletonListProps = {
  count?: number;
  variant?: "list" | "service" | "notification" | "transaction" | "customer";
};

export function SkeletonList({
  count = 5,
  variant = "list",
}: SkeletonListProps) {
  const ItemComponent = {
    list: SkeletonListItem,
    service: SkeletonServiceCard,
    notification: SkeletonNotificationItem,
    transaction: SkeletonTransactionItem,
    customer: SkeletonCustomerCard,
  }[variant];

  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={variant === "service" ? { marginBottom: 16 } : undefined}>
          <ItemComponent />
        </View>
      ))}
    </View>
  );
}

// =============================================================================
// SkeletonServiceGrid - Grid of service cards (2 columns)
// =============================================================================

type SkeletonServiceGridProps = {
  count?: number;
};

export function SkeletonServiceGrid({ count = 4 }: SkeletonServiceGridProps) {
  const rows = Math.ceil(count / 2);

  return (
    <View style={{ paddingHorizontal: 16 }}>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <View
          key={rowIndex}
          style={{
            flexDirection: "row",
            marginBottom: 16,
            gap: 12,
          }}
        >
          <View style={{ flex: 1 }}>
            <SkeletonServiceCard />
          </View>
          {rowIndex * 2 + 1 < count && (
            <View style={{ flex: 1 }}>
              <SkeletonServiceCard />
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

// =============================================================================
// SkeletonHorizontalCards - Horizontal scrolling service cards (for home sections)
// =============================================================================

type SkeletonHorizontalCardsProps = {
  count?: number;
  cardWidth?: number;
};

export function SkeletonHorizontalCards({
  count = 3,
  cardWidth = 280,
}: SkeletonHorizontalCardsProps) {
  return (
    <View style={{ marginHorizontal: -16 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        scrollEnabled={false}
      >
        {Array.from({ length: count }).map((_, index) => (
          <View key={index} style={{ width: cardWidth, marginRight: 6 }}>
            <SkeletonServiceCard />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
