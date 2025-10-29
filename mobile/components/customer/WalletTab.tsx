import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  Image,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from "react-native";
import {
  Entypo,
  MaterialCommunityIcons,
  MaterialIcons,
  Octicons,
  SimpleLineIcons,
} from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import DetailCard from "@/components/ui/DetailCard";
import TierBenefitsModal from "./TierBenefitsModal";
import TokenSummaryModal from "./TokenSummaryModal";
import { useAuthStore } from "@/store/authStore";
import { Tier } from "@/utilities/GlobalTypes";
import { useAuthCustomer, useCustomer } from "@/hooks";

interface TierInfo {
  color: [string, string];
  label: string;
  intro: string;
  nextTierRequirement?: number;
}

const TIER_CONFIG: Record<Tier, TierInfo> = {
  GOLD: {
    color: ["#FFCC00", "#FFEC9F"],
    label: "Gold",
    intro: "You are currently at Gold Tier",
  },
  SILVER: {
    color: ["#ABABAB", "#FFFFFF"],
    label: "Silver",
    intro: "You need 1000 RCN to reach Gold Tier",
    nextTierRequirement: 1000,
  },
  BRONZE: {
    color: ["#95602B", "#FFFFFF"],
    label: "Bronze",
    intro: "You need 200 RCN to reach Silver Tier",
    nextTierRequirement: 200,
  },
};

interface ActionButtonProps {
  onPress: () => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  onPress,
  icon,
  label,
  disabled = false,
}) => (
  <View className="items-center">
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`w-16 h-16 rounded-full justify-center items-center ${
        disabled ? "bg-gray-700" : "bg-[#1A1A1C]"
      }`}
    >
      {icon}
    </Pressable>
    <Text className="text-white text-lg font-semibold mt-2">{label}</Text>
  </View>
);

const BalanceCard: React.FC<{
  balance: number | undefined;
  tier: Tier;
  isLoading: boolean;
}> = ({ balance, tier, isLoading }) => {
  const tierInfo = TIER_CONFIG[tier];

  return (
    <View className="h-40">
      <View className="w-full h-full bg-[#FFCC00] rounded-3xl flex-row overflow-hidden relative">
        {/* Decorative Circle */}
        <View
          className="w-[300px] h-[300px] border-[48px] border-[rgba(102,83,7,0.13)] rounded-full absolute"
          style={{
            right: -80,
            top: -20,
          }}
        />

        {/* Background Image */}
        <Image
          source={require("@/assets/images/customer_wallet_card.png")}
          className="w-98 h-98 bottom-0 right-0 absolute"
          resizeMode="contain"
        />

        {/* Content */}
        <View className="pl-4">
          <Text className="text-black font-semibold mt-4">
            Your Current RCN Balance
          </Text>

          <View className="flex-row items-center mt-2">
            {isLoading ? (
              <ActivityIndicator size="large" color="#000" />
            ) : (
              <>
                <Text className="text-black text-4xl font-extrabold">
                  {balance ?? 0} RCN
                </Text>
                <Entypo
                  name="eye-with-line"
                  color="#000"
                  size={30}
                  style={{ marginLeft: 10 }}
                />
              </>
            )}
          </View>

          {/* Tier Badge */}
          <View
            className="w-32 h-9 mt-4 rounded-full overflow-hidden"
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
              <View className="items-center justify-center flex-row">
                <SimpleLineIcons name="badge" color="#000" size={15} />
                <Text className="text-black font-semibold ml-2">
                  {tierInfo.label} Tier
                </Text>
              </View>
            </LinearGradient>
          </View>
        </View>
      </View>
    </View>
  );
};

