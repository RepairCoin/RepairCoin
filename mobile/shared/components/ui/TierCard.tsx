import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  ImageSourcePropType,
} from "react-native";
import { SimpleLineIcons, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Tier } from "@/shared/utilities/GlobalTypes";

interface TierInfo {
  color: [string, string];
  label: string;
}

const TIER_CONFIG: Record<Tier, TierInfo> = {
  GOLD: {
    color: ["#FFCC00", "#FFEC9F"],
    label: "Gold",
  },
  SILVER: {
    color: ["#ABABAB", "#FFFFFF"],
    label: "Silver",
  },
  BRONZE: {
    color: ["#95602B", "#FFFFFF"],
    label: "Bronze",
  },
};

interface InlineAction {
  label: string;
  onPress: () => void;
}

interface TierCardProps {
  // Balance mode props
  balance?: number;
  balanceLabel?: string;
  showBalanceToggle?: boolean;
  hideBalance?: boolean;
  tier?: Tier;

  // Info mode props
  title?: string;
  subtitle?: string;
  inlineAction?: InlineAction;

  // Common props
  isLoading?: boolean;
  backgroundImage?: ImageSourcePropType;
  headerHeight?: string;
  tierInfoScreen?: boolean;
}

export default function TierCard({
  balance,
  balanceLabel = "Your Current RCN Balance",
  showBalanceToggle = true,
  hideBalance = false,
  tier,
  title,
  subtitle,
  inlineAction,
  isLoading = false,
  backgroundImage= require("@/assets/images/customer_wallet_card.png"),
  headerHeight: customHeaderHeight,
  tierInfoScreen= false
}: TierCardProps) {
  const [isBalanceVisible, setIsBalanceVisible] = useState(false);
  const tierInfo = tier ? TIER_CONFIG[tier] : null;

  // Determine if we're in balance mode or info mode
  const isBalanceMode = balance !== undefined;

  // Use taller height for info mode with inline action
  const headerHeight = customHeaderHeight ?? (!isBalanceMode && inlineAction ? "h-48" : "h-40");

  return (
    <View
      className={`w-full ${headerHeight} bg-[#FFCC00] rounded-3xl flex-row overflow-hidden relative`}
    >
      {/* Decorative Circle */}
      <View
        className="w-[300px] h-[300px] border-[48px] border-[rgba(102,83,7,0.13)] rounded-full absolute"
        style={{
          right: -80,
          top: -20,
        }}
      />

      {/* Background Image */}
      {backgroundImage && (
        <Image
          source={backgroundImage}
          className="w-98 h-98 bottom-0 right-0 absolute"
          resizeMode="contain"
        />
      )}

      {/* Content */}
      <View className="pl-4 w-full">
        {isBalanceMode ? (
          // Balance Mode Content
          <>
            <Text className={`text-black ${tierInfoScreen ? "text-lg" : "text-base"} font-semibold mt-4`}>
              {balanceLabel}
            </Text>

            {!hideBalance && (
              <View className="flex-row items-center mt-2">
                {isLoading ? (
                  <ActivityIndicator size="large" color="#000" />
                ) : (
                  <>
                    <Text className="text-black text-3xl font-extrabold">
                      {showBalanceToggle
                        ? isBalanceVisible
                          ? `${balance ?? 0} RCN`
                          : "••••••"
                        : `${balance ?? 0} RCN`}
                    </Text>
                    {showBalanceToggle && (
                      <TouchableOpacity
                        onPress={() => setIsBalanceVisible(!isBalanceVisible)}
                        className="ml-3 p-1"
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={isBalanceVisible ? "eye" : "eye-off"}
                          color="#000"
                          size={24}
                        />
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            )}

            {/* Tier Badge - Only show if tier is provided */}
            {tierInfo && (
              <View
                className={`${tierInfoScreen ? "w-36 h-10" : "w-32 h-8"} mt-4 rounded-full overflow-hidden`}
                style={{
                  shadowColor: "black",
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.25,
                  shadowRadius: 10,
                  elevation: 12,
                }}
              >
                <LinearGradient
                  colors={tierInfo.color}
                  start={{ x: 0, y: 1 }}
                  end={{ x: 1, y: 1 }}
                  className="w-full h-full items-center justify-center"
                >
                  <View className="items-center h-full justify-center flex-row">
                    <SimpleLineIcons name="badge" color="#000" size={12} />
                    <Text className="text-black text-sm font-semibold ml-2">
                      {tierInfo.label} Tier
                    </Text>
                  </View>
                </LinearGradient>
              </View>
            )}

            {tierInfoScreen && (
              <Text className={`text-black ${tierInfoScreen ? "text-xs" : "text-base"} font-semibold mt-4`}>
                You have reached the maximum tier!
              </Text>
            )}
          </>
        ) : (
          // Info Mode Content
          <>
            {isLoading ? (
              <View className="mt-10">
                <ActivityIndicator size="large" color="#000" />
              </View>
            ) : (
              <View className="mt-10 w-[100%]">
                {title && (
                  <Text className="text-black font-bold text-2xl">{title}</Text>
                )}
                {subtitle && (
                  <Text className="text-black/60 text-base">{subtitle}</Text>
                )}
                {inlineAction && (
                  <TouchableOpacity
                    onPress={inlineAction.onPress}
                    className="bg-black w-40 rounded-xl py-2 mt-4 justify-center items-center"
                    activeOpacity={0.7}
                  >
                    <Text className="text-[#FFCC00] font-bold text-sm">
                      {inlineAction.label}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}
