import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ThemedView } from "@/shared/components/ui/ThemedView";
import { useServiceOrdersUI } from "../../hooks";
import { ServiceOrderWithDetails } from "../../types";
import OrderCard from "./OrderCard";
import OrderDetailModal from "./OrderDetailModal";

export default function ServiceOrdersScreen() {
  const {
    orders,
    isLoading,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    selectedOrder,
    setSelectedOrder,
    stats,
    processingId,
    handleApprove,
    handleMarkComplete,
    handleMarkNoShow,
    refetch,
    filters,
  } = useServiceOrdersUI();

  const [refreshing, setRefreshing] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const handleOrderPress = (order: ServiceOrderWithDetails) => {
    setSelectedOrder(order);
    setShowDetailModal(true);
  };

  const handleApproveOrder = async (orderId: string) => {
    try {
      await handleApprove(orderId);
    } catch {
      Alert.alert("Error", "Failed to approve booking");
    }
  };

  const handleCompleteOrder = async (orderId: string) => {
    Alert.alert(
      "Complete Order",
      "Mark this service as completed? The customer will receive their RCN rewards.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Complete",
          onPress: async () => {
            try {
              await handleMarkComplete(orderId);
            } catch {
              Alert.alert("Error", "Failed to complete order");
            }
          },
        },
      ]
    );
  };

  const handleNoShow = async (orderId: string) => {
    Alert.alert("Mark No-Show", "Mark this booking as a no-show?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Mark No-Show",
        style: "destructive",
        onPress: async () => {
          try {
            await handleMarkNoShow(orderId);
          } catch {
            Alert.alert("Error", "Failed to mark no-show");
          }
        },
      },
    ]);
  };

  const renderOrderCard = ({ item }: { item: ServiceOrderWithDetails }) => (
    <OrderCard
      order={item}
      onPress={() => handleOrderPress(item)}
      onApprove={() => handleApproveOrder(item.orderId)}
      onMarkComplete={() => handleCompleteOrder(item.orderId)}
      onMarkNoShow={() => handleNoShow(item.orderId)}
      isProcessing={processingId === item.orderId}
    />
  );

  const keyExtractor = (item: ServiceOrderWithDetails) => item.orderId;

  return (
    <ThemedView className="flex-1">
      <View className="pt-14 px-4 flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center">
            <Pressable onPress={() => router.back()} className="mr-3">
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </Pressable>
            <Text className="text-white text-xl font-bold">Service Orders</Text>
          </View>
        </View>

        {/* Stats Cards */}
        <View className="flex-row mb-4">
          <View className="flex-1 bg-[#1a1a1a] rounded-xl p-3 mr-1.5">
            <View className="flex-row items-center">
              <View className="p-1.5 bg-[#FFCC00]/20 rounded-lg mr-2">
                <Ionicons name="time-outline" size={16} color="#FFCC00" />
              </View>
              <View>
                <Text className="text-gray-400 text-[10px]">Pending</Text>
                <Text className="text-white text-lg font-bold">
                  {stats.pending}
                </Text>
              </View>
            </View>
          </View>
          <View className="flex-1 bg-[#1a1a1a] rounded-xl p-3 mr-1.5">
            <View className="flex-row items-center">
              <View className="p-1.5 bg-green-500/20 rounded-lg mr-2">
                <Ionicons name="cash-outline" size={16} color="#4ADE80" />
              </View>
              <View>
                <Text className="text-gray-400 text-[10px]">Paid</Text>
                <Text className="text-white text-lg font-bold">
                  {stats.paid}
                </Text>
              </View>
            </View>
          </View>
          <View className="flex-1 bg-[#1a1a1a] rounded-xl p-3 mr-1.5">
            <View className="flex-row items-center">
              <View className="p-1.5 bg-blue-500/20 rounded-lg mr-2">
                <Ionicons name="checkmark-circle-outline" size={16} color="#60A5FA" />
              </View>
              <View>
                <Text className="text-gray-400 text-[10px]">Done</Text>
                <Text className="text-white text-lg font-bold">
                  {stats.completed}
                </Text>
              </View>
            </View>
          </View>
          <View className="flex-1 bg-[#1a1a1a] rounded-xl p-3">
            <View className="flex-row items-center">
              <View className="p-1.5 bg-[#FFCC00]/20 rounded-lg mr-2">
                <Ionicons name="wallet-outline" size={16} color="#FFCC00" />
              </View>
              <View>
                <Text className="text-gray-400 text-[10px]">Revenue</Text>
                <Text className="text-white text-sm font-bold" numberOfLines={1}>
                  ${stats.revenue.toFixed(0)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Search */}
        <View className="flex-row items-center bg-[#1a1a1a] rounded-xl px-3 py-2.5 mb-3">
          <Ionicons name="search-outline" size={18} color="#6B7280" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by name, ID, or address..."
            placeholderTextColor="#6B7280"
            className="flex-1 ml-2 text-white text-sm"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color="#6B7280" />
            </Pressable>
          )}
        </View>

        {/* Filters */}
        <FlatList
          data={filters}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.key}
          className="mb-3 max-h-9"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setFilter(item.key)}
              className={`px-3.5 py-1.5 rounded-full mr-2 ${
                filter === item.key
                  ? "bg-[#FFCC00]"
                  : "bg-[#1a1a1a] border border-gray-800"
              }`}
            >
              <Text
                className={`text-xs font-medium ${
                  filter === item.key ? "text-black" : "text-gray-400"
                }`}
              >
                {item.label}
              </Text>
            </Pressable>
          )}
        />

        {/* Orders List */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#FFCC00" />
            <Text className="text-gray-400 mt-4">Loading orders...</Text>
          </View>
        ) : (
          <FlatList
            data={orders}
            renderItem={renderOrderCard}
            keyExtractor={keyExtractor}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#FFCC00"
                colors={["#FFCC00"]}
              />
            }
            ListEmptyComponent={
              <View className="items-center justify-center py-20">
                <Ionicons name="receipt-outline" size={48} color="#374151" />
                <Text className="text-gray-400 text-lg mt-4">No orders found</Text>
                <Text className="text-gray-500 text-sm mt-1">
                  {searchQuery
                    ? "Try a different search"
                    : "Orders will appear here when customers book"}
                </Text>
              </View>
            }
          />
        )}
      </View>

      {/* Detail Modal */}
      <OrderDetailModal
        visible={showDetailModal}
        order={selectedOrder}
        onClose={() => setShowDetailModal(false)}
      />
    </ThemedView>
  );
}
