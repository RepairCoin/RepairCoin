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
import { useFocusEffect } from "expo-router";

interface Conversation {
  id: string;
  shopName: string;
  lastMessage: string;
  timestamp: string;
  unread: boolean;
}

export default function MessagesScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchConversations = useCallback(async () => {
    try {
      // TODO: Replace with actual API call
      // const response = await messagesApi.getConversations();
      // setConversations(response.conversations);
      setConversations([]);
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
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

  const renderConversation = ({ item }: { item: Conversation }) => (
    <Pressable
      className="flex-row items-center px-4 py-3 border-b border-zinc-800"
      onPress={() => {
        // TODO: Navigate to chat screen
        // router.push(`/customer/messages/${item.id}`);
      }}
    >
      <View className="w-12 h-12 rounded-full bg-zinc-800 items-center justify-center mr-3">
        <Ionicons name="storefront-outline" size={24} color="#FFCC00" />
      </View>
      <View className="flex-1">
        <View className="flex-row justify-between items-center">
          <Text className={`text-base ${item.unread ? "font-bold text-white" : "text-zinc-300"}`}>
            {item.shopName}
          </Text>
          <Text className="text-xs text-zinc-500">{item.timestamp}</Text>
        </View>
        <Text
          className={`text-sm mt-1 ${item.unread ? "text-zinc-300" : "text-zinc-500"}`}
          numberOfLines={1}
        >
          {item.lastMessage}
        </Text>
      </View>
      {item.unread && (
        <View className="w-3 h-3 rounded-full bg-[#FFCC00] ml-2" />
      )}
    </Pressable>
  );

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
