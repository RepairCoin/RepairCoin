import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Switch,
} from "react-native";
import { router } from "expo-router";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ThemedView } from "@/shared/components/ui/ThemedView";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import { SkeletonList } from "@/shared/components/ui/Skeleton";
import { messageApi } from "../services/message.services";
import { AutoMessage } from "@/shared/interfaces/message.interface";
import AutoMessageHistoryModal from "../components/AutoMessageHistoryModal";

const getTriggerLabel = (autoMessage: AutoMessage): string => {
  if (autoMessage.triggerType === "schedule") {
    const scheduleLabels: Record<string, string> = {
      daily: "Every day",
      weekly: `Every ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][autoMessage.scheduleDayOfWeek || 0]}`,
      monthly: `Day ${autoMessage.scheduleDayOfMonth || 1} of month`,
    };
    const timeStr = autoMessage.scheduleHour !== undefined
      ? `at ${autoMessage.scheduleHour % 12 || 12}${autoMessage.scheduleHour >= 12 ? "PM" : "AM"}`
      : "";
    return `${scheduleLabels[autoMessage.scheduleType || "daily"]} ${timeStr}`;
  }

  const eventLabels: Record<string, string> = {
    booking_completed: "After booking completed",
    booking_cancelled: "After booking cancelled",
    first_visit: "On first visit",
    inactive_30_days: "After 30 days inactive",
  };
  const delayStr = autoMessage.delayHours
    ? ` (+${autoMessage.delayHours}h delay)`
    : "";
  return eventLabels[autoMessage.eventType || ""] + delayStr;
};

const getTargetLabel = (target: string): string => {
  const labels: Record<string, string> = {
    all: "All customers",
    active: "Active customers",
    inactive_30d: "Inactive 30+ days",
    has_balance: "Has RCN balance",
    completed_booking: "Completed booking",
  };
  return labels[target] || target;
};

export default function AutoMessagesScreen() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [historyModalId, setHistoryModalId] = useState<string | null>(null);

  // Fetch auto-messages
  const {
    data: autoMessagesData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["auto-messages"],
    queryFn: () => messageApi.getAutoMessages(),
  });

  const autoMessages = autoMessagesData?.data || [];

  // Toggle mutation
  const toggleMutation = useMutation({
    mutationFn: (id: string) => messageApi.toggleAutoMessage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto-messages"] });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => messageApi.deleteAutoMessage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto-messages"] });
    },
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleDelete = useCallback(
    (autoMessage: AutoMessage) => {
      Alert.alert(
        "Delete Auto-Message",
        `Are you sure you want to delete "${autoMessage.name}"? This will also delete all send history.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => deleteMutation.mutate(autoMessage.id),
          },
        ]
      );
    },
    [deleteMutation]
  );

  const handleEdit = useCallback((autoMessage: AutoMessage) => {
    router.push(`/shop/messages/auto-message-editor?id=${autoMessage.id}` as any);
  }, []);

  const handleAddNew = useCallback(() => {
    router.push("/shop/messages/auto-message-editor" as any);
  }, []);

  const renderItem = ({ item }: { item: AutoMessage }) => (
    <View className="bg-[#1a1a1a] rounded-xl p-4 mb-3 border border-zinc-800">
      <View className="flex-row items-start justify-between mb-3">
        {/* Title & Status */}
        <View className="flex-1 mr-3">
          <View className="flex-row items-center mb-1">
            <View
              className={`w-2 h-2 rounded-full mr-2 ${
                item.isEnabled ? "bg-green-500" : "bg-gray-500"
              }`}
            />
            <Text className="text-white font-semibold text-base flex-1" numberOfLines={1}>
              {item.name}
            </Text>
          </View>
          {/* Trigger Info */}
          <Text className="text-gray-400 text-sm">
            {getTriggerLabel(item)}
          </Text>
        </View>

        {/* Toggle Switch */}
        <Switch
          value={item.isEnabled}
          onValueChange={() => toggleMutation.mutate(item.id)}
          trackColor={{ false: "#3f3f46", true: "#22c55e40" }}
          thumbColor={item.isEnabled ? "#22c55e" : "#71717a"}
          disabled={toggleMutation.isPending}
        />
      </View>

      {/* Message Preview */}
      <View className="bg-zinc-800/50 rounded-lg p-3 mb-3">
        <Text className="text-gray-300 text-sm" numberOfLines={2}>
          {item.messageTemplate}
        </Text>
      </View>

      {/* Meta Row */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          {/* Target Badge */}
          <View className="bg-zinc-800 px-2 py-1 rounded-full">
            <Text className="text-zinc-400 text-xs">
              {getTargetLabel(item.targetAudience)}
            </Text>
          </View>
          {/* Send Count */}
          <TouchableOpacity
            onPress={() => setHistoryModalId(item.id)}
            className="flex-row items-center"
          >
            <Ionicons name="send" size={12} color="#6B7280" />
            <Text className="text-gray-500 text-xs ml-1">
              {item.totalSent} sent
            </Text>
          </TouchableOpacity>
        </View>

        {/* Actions */}
        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={() => handleEdit(item)}
            className="w-8 h-8 rounded-full bg-zinc-800 items-center justify-center"
          >
            <Feather name="edit-2" size={14} color="#FFCC00" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDelete(item)}
            disabled={deleteMutation.isPending}
            className="w-8 h-8 rounded-full bg-red-900/30 items-center justify-center"
          >
            {deleteMutation.isPending ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <Feather name="trash-2" size={14} color="#EF4444" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View className="items-center justify-center py-16">
      {isLoading ? (
        <SkeletonList count={3} variant="list" />
      ) : (
        <>
          <View className="w-20 h-20 rounded-full bg-zinc-800 items-center justify-center mb-4">
            <Ionicons name="mail-outline" size={40} color="#4B5563" />
          </View>
          <Text className="text-white text-lg font-semibold mb-2">
            No Auto-Messages Yet
          </Text>
          <Text className="text-gray-500 text-center px-8 mb-6">
            Create automated messages to engage with your customers at the right
            time.
          </Text>
          <TouchableOpacity
            onPress={handleAddNew}
            className="bg-[#FFCC00] px-6 py-3 rounded-xl flex-row items-center"
          >
            <Ionicons name="add" size={20} color="#000" />
            <Text className="text-black font-semibold ml-2">
              Create Auto-Message
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  return (
    <ThemedView className="flex-1">
      <AppHeader
        title="Auto-Messages"
        rightElement={
          autoMessages.length > 0 ? (
            <TouchableOpacity
              onPress={handleAddNew}
              className="w-10 h-10 rounded-full bg-[#FFCC00] items-center justify-center"
            >
              <Ionicons name="add" size={24} color="#000" />
            </TouchableOpacity>
          ) : undefined
        }
      />

      <FlatList
        data={autoMessages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#FFCC00"
            colors={["#FFCC00"]}
          />
        }
      />

      {/* History Modal */}
      <AutoMessageHistoryModal
        visible={!!historyModalId}
        autoMessageId={historyModalId || ""}
        onClose={() => setHistoryModalId(null)}
      />
    </ThemedView>
  );
}
