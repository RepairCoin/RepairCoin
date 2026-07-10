import React, { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
  // TouchableOpacity,
  // Modal,
  // TextInput,
  // ActivityIndicator,
} from "react-native";
import { /* MaterialIcons, */ Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {} from /* useMutation, useQueryClient */ "@tanstack/react-query";
import { Tier } from "@/shared/utilities/GlobalTypes";
import { ServiceData } from "@/feature/services/services/service.interface";
import { useCustomer } from "@/feature/customer/profile/hooks/useCustomer";
import {
  useAllServicesQuery,
  useGetTrendingServicesQuery,
  useGetRecentlyViewedQuery,
  useGetFavoritesQuery,
} from "@/feature/services/services-main/feature-tab/hooks/useFeatureTabQuery";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { apiClient } from "@/shared/utilities/axios";
import { useAppToast } from "@/shared/hooks";
import TrendingSection from "./TrendingSection";
import AiSearchBar from "./AiSearchBar";
import QuickActions from "./QuickActions";
import CategoryGrid from "./CategoryGrid";
import AiRecommendedSection from "./AiRecommendedSection";
import NearbyShopsSection from "./NearbyShopsSection";
import UpcomingBookingsList from "./UpcomingBookingsList";
import NoShowWarningBanner from "../ui/NoShowWarningBanner";

export default function CustomerWalletTab() {
  const { account, userProfile } = useAuthStore();
  const { useGetCustomerByWalletAddress } = useCustomer();
  const walletAddress =
    account?.address || userProfile?.walletAddress || userProfile?.address;

  const {
    data: customerData,
    isLoading,
    error,
    refetch,
  } = useGetCustomerByWalletAddress(walletAddress);

  const {
    data: servicesData,
    isLoading: servicesLoading,
    refetch: refetchServices,
  } = useAllServicesQuery();

  const {
    data: trendingData,
    isLoading: trendingLoading,
    refetch: refetchTrending,
  } = useGetTrendingServicesQuery({ limit: 4, days: 30 });

  const {
    data: recentlyViewedData,
    isLoading: recentlyViewedLoading,
    refetch: refetchRecentlyViewed,
  } = useGetRecentlyViewedQuery({ limit: 8 });

  const { data: favoritesData, refetch: refetchFavorites } =
    useGetFavoritesQuery();

  const favoritedIds = useMemo(() => {
    if (!favoritesData) return new Set<string>();
    return new Set(favoritesData.map((s: ServiceData) => s.serviceId));
  }, [favoritesData]);

  const [refreshing, setRefreshing] = useState(false);
  const [campaignRefreshKey, setCampaignRefreshKey] = useState(0);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetch(),
        refetchServices(),
        refetchTrending(),
        refetchRecentlyViewed(),
        refetchFavorites(),
      ]);
      setCampaignRefreshKey((k) => k + 1);
    } finally {
      setRefreshing(false);
    }
  }, [
    refetch,
    refetchServices,
    refetchTrending,
    refetchRecentlyViewed,
    refetchFavorites,
  ]);

  const totalBalance = customerData?.customer?.currentRcnBalance || 0;

  // const [showMintModal, setShowMintModal] = useState(false);
  // const [mintAmount, setMintAmount] = useState("");
  const { showError } = useAppToast();
  // const queryClient = useQueryClient();

  // const mintMutation = useMutation({
  //   mutationFn: async (amount: number) => {
  //     return apiClient.post(`/customers/balance/${walletAddress}/instant-mint`, { amount });
  //   },
  //   onSuccess: () => {
  //     queryClient.invalidateQueries({ queryKey: ["repaircoin", "customers"] });
  //     refetch();
  //     setShowMintModal(false);
  //     setMintAmount("");
  //     showSuccess("RCN minted to your wallet!");
  //   },
  //   onError: (error: any) => {
  //     const message = error.response?.data?.error || error.message || "Failed to mint RCN";
  //     showError(message);
  //   },
  // });

  // const handleMint = () => {
  //   const amount = parseFloat(mintAmount);
  //   if (isNaN(amount) || amount <= 0) {
  //     showError("Please enter a valid amount");
  //     return;
  //   }
  //   if (amount > totalBalance) {
  //     showError("Amount exceeds available balance");
  //     return;
  //   }
  //   if (amount > 10000) {
  //     showError("Maximum 10,000 RCN per transaction");
  //     return;
  //   }
  //   mintMutation.mutate(amount);
  // };

  const tokenData = {
    tier: (customerData?.customer?.tier as Tier) || "BRONZE",
    balance: totalBalance,
    totalRedeemed: customerData?.customer?.totalRedemptions,
    totalEarned: customerData?.customer?.lifetimeEarnings,
  };

  const displayedServices = useMemo(() => {
    if (!servicesData || !Array.isArray(servicesData)) {
      return [];
    }
    const activeServices = servicesData.filter(
      (service: ServiceData) => service.active,
    );
    const sortedServices = [...activeServices].sort(
      (a: ServiceData, b: ServiceData) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return sortedServices.slice(0, 4);
  }, [servicesData]);

  const handleServicePress = (item: ServiceData) => {
    router.push(`/customer/service/${item.serviceId}`);
  };

  const handleViewAllServices = () => {
    router.navigate("/customer/tabs/service");
  };

  const handleViewAllTrendingServices = () => {
    router.push("/customer/service/trending");
  };

  if (!walletAddress) {
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFCC00"
            colors={["#FFCC00"]}
          />
        }
      >
        <NoShowWarningBanner />
        {/* <AiSearchBar
          // TODO(wire-later): route to the mobile AI assistant screen once it exists. waiting for ai Business logic 
          onPress={() => router.push("/customer/tabs/service")}
        /> */}
        <QuickActions />
        {/* <Modal visible={showMintModal} transparent animationType="fade">
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
        </Modal> */}
        {(trendingLoading || (trendingData && trendingData.length > 0)) && (
          <TrendingSection
            handleViewAllTrendingServices={handleViewAllTrendingServices}
            trendingLoading={trendingLoading}
            trendingData={trendingData}
            handleServicePress={(item) => handleServicePress(item)}
            favoritedIds={favoritedIds}
          />
        )}
        {/* {displayedServices && displayedServices.length > 0 && (
          <AiRecommendedSection
            data={displayedServices}
            isLoading={servicesLoading}
            onServicePress={handleServicePress}
            onSeeAll={handleViewAllServices}
            favoritedIds={favoritedIds}
          />
        )} */}
        <CategoryGrid />
        <NearbyShopsSection />
        <UpcomingBookingsList />
        {!servicesLoading &&
          !trendingLoading &&
          (!trendingData || trendingData.length === 0) &&
          (!displayedServices || displayedServices.length === 0) && (
            <View className="flex-1 justify-center items-center pt-20">
              <Ionicons name="briefcase-outline" size={64} color="#666" />
              <Text className="text-gray-400 text-center mt-4">
                No services available
              </Text>
              <Text className="text-gray-500 text-sm text-center mt-2">
                Check back later for new services
              </Text>
            </View>
          )}
        <View className="h-6" />
      </ScrollView>
    </View>
  );
}
