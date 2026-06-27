import { useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import { SearchInput } from "@/shared/components/ui/SearchInput";
import { useBlockedCustomers, useUnblockCustomer } from "../hooks/useModeration";
import { BlockedCustomer } from "@/feature/shop/services/shop.interface";

function formatBlockedDate(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function shortAddress(addr?: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function BlockedCustomersScreen() {
  const { data, isLoading, refetch, isRefetching } = useBlockedCustomers();
  const { mutate: unblock } = useUnblockCustomer();
  const [search, setSearch] = useState("");

  const blocked = (data ?? []) as BlockedCustomer[];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return blocked;
    return blocked.filter(
      (b) =>
        b.customerName?.toLowerCase().includes(q) ||
        b.customerWalletAddress?.toLowerCase().includes(q) ||
        b.reason?.toLowerCase().includes(q),
    );
  }, [blocked, search]);

  const confirmUnblock = (item: BlockedCustomer) => {
    Alert.alert(
      "Unblock Customer",
      `Unblock ${item.customerName || shortAddress(item.customerWalletAddress)}? They will be able to book again.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unblock",
          style: "destructive",
          onPress: () => unblock(item.customerWalletAddress),
        },
      ],
    );
  };

  return (
    <View className="flex-1 bg-zinc-950">
      <AppHeader title="Blocked Customers" />

      <View className="px-4 pt-3 pb-2">
        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, wallet, or reason"
        />
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FFCC00" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#FFCC00"
              colors={["#FFCC00"]}
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center mt-24">
              <Ionicons name="shield-checkmark-outline" size={44} color="#333" />
              <Text className="text-gray-500 mt-3">No blocked customers</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="bg-[#1a1a1a] rounded-xl p-4 mb-3 flex-row items-start justify-between">
              <View className="flex-1 mr-3">
                <Text className="text-white font-semibold">
                  {item.customerName || shortAddress(item.customerWalletAddress)}
                </Text>
                {item.customerName ? (
                  <Text className="text-gray-500 text-xs mt-0.5">
                    {shortAddress(item.customerWalletAddress)}
                  </Text>
                ) : null}
                {item.reason ? (
                  <Text className="text-gray-400 text-sm mt-1">{item.reason}</Text>
                ) : null}
                {formatBlockedDate(item.blockedAt) ? (
                  <Text className="text-gray-600 text-xs mt-1">
                    Blocked {formatBlockedDate(item.blockedAt)}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={() => confirmUnblock(item)}
                className="px-3 py-2 rounded-lg bg-[#FFCC00]"
                activeOpacity={0.7}
              >
                <Text className="text-black text-xs font-bold">Unblock</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}
