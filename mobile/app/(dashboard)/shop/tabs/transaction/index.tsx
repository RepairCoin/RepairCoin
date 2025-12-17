import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { ThemedView } from "@/components/ui/ThemedView";
import { useAuthStore } from "@/store/auth.store";
import { useShopTransactions } from "@/hooks";
import TransactionHistoryCard from "@/components/common/TransactionHistoryCard";
import { Feather, Ionicons } from "@expo/vector-icons";
import { PurchaseHistory } from "@/services/ShopServices";

// Filter types
type StatusFilter = "all" | "pending" | "completed" | "failed";
type DateFilter = "all" | "today" | "week" | "month";

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "completed", label: "Completed" },
  { id: "failed", label: "Failed" },
];

const DATE_FILTERS: { id: DateFilter; label: string }[] = [
  { id: "all", label: "All Time" },
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
];

// Filter chip component
const FilterChip = ({
  label,
  isActive,
  onPress,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity
    onPress={onPress}
    className={`px-4 py-2 rounded-full mr-2 ${
      isActive ? "bg-[#FFCC00]" : "bg-zinc-800"
    }`}
    activeOpacity={0.7}
  >
    <Text
      className={`text-sm font-medium ${
        isActive ? "text-black" : "text-gray-400"
      }`}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

export default function TransactionHistory() {
  const { userProfile } = useAuthStore((state) => state);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  const {
    data: transactions,
    isLoading: transactionsLoading,
    error: transactionsError,
    refetch: transactionsRefetch,
  } = useShopTransactions(userProfile?.shopId || "");

  const transactionHistoryData = useMemo(() => {
    return transactions?.purchases || [];
  }, [transactions]);

  // Filter transactions based on status, date, and search
  const filteredTransactions = useMemo(() => {
    if (!transactionHistoryData) return [];

    let filtered = transactionHistoryData;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((tx) => {
        const date = new Date(tx.createdAt).toLocaleDateString();
        if (date.toLowerCase().includes(query)) return true;
        if (tx.amount.toString().includes(query)) return true;
        if (tx.totalCost?.toString().includes(query)) return true;
        if (tx.paymentMethod?.toLowerCase().includes(query)) return true;
        if (tx.status?.toLowerCase().includes(query)) return true;
        return false;
      });
    }

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter((tx) => {
        const status = tx.status?.toLowerCase();
        switch (statusFilter) {
          case "pending":
            return status === "pending";
          case "completed":
            return status === "completed" || status === "success";
          case "failed":
            return status === "failed" || status === "cancelled";
          default:
            return true;
        }
      });
    }

    // Filter by date
    if (dateFilter !== "all") {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(startOfDay);
      startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      filtered = filtered.filter((tx) => {
        const txDate = new Date(tx.createdAt);
        switch (dateFilter) {
          case "today":
            return txDate >= startOfDay;
          case "week":
            return txDate >= startOfWeek;
          case "month":
            return txDate >= startOfMonth;
          default:
            return true;
        }
      });
    }

    return filtered;
  }, [transactionHistoryData, searchQuery, statusFilter, dateFilter]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const allTransactions = transactionHistoryData || [];
    const completedTx = allTransactions.filter(
      (tx) => tx.status?.toLowerCase() === "completed" || tx.status?.toLowerCase() === "success"
    );
    const totalRcnPurchased = completedTx.reduce((sum, tx) => sum + tx.amount, 0);
    const totalSpent = completedTx.reduce((sum, tx) => sum + (tx.totalCost || 0), 0);
    const pendingTx = allTransactions.filter((tx) => tx.status?.toLowerCase() === "pending");
    return {
      totalRcnPurchased,
      totalSpent,
      totalTransactions: allTransactions.length,
      pendingCount: pendingTx.length,
    };
  }, [transactionHistoryData]);

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
      <View className="items-center justify-center py-12">
        <Feather name="inbox" size={48} color="#666" />
        <Text className="text-gray-400 text-lg font-semibold mt-4">
          No transactions found
        </Text>
        <Text className="text-gray-500 text-sm mt-1 text-center px-4">
          {statusFilter !== "all" || dateFilter !== "all"
            ? "Try adjusting your filters"
            : "Your RCN purchase history will appear here"}
        </Text>
      </View>
    );
  };

  return (
    <ThemedView className="flex-1">
      <View className="pt-16 px-4 pb-2">
        <Text className="text-white text-2xl font-bold mb-4">
          Purchase History
        </Text>
        {/* Search Input */}
        <View className="flex-row items-center bg-zinc-900 rounded-xl px-4 mb-4">
          <Feather name="search" size={20} color="#666" />
          <TextInput
            className="flex-1 text-white ml-2 py-3"
            placeholder="Search transactions..."
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>

        {/* Status Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-3"
        >
          {STATUS_FILTERS.map((filter) => (
            <FilterChip
              key={filter.id}
              label={filter.label}
              isActive={statusFilter === filter.id}
              onPress={() => setStatusFilter(filter.id)}
            />
          ))}
        </ScrollView>

        {/* Date Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-2"
        >
          {DATE_FILTERS.map((filter) => (
            <FilterChip
              key={filter.id}
              label={filter.label}
              isActive={dateFilter === filter.id}
              onPress={() => setDateFilter(filter.id)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Results count */}
      <View className="px-4 pb-2">
        <Text className="text-gray-500 text-sm">
          {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? "s" : ""}
        </Text>
      </View>

      {/* Transaction List */}
      <FlatList
        className="px-4"
        data={transactionsLoading || transactionsError ? [] : filteredTransactions}
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
    </ThemedView>
  );
}
