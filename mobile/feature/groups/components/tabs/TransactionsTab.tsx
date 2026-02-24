import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { groupsApi } from "../../services";
import { groupsKeys } from "../../hooks";
import { AffiliateGroupTokenTransaction } from "../../types";

interface TransactionsTabProps {
  groupId: string;
}

type FilterType = "all" | "earn" | "redeem";

export function TransactionsTab({ groupId }: TransactionsTabProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [...groupsKeys.transactions(groupId), filter, page],
    queryFn: () =>
      groupsApi.getGroupTransactions(groupId, {
        page,
        limit: 20,
        type: filter === "all" ? undefined : filter,
      }),
  });

  const transactions = data?.items || [];
  const pagination = data?.pagination;
  const hasMore = pagination ? page < pagination.totalPages : false;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const renderTransaction = ({ item }: { item: AffiliateGroupTokenTransaction }) => {
    const isEarn = item.type === "earn";

    return (
      <View className="bg-zinc-900 rounded-xl p-4 mb-3 border border-zinc-800">
        <View className="flex-row items-center">
          {/* Icon */}
          <View
            className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
              isEarn ? "bg-green-500/20" : "bg-orange-500/20"
            }`}
          >
            <Ionicons
              name={isEarn ? "arrow-up" : "arrow-down"}
              size={20}
              color={isEarn ? "#22c55e" : "#f97316"}
            />
          </View>

          {/* Info */}
          <View className="flex-1">
            <View className="flex-row items-center justify-between">
              <Text className="text-white font-semibold">
                {isEarn ? "Issued" : "Redeemed"}
              </Text>
              <Text
                className={`font-bold ${
                  isEarn ? "text-green-500" : "text-orange-500"
                }`}
              >
                {isEarn ? "+" : "-"}{item.amount}
              </Text>
            </View>
            <Text className="text-gray-500 text-sm mt-1">
              {formatAddress(item.customerAddress)}
            </Text>
          </View>
        </View>

        {/* Details */}
        <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-zinc-800">
          <Text className="text-gray-500 text-xs">
            {formatDate(item.createdAt)}
          </Text>
          {item.reason && (
            <Text className="text-gray-500 text-xs" numberOfLines={1}>
              {item.reason}
            </Text>
          )}
        </View>

        {/* Balance Change */}
        {item.balanceBefore !== undefined && item.balanceAfter !== undefined && (
          <View className="flex-row items-center mt-2">
            <Text className="text-gray-600 text-xs">
              Balance: {item.balanceBefore} → {item.balanceAfter}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View className="flex-1 p-4">
      {/* Filter Tabs */}
      <View className="flex-row mb-4">
        {(["all", "earn", "redeem"] as FilterType[]).map((f) => (
          <Pressable
            key={f}
            onPress={() => {
              setFilter(f);
              setPage(1);
            }}
            className={`flex-1 py-2 rounded-lg mr-2 last:mr-0 ${
              filter === f ? "bg-yellow-500" : "bg-zinc-800"
            }`}
          >
            <Text
              className={`text-center font-medium capitalize ${
                filter === f ? "text-black" : "text-gray-400"
              }`}
            >
              {f === "all" ? "All" : f === "earn" ? "Issued" : "Redeemed"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Transactions List */}
      {isLoading ? (
        <View className="items-center py-10">
          <ActivityIndicator size="large" color="#FFCC00" />
        </View>
      ) : transactions.length === 0 ? (
        <View className="items-center py-10">
          <Ionicons name="receipt-outline" size={48} color="#333" />
          <Text className="text-gray-500 mt-4 text-center">
            No transactions yet
          </Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          renderItem={renderTransaction}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListFooterComponent={() => (
            <View className="items-center py-4">
              {isFetching && !isLoading && (
                <ActivityIndicator size="small" color="#FFCC00" />
              )}
              {hasMore && !isFetching && (
                <Pressable
                  onPress={() => setPage((p) => p + 1)}
                  className="bg-zinc-800 px-6 py-2 rounded-lg"
                >
                  <Text className="text-gray-400">Load More</Text>
                </Pressable>
              )}
              {!hasMore && transactions.length > 0 && (
                <Text className="text-gray-600 text-sm">
                  {pagination?.total || transactions.length} transactions total
                </Text>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}
