import {
  View,
  Text,
  Pressable,
  FlatList,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { SearchInput } from "@/components/ui/SearchInput";
import { useCustomerHistoryListUI } from "../hooks";
import { TRANSACTION_FILTERS, DATE_FILTERS } from "../constants";
import { TransactionHistoryCard, FilterChip } from "../components";

export default function CustomerHistoryScreen() {
  const {
    // Data
    transactions,
    transactionCount,
    // Query state
    isLoading,
    error,
    refetch,
    // Refresh
    refreshing,
    handleRefresh,
    // Search
    searchQuery,
    setSearchQuery,
    // Filters
    transactionFilter,
    setTransactionFilter,
    dateFilter,
    setDateFilter,
    hasActiveFilters,
  } = useCustomerHistoryListUI();

  return (
    <View className="w-full h-full bg-zinc-950">
      {/* Header */}
      <View className="pt-16 px-4 pb-2">
        <Text className="text-white text-2xl font-bold mb-4">
          Transaction History
        </Text>

        {/* Search Bar */}
        <View className="mb-4">
          <SearchInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search transactions..."
          />
        </View>

        {/* Transaction Type Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-3"
        >
          {TRANSACTION_FILTERS.map((filter) => (
            <FilterChip
              key={filter.id}
              label={filter.label}
              isActive={transactionFilter === filter.id}
              onPress={() => setTransactionFilter(filter.id)}
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
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TransactionHistoryCard
            variant="customer"
            type={item.type}
            amount={item.amount}
            shopName={item.shopName}
            description={item.description}
            createdAt={item.createdAt}
          />
        )}
        ListEmptyComponent={
          isLoading ? (
            <View className="items-center justify-center py-20">
              <ActivityIndicator size="large" color="#FFCC00" />
              <Text className="text-gray-400 text-base mt-4">
                Loading transactions...
              </Text>
            </View>
          ) : error ? (
            <View className="items-center justify-center py-12">
              <Feather name="alert-circle" color="#EF4444" size={32} />
              <Text className="text-red-400 text-lg mt-4">
                Failed to load transactions
              </Text>
              <Pressable
                onPress={() => refetch()}
                className="mt-4 px-6 py-3 bg-[#FFCC00] rounded-xl"
              >
                <Text className="text-black font-semibold">Retry</Text>
              </Pressable>
            </View>
          ) : (
            <View className="items-center justify-center py-12">
              <Feather name="inbox" color="#666" size={48} />
              <Text className="text-gray-400 text-lg mt-4">
                No transactions found
              </Text>
              <Text className="text-gray-500 text-sm mt-1">
                {hasActiveFilters
                  ? "Try adjusting your filters"
                  : "Your transactions will appear here"}
              </Text>
            </View>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#FFCC00"
            colors={["#FFCC00"]}
          />
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />
    </View>
  );
}
