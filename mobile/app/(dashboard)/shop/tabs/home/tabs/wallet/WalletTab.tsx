import React from "react";
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
import { LinearGradient } from "expo-linear-gradient";

import { useAuthStore } from "@/store/authStore";
import { Tier } from "@/utilities/GlobalTypes";
import DetailCard from "@/components/ui/DetailCard";
import { ShopByWalletAddressData } from "@/services/ShopServices";

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
      className={`w-12 h-12 rounded-full justify-center items-center ${
        disabled ? "bg-gray-700" : "bg-[#1A1A1C]"
      }`}
    >
      {icon}
    </Pressable>
    <Text className="text-white text-base font-semibold mt-2">{label}</Text>
  </View>
);

const BalanceCard: React.FC<{
  balance: number | undefined;
  isLoading: boolean;
}> = ({ balance, isLoading }) => {
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
          <Text className="text-black text-base font-semibold mt-4">
            Your Current RCN Balance
          </Text>

          <View className="flex-row items-center mt-2">
            {isLoading ? (
              <ActivityIndicator size="large" color="#000" />
            ) : (
              <>
                <Text className="text-black text-3xl font-extrabold">
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
        </View>
      </View>
    </View>
  );
};

export default function WalletTab({
  shopData,
}: {
  shopData: ShopByWalletAddressData;
}) {
  const { account } = useAuthStore();

  // Early return for missing data
  if (!account) {
    return (
      <View className="flex-1 justify-center items-center mt-20">
        <Text className="text-white text-lg">No wallet connected</Text>
      </View>
    );
  }

  // if (error) {
  //   return (
  //     <View className="flex-1 justify-center items-center mt-20">
  //       <Text className="text-red-500 text-lg">Failed to load balance</Text>
  //       <Pressable
  //         onPress={() => refetch()}
  //         className="mt-4 px-6 py-3 bg-[#FFCC00] rounded-lg"
  //       >
  //         <Text className="text-black font-semibold">Retry</Text>
  //       </Pressable>
  //     </View>
  //   );
  // }

  return (
    <View className="mt-4 flex-1">
      {/* Balance Card */}
      <BalanceCard balance={shopData?.purchasedRcnBalance} isLoading={false} />

      <View className="flex-row justify-between mt-6 px-8">
        <View className="items-center">
          <Pressable className="w-16 h-16 rounded-full bg-[#1A1A1C] justify-center items-center">
            <MaterialIcons name="summarize" color="#fff" size={24} />
          </Pressable>
          <Text className="text-white text-lg font-semibold mt-2">Buy</Text>
        </View>
        <View className="items-center">
          <Pressable className="w-16 h-16 rounded-full bg-[#1A1A1C] justify-center items-center">
            <MaterialIcons name="info" color="#fff" size={24} />
          </Pressable>
          <Text className="text-white text-lg font-semibold mt-2">Reward</Text>
        </View>
        <View className="items-center">
          <Pressable className="w-16 h-16 rounded-full bg-[#1A1A1C] justify-center items-center">
            <Octicons name="history" color="#fff" size={24} />
          </Pressable>
          <Text className="text-white text-lg font-semibold mt-2">Redeem</Text>
        </View>
      </View>

      {/* Detail Cards - Scrollable Section */}
      <ScrollView
        className="flex-1 mt-5"
        showsVerticalScrollIndicator={true}
        showsHorizontalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {}}
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
            <MaterialCommunityIcons name="screwdriver" color="#000" size={16} />
          }
          title="Total Purchased"
          label="Total RCN tokens you've purchased"
          badge={
            false ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Text className="text-3xl font-semibold">
                  {shopData?.totalRcnPurchased}
                </Text>{" "}
              </>
            )
          }
        />
        <DetailCard
          icon={
            <MaterialCommunityIcons name="screwdriver" color="#000" size={16} />
          }
          title="Tokens Issued"
          label="Total RCN tokens issued to customers"
          badge={
            false ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Text className="text-3xl font-semibold">
                  {shopData?.totalTokensIssued}
                </Text>{" "}
              </>
            )
          }
        />
        <DetailCard
          icon={
            <MaterialCommunityIcons name="screwdriver" color="#000" size={16} />
          }
          title="RCG Balance"
          label="RCG tokens in your wallet"
          badge={
            false ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Text className="text-3xl font-semibold">2</Text>{" "}
              </>
            )
          }
        />
      </ScrollView>
    </View>
  );
}
