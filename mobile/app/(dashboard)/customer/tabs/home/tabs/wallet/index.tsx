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

import { Tier } from "@/utilities/GlobalTypes";
import { ServiceData } from "@/interfaces/service.interface";
import { SERVICE_CATEGORIES } from "@/constants/service-categories";
import { useCustomer } from "@/hooks/customer/useCustomer";
import { useService } from "@/hooks/service/useService";
import { useAuthStore } from "@/store/auth.store";

import ServiceCard from "@/components/shared/ServiceCard";
import ActionCard from "@/components/shared/ActionCard";
import { useFavorite } from "@/hooks/favorite/useFavorite";

export default function WalletTab() {
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
  const favoritedIds = useMemo(() => {
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
        <View className="mt-5">
          {/* Header */}
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-white text-xl font-bold">Trending</Text>
            <TouchableOpacity onPress={handleViewAllTrendingServices}>
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
                snapToInterval={286}
                snapToAlignment="start"
              >
                {trendingData.map((item: ServiceData) => (
                  <View
                    key={item.serviceId}
                    style={{ width: 280, marginRight: 6 }}
                  >
                    <ServiceCard
                      imageUrl={item.imageUrl}
                      category={getCategoryLabel(item.category)}
                      title={item.serviceName}
                      description={item.description}
                      price={item.priceUsd}
                      duration={item.durationMinutes}
                      onPress={() => handleServicePress(item)}
                      showTrendingBadge
                      showFavoriteButton
                      serviceId={item.serviceId}
                      isFavorited={favoritedIds.has(item.serviceId)}
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
                snapToInterval={286}
                snapToAlignment="start"
              >
                {displayedServices.map((item: ServiceData) => (
                  <View
                    key={item.serviceId}
                    style={{ width: 280, marginRight: 6 }}
                  >
                    <ServiceCard
                      imageUrl={item.imageUrl}
                      category={getCategoryLabel(item.category)}
                      title={item.serviceName}
                      description={item.description}
                      price={item.priceUsd}
                      duration={item.durationMinutes}
                      onPress={() => handleServicePress(item)}
                      showFavoriteButton
                      serviceId={item.serviceId}
                      isFavorited={favoritedIds.has(item.serviceId)}
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
      </ScrollView>
    </View>
  );
}