export default function WalletTab() {
  const { account } = useAuthStore();

  // Use the token balance hook
  const {
    data: customerData,
    isLoading,
    error,
    refetch,
  } = useCustomer(account?.address);

  const {
    data: autCustomer,
    isLoading: isLoadingCustomer,
    error: errorCustomer,
    refetch: refetchCustomer,
  } = useAuthCustomer(account?.address);

  console.log("autCustomerautCustomer", autCustomer)

  const [tierModalVisible, setTierModalVisible] = useState(false);
  const [tokenSummaryModalVisible, setTokenSummaryModalVisible] =
    useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Auto-refresh data when screen is focused
  useFocusEffect(
    useCallback(() => {
      console.log("[WalletTab] Screen focused, refreshing data...");
      refetch();
      
      // Optional: Set up polling interval for real-time updates (every 10 seconds)
      const interval = setInterval(() => {
        console.log("[WalletTab] Auto-refreshing data...");
        refetch();
      }, 10000); // Refresh every 10 seconds
      
      // Cleanup interval on unmount
      return () => {
        console.log("[WalletTab] Cleaning up refresh interval");
        clearInterval(interval);
      };
    }, [refetch])
  );

  // Refresh data when account changes
  useEffect(() => {
    if (account?.address) {
      console.log("[WalletTab] Account changed, refreshing data for:", account.address);
      refetch();
      refetchCustomer();
    }
  }, [account?.address, refetch]);

  const tokenData = {
    tier: (customerData?.customer?.tier as Tier) || "BRONZE",
    balance: customerData?.customer?.lifetimeEarnings,
    totalRedeemed: customerData?.customer?.totalRedemptions,
    totalEarned: customerData?.customer?.lifetimeEarnings,
  };

  const tierInfo = useMemo(() => TIER_CONFIG[tokenData.tier], [tokenData.tier]);

  // Callbacks
  const handleTokenSummaryPress = useCallback(() => {
    setTokenSummaryModalVisible(true);
  }, []);

  const handleTierBenefitsPress = useCallback(() => {
    setTierModalVisible(true);
  }, []);

  const handleHistoryPress = useCallback(() => {
    router.push("/dashboard/customer/TransactionHistory");
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Early return for missing data
  if (!account) {
    return (
      <View className="flex-1 justify-center items-center mt-20">
        <Text className="text-white text-lg">No wallet connected</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center mt-20">
        <Text className="text-red-500 text-lg">Failed to load balance</Text>
        <Pressable
          onPress={() => refetch()}
          className="mt-4 px-6 py-3 bg-[#FFCC00] rounded-lg"
        >
          <Text className="text-black font-semibold">Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="mt-4 flex-1">
      {/* Balance Card */}
      <BalanceCard
        balance={tokenData.balance}
        tier={tokenData.tier}
        isLoading={isLoading}
      />

      {/* Action Buttons */}
      <View className="flex-row justify-between mt-6 px-8">
        <ActionButton
          onPress={handleTokenSummaryPress}
          icon={<MaterialIcons name="summarize" color="#fff" size={24} />}
          label="Summary"
          disabled={isLoading}
        />
        <ActionButton
          onPress={handleTierBenefitsPress}
          icon={<MaterialIcons name="info" color="#fff" size={24} />}
          label="Tier Benefits"
        />
        <ActionButton
          onPress={handleHistoryPress}
          icon={<Octicons name="history" color="#fff" size={24} />}
          label="History"
        />
      </View>

      {/* Detail Cards - Scrollable Section */}
      <ScrollView
        className="flex-1 mt-5"
        showsVerticalScrollIndicator={true}
        showsHorizontalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#FFCC00"]}
            tintColor="#FFCC00"
            progressBackgroundColor="#1A1A1C"
          />
        }
        contentContainerStyle={{
          paddingBottom: 20,
          gap: 16,
        }}
        scrollEventThrottle={16}
        bounces={true}
      >
        <DetailCard
          icon={
            <MaterialCommunityIcons
              name="hand-coin-outline"
              color="#000"
              size={16}
            />
          }
          title="Tokens Redeemed"
          label="Total RCN tokens you've spent at shops"
          badge={
            isLoading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Text className="text-5xl font-semibold">
                  {tokenData.totalRedeemed}
                </Text>{" "}
              </>
            )
          }
        />

        <DetailCard
          icon={
            <MaterialCommunityIcons name="screwdriver" color="#000" size={16} />
          }
          title="Tokens Earned"
          label="Total RCN tokens earned from repairs"
          badge={
            isLoading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Text className="text-5xl font-semibold">
                  {tokenData.totalEarned}
                </Text>{" "}
              </>
            )
          }
        />

        <DetailCard
          icon={<SimpleLineIcons name="badge" color="#000" size={16} />}
          title="Your Tier Level"
          label={tierInfo.intro}
          badge={tierInfo.label}
        />
      </ScrollView>

      {/* Modals */}
      <TierBenefitsModal
        visible={tierModalVisible}
        requestClose={() => setTierModalVisible(false)}
      />

      <TokenSummaryModal
        visible={tokenSummaryModalVisible}
        requestClose={() => setTokenSummaryModalVisible(false)}
      />
    </View>
  );
}
