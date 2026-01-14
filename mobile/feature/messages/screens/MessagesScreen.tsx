import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppHeader } from "@/components/ui/AppHeader";
import { useFocusEffect, router } from "expo-router";
import { messageApi } from "@/services/message.services";
import { Conversation } from "@/interfaces/message.interface";
import { useAuthStore } from "@/store/auth.store";
import { formatDistanceToNow } from "date-fns";

export default function MessagesScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { userProfile } = useAuthStore();

  const fetchConversations = useCallback(async () => {
    try {
      const response = await messageApi.getConversations();
      setConversations(response.conversations || []);
    } catch (error) {
      // Silently fail - API may not be implemented yet
      setConversations([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchConversations();
    }, [fetchConversations])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchConversations();
  };

  const renderEmptyState = () => (
    <View className="flex-1 items-center justify-center py-20">
      <Ionicons name="chatbubbles-outline" size={64} color="#666" />
      <Text className="text-zinc-400 text-lg mt-4">No messages yet</Text>
      <Text className="text-zinc-600 text-sm mt-2 text-center px-8">
        When you start a conversation with a shop, it will appear here
      </Text>
    </View>
  );

  const getOtherParticipant = (conversation: Conversation) => {
    return conversation.participants.find(
      (p) => p.address !== userProfile?.address
    ) || conversation.participants[0];
  };

  const formatTimestamp = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return "";
    }
  };

  const renderConversation = ({ item }: { item: Conversation }) => {
    const otherParticipant = getOtherParticipant(item);
    const hasUnread = item.unreadCount > 0;

    return (
      <Pressable
        className="flex-row items-center px-4 py-3 border-b border-zinc-800"
        onPress={() => {
          router.push(`/customer/messages/${item.id}` as any);
        }}
      >
        <View className="w-12 h-12 rounded-full bg-zinc-800 items-center justify-center mr-3">
          <Ionicons
            name={otherParticipant?.type === "shop" ? "storefront-outline" : "person-outline"}
            size={24}
            color="#FFCC00"
          />
        </View>
        <View className="flex-1">
          <View className="flex-row justify-between items-center">
            <Text className={`text-base ${hasUnread ? "font-bold text-white" : "text-zinc-300"}`}>
              {otherParticipant?.name || "Unknown"}
            </Text>
            <Text className="text-xs text-zinc-500">
              {item.lastMessage ? formatTimestamp(item.lastMessage.createdAt) : ""}
            </Text>
          </View>
          <Text
            className={`text-sm mt-1 ${hasUnread ? "text-zinc-300" : "text-zinc-500"}`}
            numberOfLines={1}
          >
            {item.lastMessage?.content || "No messages yet"}
          </Text>
        </View>
        {hasUnread && (
          <View className="min-w-[20px] h-5 rounded-full bg-[#FFCC00] ml-2 px-1.5 items-center justify-center">
            <Text className="text-xs font-bold text-black">
              {item.unreadCount > 99 ? "99+" : item.unreadCount}
            </Text>
          </View>
        )}
      </Pressable>
    );
  };

  if (isLoading) {
    return (
      <View className="w-full h-full bg-zinc-950 items-center justify-center">
        <ActivityIndicator size="large" color="#FFCC00" />
      </View>
    );
  }

  return (
    <View className="w-full h-full bg-zinc-950">
      <AppHeader title="Messages" />

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={renderConversation}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#FFCC00"
            colors={["#FFCC00"]}
          />
        }
        contentContainerStyle={{
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
