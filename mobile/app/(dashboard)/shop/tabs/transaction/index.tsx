import React, { useState, useCallback } from "react";
import { 
  View, 
  Text, 
  FlatList, 
  RefreshControl, 
  ActivityIndicator,
  Pressable 
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

  const {
    data: transactions,
    isLoading: transactionsLoading,
    error: transactionsError,
    refetch: transactionsRefetch,
  } = useShopTransactions(userProfile?.shopId || "");

  const transactionHistoryData = React.useMemo(() => {
    return transactions?.purchases || [];
  }, [transactions]);

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
            {transactionsError ? "Shop data not available" : "Unable to fetch transactions"}
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

  const renderHeader = () => (
    <View className="mb-4">
      <View className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-gray-400 text-sm">Total Purchases</Text>
          <Text className="text-white font-bold text-lg">
            {transactionHistoryData.length}
          </Text>
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="text-gray-400 text-sm">Total RCN Bought</Text>
          <Text className="text-[#FFCC00] font-bold text-lg">
            {transactionHistoryData.reduce((sum, tx) => sum + tx.amount, 0).toLocaleString()} RCN
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <ThemedView className="flex-1">
      <View className="pt-20 px-4">
        <View className="flex-row justify-between items-center mb-6">
          <Text className="text-white text-2xl font-bold">
            Purchase History
          </Text>
          <View className="flex-row items-center">
            <View className="bg-[#FFCC00]/20 px-3 py-1 rounded-full">
              <Text className="text-[#FFCC00] text-xs font-semibold">
                RCN PURCHASES
              </Text>
            </View>
          </View>
        </View>

        <FlatList
          data={transactionHistoryData}
          renderItem={renderTransaction}
          keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
          ListHeaderComponent={transactionHistoryData.length > 0 ? renderHeader : null}
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