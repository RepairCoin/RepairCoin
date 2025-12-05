import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  TextInput,
} from "react-native";
import { ThemedView } from "@/components/ui/ThemedView";
import { useAuthStore } from "@/store/auth.store";
import { useShopTransactions } from "@/hooks";
import TransactionHistoryCard from "@/components/common/TransactionHistoryCard";
import { Feather } from "@expo/vector-icons";
import { PurchaseHistory } from "@/services/ShopServices";

export default function TransactionHistory() {
  const { userProfile } = useAuthStore((state) => state);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const {
    data: transactions,
    isLoading: transactionsLoading,
    error: transactionsError,
    refetch: transactionsRefetch,
  } = useShopTransactions(userProfile?.shopId || "");

  const transactionHistoryData = useMemo(() => {
    return transactions?.purchases || [];
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    if (!searchQuery.trim()) {
      return transactionHistoryData;
    }

    const query = searchQuery.toLowerCase();
    return transactionHistoryData.filter((tx) => {
      // Search by date
      const date = new Date(tx.createdAt).toLocaleDateString();
      if (date.toLowerCase().includes(query)) return true;

      // Search by amount
      if (tx.amount.toString().includes(query)) return true;

      // Search by total cost
      if (tx.totalCost?.toString().includes(query)) return true;

      // Search by payment method
      if (tx.paymentMethod?.toLowerCase().includes(query)) return true;

      // Search by status
      if (tx.status?.toLowerCase().includes(query)) return true;

      return false;
    });
  }, [transactionHistoryData, searchQuery]);

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await Promise.all([transactionsRefetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [transactionsRefetch]);

  const renderTransaction = ({ item }: { item: PurchaseHistory }) => (
    <TransactionHistoryCard
      variant="shop"
      amount={item.amount}
      createdAt={item.createdAt}
      paymentMethod={item.paymentMethod}
      totalCost={item.totalCost}
      status={item.status}
      completedAt={item.completedAt}
    />
  );

  const renderEmptyComponent = () => {
    if (transactionsLoading) {
      return (
        <View className="items-center justify-center py-20">
          <ActivityIndicator size="large" color="#FFCC00" />
          <Text className="text-gray-400 text-base mt-4">
            Loading transactions...
          </Text>
        </View>
      );
    }

    if (transactionsError) {
      return (
        <View className="items-center justify-center py-20">
          <Feather name="alert-circle" size={48} color="#EF4444" />
          <Text className="text-red-500 text-lg font-semibold mt-4">
            Failed to load transactions
          </Text>
          <Text className="text-gray-400 text-sm mt-2 text-center px-4">
            {transactionsError
              ? "Shop data not available"
              : "Unable to fetch transactions"}
          </Text>
          <Pressable
            onPress={handleRefresh}
            className="mt-6 px-6 py-3 bg-[#FFCC00] rounded-lg"
          >
            <Text className="text-black font-bold">Try Again</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View className="items-center justify-center py-20">
        <Feather name="inbox" size={48} color="#666" />
        <Text className="text-gray-400 text-lg font-semibold mt-4">
          No transactions yet
        </Text>
        <Text className="text-gray-500 text-sm mt-2 text-center px-4">
          Your RCN purchase history will appear here
        </Text>
      </View>
    );
  };

  return (
    <ThemedView className="flex-1">
      <View className="pt-20 px-4">
        {/* Search Input */}
        <View className="flex-row items-center bg-zinc-800 rounded-full px-4 py-3 mb-4">
          <Feather name="search" size={20} color="#9CA3AF" />
          <TextInput
            className="flex-1 text-white ml-3 text-left"
            placeholder="Search by date, amount, status..."
            placeholderTextColor="#6B7280"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <Feather name="x-circle" size={20} color="#9CA3AF" />
            </Pressable>
          )}
        </View>

        {/* Filter Buttons */}
        <View className="flex-row gap-4 rounded-full p-1 mb-4">
          <Pressable className="flex-1 py-2 rounded-full bg-[#FFCC00]">
            <Text className="text-center font-semibold text-black">Date</Text>
          </Pressable>
          <Pressable className="flex-1 py-2 rounded-full bg-[#FFCC00]">
            <Text className="text-center font-semibold text-black">
              Transaction
            </Text>
          </Pressable>
          <Pressable className="flex-1 py-2 rounded-full bg-[#FFCC00]">
            <Text className="text-center font-semibold text-black">Amount</Text>
          </Pressable>
        </View>

        {/* Results count when searching */}
        {searchQuery.length > 0 && (
          <Text className="text-gray-400 text-sm mb-2">
            {filteredTransactions.length} result
            {filteredTransactions.length !== 1 ? "s" : ""} found
          </Text>
        )}

        <FlatList
          data={filteredTransactions}
          renderItem={renderTransaction}
          keyExtractor={(item) =>
            item.id?.toString() || Math.random().toString()
          }
          ListEmptyComponent={renderEmptyComponent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#FFCC00"
              colors={["#FFCC00"]}
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      </View>
    </ThemedView>
  );
}
