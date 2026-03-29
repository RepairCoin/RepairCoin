import { View, Text, Pressable, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Conversation } from "../types";
import { formatTimestamp } from "../utils";

type ConversationItemProps = {
  conversation: Conversation;
  isCustomer: boolean;
  onPress: () => void;
};

export default function ConversationItem({
  conversation,
  isCustomer,
  onPress,
}: ConversationItemProps) {
  const otherPartyName = isCustomer ? conversation.shopName : conversation.customerName;
  const unreadCount = isCustomer
    ? conversation.unreadCountCustomer
    : conversation.unreadCountShop;
  const hasUnread = unreadCount > 0;
  const isResolved = conversation.status === "resolved";

  return (
    <Pressable
      className="flex-row items-center px-4 py-3 border-b border-zinc-800"
      onPress={onPress}
    >
      {isCustomer && conversation.shopImageUrl ? (
        <Image
          source={{ uri: conversation.shopImageUrl }}
          className="w-12 h-12 rounded-full mr-3 bg-zinc-800"
          resizeMode="cover"
        />
      ) : !isCustomer && conversation.customerImageUrl ? (
        <Image
          source={{ uri: conversation.customerImageUrl }}
          className="w-12 h-12 rounded-full mr-3 bg-zinc-800"
          resizeMode="cover"
        />
      ) : (
        <View className="w-12 h-12 rounded-full bg-zinc-800 items-center justify-center mr-3">
          <Ionicons
            name={isCustomer ? "storefront-outline" : "person-outline"}
            size={24}
            color="#FFCC00"
          />
        </View>
      )}
      <View className="flex-1">
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center flex-1 mr-2">
            <Text
              className={`text-base ${hasUnread ? "font-bold text-white" : "text-zinc-300"}`}
              numberOfLines={1}
            >
              {otherPartyName || "Unknown"}
            </Text>
            {isResolved && (
              <View className="bg-green-500/20 px-2 py-0.5 rounded ml-2">
                <Text className="text-green-500 text-xs font-medium">Resolved</Text>
              </View>
            )}
          </View>
          <Text className="text-xs text-zinc-500">
            {formatTimestamp(conversation.lastMessageAt)}
          </Text>
        </View>
        {conversation.lastMessagePreview?.includes("Locked message") ? (
          <View className="flex-row items-center mt-1">
            <Ionicons name="lock-closed" size={12} color="#F59E0B" />
            <Text className="text-amber-500 text-sm ml-1">Locked message</Text>
          </View>
        ) : (
          <Text
            className={`text-sm mt-1 ${hasUnread ? "text-zinc-300" : "text-zinc-500"}`}
            numberOfLines={1}
          >
            {conversation.lastMessagePreview || "No messages yet"}
          </Text>
        )}
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
}
