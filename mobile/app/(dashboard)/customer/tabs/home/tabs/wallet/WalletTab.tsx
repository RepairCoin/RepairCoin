import React, { useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  Image,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import {
  Entypo,
  SimpleLineIcons,
} from "@expo/vector-icons";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import { Tier } from "@/utilities/GlobalTypes";
import { ServiceData } from "@/interfaces/service.interface";
import { SERVICE_CATEGORIES } from "@/constants/service-categories";
import { useCustomer } from "@/hooks/customer/useCustomer";
import { useService } from "@/hooks/service/useService";
import { useAuthStore } from "@/store/auth.store";

import ServiceCard from "@/components/shared/ServiceCard";


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

          {/* Tier Badge */}
          <View
            className="w-32 h-8 mt-4 rounded-full overflow-hidden"
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
        </View>
      </View>
    </View>
  );
};

export default function WalletTab() {
  const { account } = useAuthStore();
  const { useGetCustomerByWalletAddress } = useCustomer();

  // Use the token balance hook
  const {
    data: customerData,
    isLoading,
    error,
    refetch,
  } = useGetCustomerByWalletAddress(account?.address);

  // Get services
  const { useGetAllServicesQuery } = useService();
  const { data: servicesData, isLoading: servicesLoading } =
    useGetAllServicesQuery();

  const totalBalance = (customerData?.customer?.lifetimeEarnings || 0) - (customerData?.customer?.totalRedemptions || 0);

  const tokenData = {
    tier: (customerData?.customer?.tier as Tier) || "BRONZE",
    balance: totalBalance,
    totalRedeemed: customerData?.customer?.totalRedemptions,
    totalEarned: customerData?.customer?.lifetimeEarnings,
  };

  // Get latest 2 active services (sorted by createdAt descending)
  const displayedServices = useMemo(() => {
    if (!servicesData || !Array.isArray(servicesData)) {
      return [];
    }
    const activeServices = servicesData.filter((service: ServiceData) => service.active);
    const sortedServices = [...activeServices].sort(
      (a: ServiceData, b: ServiceData) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return sortedServices.slice(0, 2);
  }, [servicesData]);

  const getCategoryLabel = (category?: string) => {
    if (!category) return "Other";
    const cat = SERVICE_CATEGORIES.find((c) => c.value === category);
    return cat?.label || category;
  };

  const handleServicePress = (item: ServiceData) => {
    router.push(`/customer/service/${item.serviceId}`);
  };

  const handleViewAllServices = () => {
    router.push("/(dashboard)/customer/tabs/service");
  };

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

      {/* Choose Service Section */}
      <View className="mt-5">
        {/* Header */}
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-white text-xl font-bold">Services</Text>
          <TouchableOpacity onPress={handleViewAllServices}>
            <Text className="text-[#FFCC00] text-sm font-semibold">
              View All
            </Text>
          </TouchableOpacity>
        </View>

        {/* Service Cards */}
        {servicesLoading ? (
          <View className="justify-center items-center py-10">
            <ActivityIndicator size="large" color="#FFCC00" />
          </View>
        ) : displayedServices.length > 0 ? (
          <View className="flex-row" style={{ marginHorizontal: -8 }}>
            {displayedServices.map((item: ServiceData) => (
              <ServiceCard
                key={item.serviceId}
                imageUrl={item.imageUrl}
                category={getCategoryLabel(item.category)}
                title={item.serviceName}
                description={item.description}
                price={item.priceUsd}
                duration={item.durationMinutes}
                onPress={() => handleServicePress(item)}
              />
            ))}
          </View>
        ) : (
          <View className="items-center py-10">
            <Text className="text-gray-400 text-center">
              No services available
            </Text>
            <Text className="text-gray-500 text-sm text-center mt-2">
              Check back later for new services
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
