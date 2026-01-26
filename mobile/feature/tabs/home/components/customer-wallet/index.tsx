import React, { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { Tier } from "@/shared/utilities/GlobalTypes";
import { ServiceData } from "@/shared/interfaces/service.interface";
import { SERVICE_CATEGORIES } from "@/constants/service-categories";
import { useCustomer } from "@/shared/hooks/customer/useCustomer";
import { useService } from "@/shared/hooks/service/useService";
import { useAuthStore } from "@/shared/store/auth.store";

import ServiceCard from "@/components/shared/ServiceCard";
import ActionCard from "@/components/shared/ActionCard";
import { useFavorite } from "@/shared/hooks/favorite/useFavorite";
import TrendingSection from "./TrendingSection";
import ServiceSection from "./ServiceSection";

export default function CustomerWalletTab() {
  const { account } = useAuthStore();
  const { useGetCustomerByWalletAddress } = useCustomer();
  const { useGetAllServicesQuery, useGetTrendingServices } = useService();
  const { useGetFavorites } = useFavorite();

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

  // Fetch favorites for heart icon
  const { data: favoritesData, refetch: refetchFavorites } = useGetFavorites();

  // Create a Set of favorited service IDs for O(1) lookup
  const 
  favoritedIds = useMemo(() => {
    if (!favoritesData) return new Set<string>();
    return new Set(favoritesData.map((s: ServiceData) => s.serviceId));
  }, [favoritesData]);

  // Pull-to-refresh state
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetch(),
        refetchServices(),
        refetchTrending(),
        refetchFavorites(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refetch, refetchServices, refetchTrending, refetchFavorites]);

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
    router.push("/customer/tabs/service");
  };

  const handleViewAllTrendingServices = () => {
    router.push("/customer/service/trending");
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
    <View className="flex-1">
      <ScrollView
        className="h-full"
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
        <ActionCard
          balance={tokenData.balance}
          tier={tokenData.tier}
          isLoading={isLoading}
          quickActions={[
            {
              icon: <MaterialIcons name="card-giftcard" size={24} color="#000" />,
              label: "Gift Token",
              onPress: () => router.push("/customer/gift-token"),
            },
            {
              icon: <Ionicons name="qr-code-outline" size={24} color="#000" />,
              label: "QR Code",
              onPress: () => router.push("/customer/qrcode"),
            },
            {
              icon: <Ionicons name="ribbon-outline" size={24} color="#000" />,
              label: "Tier Info",
              onPress: () => router.push("/customer/tier-info"),
            },
            {
              icon: <Ionicons name="wallet-outline" size={24} color="#000" />,
              label: "Redeem",
              onPress: () => router.push("/customer/redeem"),
            },
          ]}
        />

        {/* Trending Services Section */}
        {trendingData && trendingData.length > 0 && (
          <TrendingSection
            handleViewAllTrendingServices={handleViewAllTrendingServices}
            trendingLoading={trendingLoading}
            trendingData={trendingData}
            getCategoryLabel={getCategoryLabel}
            handleServicePress={(item) => handleServicePress(item)}
            favoritedIds={favoritedIds}
          />
        )}
        {/* Choose Service Section */}
        {displayedServices && displayedServices.length > 0 && (
          <ServiceSection
            handleViewAllServices={handleViewAllServices}
            servicesLoading={servicesLoading}
            displayedServices={displayedServices}
            getCategoryLabel={getCategoryLabel}
            handleServicePress={handleServicePress}
            favoritedIds={favoritedIds}
          />
        )}
      </ScrollView>
    </View>
  );
}
