import { useState, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { messageApi } from "../services/message.services";
import { AutoMessageHistory } from "@/shared/interfaces/message.interface";

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "delivered":
      return "#22c55e";
    case "sent":
      return "#3b82f6";
    case "failed":
      return "#ef4444";
    default:
      return "#6b7280";
  }
};

type AutoMessageHistoryModalProps = {
  visible: boolean;
  autoMessageId: string;
  onClose: () => void;
};

export default function AutoMessageHistoryModal({
  visible,
  autoMessageId,
  onClose,
}: AutoMessageHistoryModalProps) {
  const [page, setPage] = useState(1);

  // Fetch history
  const { data: historyData, isLoading, isFetching } = useQuery({
    queryKey: ["auto-message-history", autoMessageId, page],
    queryFn: () => messageApi.getAutoMessageHistory(autoMessageId, page, 20),
    enabled: visible && !!autoMessageId,
  });

  const history = historyData?.data || [];
  const pagination = historyData?.pagination;
  const hasMore = pagination ? pagination.page < pagination.totalPages : false;

  const loadMore = useCallback(() => {
    if (hasMore && !isFetching) {
      setPage((p) => p + 1);
    }
  }, [hasMore, isFetching]);

  const renderItem = ({ item }: { item: AutoMessageHistory }) => (
    <View className="flex-row items-center py-3 border-b border-zinc-800">
      {/* Customer Info */}
      <View className="flex-1">
        <Text className="text-white font-medium">
          {item.customerName || "Unknown Customer"}
        </Text>
        <Text className="text-gray-500 text-xs">
          {item.customerAddress.slice(0, 6)}...{item.customerAddress.slice(-4)}
        </Text>
      </View>

      {/* Status & Time */}
      <View className="items-end">
        <View
          className="flex-row items-center px-2 py-0.5 rounded-full"
          style={{ backgroundColor: getStatusColor(item.status) + "20" }}
        >
          <Ionicons
            name={
              item.status === "delivered"
                ? "checkmark-done"
                : item.status === "sent"
                ? "checkmark"
                : "close"
            }
            size={12}
            color={getStatusColor(item.status)}
          />
          <Text
            className="text-xs ml-1 capitalize"
            style={{ color: getStatusColor(item.status) }}
          >
            {item.status}
          </Text>
        </View>
        <Text className="text-gray-500 text-xs mt-1">
          {formatDate(item.sentAt)}
        </Text>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View className="items-center justify-center py-12">
      {isLoading ? (
        <ActivityIndicator size="large" color="#FFCC00" />
      ) : (
        <>
          <View className="w-16 h-16 rounded-full bg-zinc-800 items-center justify-center mb-4">
            <Ionicons name="mail-unread-outline" size={32} color="#4B5563" />
          </View>
          <Text className="text-white font-semibold mb-2">No Send History</Text>
          <Text className="text-gray-500 text-center text-sm px-4">
            Messages will appear here once they are sent.
          </Text>
        </>
      )}
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 bg-black/60 justify-end" onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View className="bg-zinc-900 rounded-t-3xl max-h-[70%]">
            {/* Header */}
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-zinc-800">
              <Text className="text-white text-lg font-semibold">
                Send History
              </Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Summary */}
            {pagination && pagination.totalItems > 0 && (
              <View className="px-5 py-2 bg-zinc-800/50">
                <Text className="text-gray-400 text-sm">
                  {pagination.totalItems} message{pagination.totalItems !== 1 ? "s" : ""} sent
                </Text>
              </View>
            )}

            {/* List */}
            <FlatList
              data={history}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={{ paddingHorizontal: 20 }}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={renderEmpty}
              onEndReached={loadMore}
              onEndReachedThreshold={0.5}
              ListFooterComponent={
                isFetching && history.length > 0 ? (
                  <View className="py-4">
                    <ActivityIndicator size="small" color="#FFCC00" />
                  </View>
                ) : null
              }
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
