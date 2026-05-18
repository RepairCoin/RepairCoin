import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCustomerTransactionsQuery } from "../../hooks";
import { TransactionData } from "@/feature/customer/profile/services/customer.interface";
import { useMemo } from "react";

interface RecentTransactionsModalProps {
  visible: boolean;
  onClose: () => void;
}

function getTransactionIcon(type: string) {
  const t = type?.toLowerCase();
  if (["earned", "bonus", "referral", "tier_bonus", "mint"].includes(t)) {
    return { name: "arrow-down-circle" as const, color: "#22C55E" };
  }
  if (["redeemed", "redemption", "service_redemption"].includes(t)) {
    return { name: "arrow-up-circle" as const, color: "#EF4444" };
  }
  if (["transfer_in", "gift_received"].includes(t)) {
    return { name: "gift" as const, color: "#A855F7" };
  }
  if (["transfer_out", "gift_sent"].includes(t)) {
    return { name: "send" as const, color: "#F97316" };
  }
  return { name: "swap-horizontal" as const, color: "#9CA3AF" };
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatType(type: string) {
  return type
    ?.replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function RecentTransactionsModal({
  visible,
  onClose,
}: RecentTransactionsModalProps) {
  const { data, isLoading } = useCustomerTransactionsQuery(5);

  const transactions = useMemo((): TransactionData[] => {
    return data?.pages?.flatMap((page: any) => page?.transactions || [])?.slice(0, 5) || [];
  }, [data]);

  const handleViewAll = () => {
    onClose();
    router.push("/customer/tabs/history");
  };

  const renderItem = ({ item }: { item: TransactionData }) => {
    const icon = getTransactionIcon(item.type);
    const isPositive = item.amount > 0;

    return (
      <View className="flex-row items-center py-3 border-b border-zinc-800">
        <View className="w-9 h-9 rounded-full bg-zinc-800 items-center justify-center mr-3">
          <Ionicons name={icon.name} size={18} color={icon.color} />
        </View>
        <View className="flex-1">
          <Text className="text-white text-sm font-medium" numberOfLines={1}>
            {item.shopName || formatType(item.type)}
          </Text>
          <Text className="text-gray-500 text-xs mt-0.5">
            {formatDate(item.createdAt)}
          </Text>
        </View>
        <Text
          className={`font-bold text-sm ${isPositive ? "text-green-400" : "text-red-400"}`}
        >
          {isPositive ? "+" : ""}
          {item.amount.toFixed(2)} RCN
        </Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/60">
        <View className="bg-zinc-900 rounded-t-3xl border-t border-zinc-800">
          {/* Handle bar */}
          <View className="items-center pt-3 pb-1">
            <View className="w-10 h-1 rounded-full bg-zinc-700" />
          </View>

          {/* Header */}
          <View className="flex-row items-center justify-between px-5 pb-3">
            <Text className="text-white text-lg font-bold">
              Recent Transactions
            </Text>
            <TouchableOpacity onPress={onClose} className="p-1">
              <Ionicons name="close" size={22} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View className="px-5" style={{ minHeight: 200 }}>
            {isLoading ? (
              <View className="items-center justify-center py-10">
                <ActivityIndicator size="small" color="#FFCC00" />
              </View>
            ) : transactions.length === 0 ? (
              <View className="items-center justify-center py-10">
                <Feather name="inbox" size={36} color="#666" />
                <Text className="text-gray-500 mt-3 text-sm">
                  No transactions yet
                </Text>
              </View>
            ) : (
              <FlatList
                data={transactions}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderItem}
                scrollEnabled={false}
              />
            )}
          </View>

          {/* View All Button */}
          <View className="px-5 pt-3 pb-6">
            <TouchableOpacity
              onPress={handleViewAll}
              className="bg-zinc-800 rounded-xl py-3.5 flex-row items-center justify-center"
              activeOpacity={0.8}
            >
              <Text className="text-[#FFCC00] font-semibold mr-2">
                View All Transactions
              </Text>
              <Ionicons name="arrow-forward" size={16} color="#FFCC00" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
