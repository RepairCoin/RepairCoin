import React, { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from "react-native";
import { Entypo, SimpleLineIcons } from "@expo/vector-icons";
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
  const { useGetAllServicesQuery, useGetTrendingServices } = useService();

  // Use the token balance hook
  const {
    data: customerData,
    isLoading,
    error,
    refetch,
  } = useGetCustomerByWalletAddress(account?.address);

  // Get services
  const {
    data: servicesData,
    isLoading: servicesLoading,
    refetch: refetchServices,
  } = useGetAllServicesQuery();

  const {
    data: trendingData,
    isLoading: trendingLoading,
    refetch: refetchTrending,
  } = useGetTrendingServices({ limit: 4, days: 7 });

  // Pull-to-refresh state
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetch(), refetchServices(), refetchTrending()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetch, refetchServices, refetchTrending]);

  const totalBalance =
    (customerData?.customer?.lifetimeEarnings || 0) -
    (customerData?.customer?.totalRedemptions || 0);

  const tokenData = {
    tier: (customerData?.customer?.tier as Tier) || "BRONZE",
    balance: totalBalance,
    totalRedeemed: customerData?.customer?.totalRedemptions,
    totalEarned: customerData?.customer?.lifetimeEarnings,
  };

  // Get latest 4 active services (sorted by createdAt descending)
  const displayedServices = useMemo(() => {
    if (!servicesData || !Array.isArray(servicesData)) {
      return [];
    }
    const activeServices = servicesData.filter(
      (service: ServiceData) => service.active
    );
    const sortedServices = [...activeServices].sort(
      (a: ServiceData, b: ServiceData) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return sortedServices.slice(0, 4);
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
    <View className="mt-4 h-full">
      <ScrollView
        className="mb-44 h-full"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFCC00"
            colors={["#FFCC00"]}
          />
        }
      >
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

          {/* Service Cards - Horizontal Slider */}
          {servicesLoading ? (
            <View className="justify-center items-center py-10">
              <ActivityIndicator size="large" color="#FFCC00" />
            </View>
          ) : displayedServices.length > 0 ? (
            <View style={{ marginHorizontal: -16 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16 }}
                decelerationRate="fast"
                snapToInterval={172}
                snapToAlignment="start"
              >
                {displayedServices.map((item: ServiceData) => (
                  <View key={item.serviceId} style={{ width: 180, marginRight: -2 }}>
                    <ServiceCard
                      imageUrl={item.imageUrl}
                      category={getCategoryLabel(item.category)}
                      title={item.serviceName}
                      description={item.description}
                      price={item.priceUsd}
                      duration={item.durationMinutes}
                      onPress={() => handleServicePress(item)}
                    />
                  </View>
                ))}
              </ScrollView>
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

        {/* Trending Services Section */}
        <View className="mt-5">
          {/* Header */}
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-white text-xl font-bold">Trending</Text>
            <TouchableOpacity onPress={handleViewAllServices}>
              <Text className="text-[#FFCC00] text-sm font-semibold">
                View All
              </Text>
            </TouchableOpacity>
          </View>

          {/* Trending Cards - Horizontal Slider */}
          {trendingLoading ? (
            <View className="justify-center items-center py-10">
              <ActivityIndicator size="large" color="#FFCC00" />
            </View>
          ) : trendingData && trendingData.length > 0 ? (
            <View style={{ marginHorizontal: -16 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16 }}
                decelerationRate="fast"
                snapToInterval={172}
                snapToAlignment="start"
              >
                {trendingData.map((item: ServiceData) => (
                  <View key={item.serviceId} style={{ width: 180, marginRight: -2 }}>
                    <ServiceCard
                      imageUrl={item.imageUrl}
                      category={getCategoryLabel(item.category)}
                      title={item.serviceName}
                      description={item.description}
                      price={item.priceUsd}
                      duration={item.durationMinutes}
                      onPress={() => handleServicePress(item)}
                    />
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : (
            <View className="items-center py-10">
              <Text className="text-gray-400 text-center">
                No trending services
              </Text>
              <Text className="text-gray-500 text-sm text-center mt-2">
                Check back later for trending services
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
