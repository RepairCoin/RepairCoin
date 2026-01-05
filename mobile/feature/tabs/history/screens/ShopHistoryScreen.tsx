// Libraries
import React from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";

// Components
import { ThemedView } from "@/components/ui/ThemedView";
import { SearchInput } from "@/components/ui/SearchInput";
import TransactionHistoryCard from "../components/TransactionHistoryCard";

// Hooks
import {
  useHistoryQuery,
  useHistoryUI,
  STATUS_FILTERS,
  DATE_FILTERS,
} from "../hooks";

// Others
import { PurchaseHistoryData } from "@/interfaces/purchase.interface";

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

export default function ShopHistoryScreen() {
  // UI state (filters, search)
  const {
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    dateFilter,
    setDateFilter,
    hasActiveFilters,
  } = useHistoryUI();

  // Data fetching with filtering
  const {
    transactions,
    transactionCount,
    isLoading,
    error,
    refreshing,
    handleRefresh,
  } = useHistoryQuery(searchQuery, statusFilter, dateFilter);

  const renderTransaction = ({ item }: { item: PurchaseHistoryData }) => (
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
    if (isLoading) {
      return (
        <View className="items-center justify-center py-20">
          <ActivityIndicator size="large" color="#FFCC00" />
          <Text className="text-gray-400 text-base mt-4">
            Loading transactions...
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View className="items-center justify-center py-20">
          <Feather name="alert-circle" size={48} color="#EF4444" />
          <Text className="text-red-500 text-lg font-semibold mt-4">
            Failed to load transactions
          </Text>
          <Text className="text-gray-400 text-sm mt-2 text-center px-4">
            {error ? "Shop data not available" : "Unable to fetch transactions"}
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
          {hasActiveFilters
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
        <View className="mb-4">
          <SearchInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search transactions..."
          />
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
          {transactionCount} transaction{transactionCount !== 1 ? "s" : ""}
        </Text>
      </View>

      {/* Transaction List */}
      <FlatList
        className="px-4"
        data={isLoading || error ? [] : transactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
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
