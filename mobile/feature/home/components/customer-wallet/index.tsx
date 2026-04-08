import React, { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { MaterialIcons, Ionicons, Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Tier } from "@/shared/utilities/GlobalTypes";
import { ServiceData } from "@/shared/interfaces/service.interface";
import { SERVICE_CATEGORIES } from "@/shared/constants/service-categories";
import { useCustomer } from "@/shared/hooks/customer/useCustomer";
import { useService } from "@/shared/hooks/service/useService";
import { useAuthStore } from "@/shared/store/auth.store";
import { apiClient } from "@/shared/utilities/axios";
import { useAppToast } from "@/shared/hooks";

import ActionCard from "@/shared/components/shared/ActionCard";
import { useFavorite } from "@/shared/hooks/favorite/useFavorite";
import TrendingSection from "./TrendingSection";
import ServiceSection from "./ServiceSection";
import RecentlyViewedSection from "./RecentlyViewedSection";

export default function CustomerWalletTab() {
  const { account } = useAuthStore();
  const { useGetCustomerByWalletAddress } = useCustomer();
  const { useGetAllServicesQuery, useGetTrendingServices, useGetRecentlyViewed } = useService();
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

  // Get recently viewed services
  const {
    data: recentlyViewedData,
    isLoading: recentlyViewedLoading,
    refetch: refetchRecentlyViewed,
  } = useGetRecentlyViewed({ limit: 8 });

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
        refetchRecentlyViewed(),
        refetchFavorites(),
        refetchOnChain(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refetch, refetchServices, refetchTrending, refetchRecentlyViewed, refetchFavorites]);

  const totalBalance = customerData?.customer?.currentRcnBalance || 0;

  // TODO: Add on-chain balance reading when ThirdwebProvider is configured
  const walletBalance = 0;
  const refetchOnChain = () => {};

  // Mint to wallet state
  const [showMintModal, setShowMintModal] = useState(false);
  const [mintAmount, setMintAmount] = useState("");
  const { showSuccess, showError } = useAppToast();
  const queryClient = useQueryClient();

  const mintMutation = useMutation({
    mutationFn: async (amount: number) => {
      return apiClient.post(`/customers/balance/${account?.address}/instant-mint`, { amount });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repaircoin", "customers"] });
      refetchOnChain();
      refetch();
      setShowMintModal(false);
      setMintAmount("");
      showSuccess("RCN minted to your wallet!");
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || error.message || "Failed to mint RCN";
      showError(message);
    },
  });

  const handleMint = () => {
    const amount = parseFloat(mintAmount);
    if (isNaN(amount) || amount <= 0) {
      showError("Please enter a valid amount");
      return;
    }
    if (amount > totalBalance) {
      showError("Amount exceeds available balance");
      return;
    }
    if (amount > 10000) {
      showError("Maximum 10,000 RCN per transaction");
      return;
    }
    mintMutation.mutate(amount);
  };

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

        {/* Wallet Balance Card */}
        <View className="mx-4 mt-4 bg-[#1a1a1a] rounded-2xl p-4">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <Feather name="link" size={16} color="#3b82f6" />
              <Text className="text-gray-400 text-sm ml-2">On-Chain Wallet</Text>
            </View>
            <View className="bg-blue-500/10 px-2 py-1 rounded-full">
              <Text className="text-blue-400 text-xs font-medium">Base Sepolia</Text>
            </View>
          </View>
          <View className="flex-row items-end justify-between">
            <View>
              <Text className="text-white text-2xl font-bold">
                {walletBalance.toFixed(2)} <Text className="text-gray-400 text-sm">RCN</Text>
              </Text>
              <Text className="text-gray-500 text-xs mt-1">
                ${(walletBalance * 0.10).toFixed(2)} USD
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => totalBalance > 0 ? setShowMintModal(true) : showError("No platform balance to mint")}
              className={`px-4 py-2 rounded-xl flex-row items-center ${totalBalance > 0 ? "bg-[#FFCC00]" : "bg-zinc-700"}`}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-up-circle" size={16} color={totalBalance > 0 ? "#000" : "#999"} />
              <Text className={`text-sm font-semibold ml-1 ${totalBalance > 0 ? "text-black" : "text-gray-400"}`}>Mint</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Mint to Wallet Modal */}
        <Modal visible={showMintModal} transparent animationType="fade">
          <Pressable
            className="flex-1 bg-black/60 justify-center items-center"
            onPress={() => setShowMintModal(false)}
          >
            <Pressable
              className="bg-[#1a1a1a] rounded-2xl w-[85%] p-6"
              onPress={(e) => e.stopPropagation()}
            >
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-white text-lg font-bold">Mint RCN to Wallet</Text>
                <TouchableOpacity onPress={() => setShowMintModal(false)}>
                  <Ionicons name="close" size={24} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              <View className="bg-[#252525] rounded-xl p-3 mb-4">
                <Text className="text-gray-400 text-xs mb-1">Available Platform Balance</Text>
                <Text className="text-[#FFCC00] text-xl font-bold">{totalBalance.toFixed(2)} RCN</Text>
              </View>

              <Text className="text-gray-400 text-sm mb-2">Amount to mint</Text>
              <View className="flex-row items-center bg-[#252525] rounded-xl px-4 py-3 mb-4">
                <TextInput
                  value={mintAmount}
                  onChangeText={setMintAmount}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor="#666"
                  className="flex-1 text-white text-lg"
                />
                <TouchableOpacity
                  onPress={() => setMintAmount(totalBalance.toFixed(2))}
                  className="bg-[#FFCC00]/20 px-3 py-1 rounded-lg"
                >
                  <Text className="text-[#FFCC00] text-sm font-semibold">MAX</Text>
                </TouchableOpacity>
              </View>

              <View className="bg-blue-500/10 rounded-xl p-3 mb-4">
                <View className="flex-row items-start">
                  <Ionicons name="information-circle" size={16} color="#3b82f6" />
                  <Text className="text-blue-300 text-xs ml-2 flex-1">
                    This transfers your platform RCN balance to your blockchain wallet. The transaction may take a few seconds to process.
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleMint}
                disabled={mintMutation.isPending}
                className={`rounded-xl py-4 items-center ${mintMutation.isPending ? "bg-[#FFCC00]/50" : "bg-[#FFCC00]"}`}
                activeOpacity={0.8}
              >
                {mintMutation.isPending ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text className="text-black text-base font-bold">Mint to Wallet</Text>
                )}
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Recently Viewed Section */}
        {recentlyViewedData && recentlyViewedData.length > 0 && (
          <RecentlyViewedSection
            data={recentlyViewedData}
            isLoading={recentlyViewedLoading}
            getCategoryLabel={getCategoryLabel}
            onServicePress={handleServicePress}
          />
        )}

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
