import { useState, useCallback, useEffect, useRef } from "react";
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
import { format, isToday, isYesterday } from "date-fns";

export default function MessagesScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { userProfile, userType } = useAuthStore();

  console.log("conversationsconversations: ", conversations)

  // Determine if user is customer or shop
  const isCustomer = userType === "customer";

  const fetchConversations = useCallback(async () => {
    try {
      const response = await messageApi.getConversations();
      setConversations(response.data || []);
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

  const formatTimestamp = (dateString?: string) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      if (isToday(date)) {
        // Today: show time only (e.g., "11:02am")
        return format(date, "h:mma").toLowerCase();
      } else if (isYesterday(date)) {
        // Yesterday
        return "Yesterday";
      } else {
        // Older: show date (e.g., "Jan 14")
        return format(date, "MMM d");
      }
    } catch {
      return "";
    }
  };

  const renderConversation = ({ item }: { item: Conversation }) => {
    // Get the name of the other party in the conversation
    const otherPartyName = isCustomer ? item.shopName : item.customerName;
    // Get unread count based on user type
    const unreadCount = isCustomer ? item.unreadCountCustomer : item.unreadCountShop;
    const hasUnread = unreadCount > 0;

    return (
      <Pressable
        className="flex-row items-center px-4 py-3 border-b border-zinc-800"
        onPress={() => {
          const basePath = isCustomer ? "/customer/messages" : "/shop/messages";
          router.push(`${basePath}/${item.conversationId}` as any);
        }}
      >
        <View className="w-12 h-12 rounded-full bg-zinc-800 items-center justify-center mr-3">
          <Ionicons
            name={isCustomer ? "storefront-outline" : "person-outline"}
            size={24}
            color="#FFCC00"
          />
        </View>
        <View className="flex-1">
          <View className="flex-row justify-between items-center">
            <Text className={`text-base ${hasUnread ? "font-bold text-white" : "text-zinc-300"}`}>
              {otherPartyName || "Unknown"}
            </Text>
            <Text className="text-xs text-zinc-500">
              {formatTimestamp(item.lastMessageAt)}
            </Text>
          </View>
          <Text
            className={`text-sm mt-1 ${hasUnread ? "text-zinc-300" : "text-zinc-500"}`}
            numberOfLines={1}
          >
            {item.lastMessagePreview || "No messages yet"}
          </Text>
        </View>
        {hasUnread && (
          <View className="min-w-[20px] h-5 rounded-full bg-[#FFCC00] ml-2 px-1.5 items-center justify-center">
            <Text className="text-xs font-bold text-black">
              {unreadCount > 99 ? "99+" : unreadCount}
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
        keyExtractor={(item) => item.conversationId}
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
