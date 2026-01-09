import { useCallback, useState, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAuthStore } from "@/store/auth.store";
import { SearchInput } from "@/components/ui/SearchInput";
import TransactionHistoryCard from "@/components/common/TransactionHistoryCard";
import { useCustomer } from "@/hooks/customer/useCustomer";
import { TransactionData } from "@/interfaces/customer.interface";

// Filter types
type TransactionFilter = "all" | "earned" | "redeemed" | "gifts";
type DateFilter = "all" | "today" | "week" | "month";

const TRANSACTION_FILTERS: { id: TransactionFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "earned", label: "Earned" },
  { id: "redeemed", label: "Redeemed" },
  { id: "gifts", label: "Gifts" },
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
  const { useGetTransactionsByWalletAddress } = useCustomer();
  const { account } = useAuthStore((state) => state);

  const [searchString, setSearchString] = useState<string>("");
  const [refreshing, setRefreshing] = useState(false);
  const [transactionFilter, setTransactionFilter] = useState<TransactionFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  const {
    data: transactionData,
    isLoading,
    error,
    refetch,
  } = useGetTransactionsByWalletAddress(account?.address, 50);

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  // Filter transactions based on type and date
  const filteredTransactions = useMemo(() => {
    if (!transactionData?.transactions) return [];

    let filtered = transactionData.transactions;

    // Filter by search string
    if (searchString) {
      filtered = filtered.filter(
        (t: TransactionData) =>
          t.shopName?.toLowerCase().includes(searchString.toLowerCase()) ||
          t.type?.toLowerCase().includes(searchString.toLowerCase()) ||
          t.description?.toLowerCase().includes(searchString.toLowerCase())
      );
    }

    // Filter by transaction type
    if (transactionFilter !== "all") {
      filtered = filtered.filter((t: TransactionData) => {
        const type = t.type?.toLowerCase();
        switch (transactionFilter) {
          case "earned":
            return ["earned", "bonus", "referral", "tier_bonus"].includes(type);
          case "redeemed":
            return ["redeemed", "redemption"].includes(type);
          case "gifts":
            return ["transfer_in", "transfer_out", "gift"].includes(type);
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

      filtered = filtered.filter((t: TransactionData) => {
        const txDate = new Date(t.createdAt);
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
  }, [transactionData, searchString, transactionFilter, dateFilter]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const transactions = transactionData?.transactions || [];
    const earned = transactions
      .filter((t: TransactionData) =>
        ["earned", "bonus", "referral", "tier_bonus", "transfer_in"].includes(t.type?.toLowerCase())
      )
      .reduce((sum: number, t: TransactionData) => sum + t.amount, 0);
    const redeemed = transactions
      .filter((t: TransactionData) =>
        ["redeemed", "redemption", "transfer_out"].includes(t.type?.toLowerCase())
      )
      .reduce((sum: number, t: TransactionData) => sum + Math.abs(t.amount), 0);
    return { earned, redeemed, total: transactions.length };
  }, [transactionData]);

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
            value={searchString}
            onChangeText={setSearchString}
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
          {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? "s" : ""}
        </Text>
      </View>

      {/* Transaction List */}
      <FlatList
        className="px-4"
        data={isLoading || error ? [] : filteredTransactions}
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
                {transactionFilter !== "all" || dateFilter !== "all"
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
