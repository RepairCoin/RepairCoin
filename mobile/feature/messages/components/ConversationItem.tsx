import { View, Text, Pressable } from "react-native";
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

  return (
    <Pressable
      className="flex-row items-center px-4 py-3 border-b border-zinc-800"
      onPress={onPress}
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
          <Text
            className={`text-base ${hasUnread ? "font-bold text-white" : "text-zinc-300"}`}
          >
            {otherPartyName || "Unknown"}
          </Text>
          <Text className="text-xs text-zinc-500">
            {formatTimestamp(conversation.lastMessageAt)}
          </Text>
        </View>
        <Text
          className={`text-sm mt-1 ${hasUnread ? "text-zinc-300" : "text-zinc-500"}`}
          numberOfLines={1}
        >
          {conversation.lastMessagePreview || "No messages yet"}
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
}
