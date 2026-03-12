import React from "react";
import { Modal, TouchableOpacity, View, Text, Image, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Conversation } from "@/shared/interfaces/message.interface";

interface ConversationInfoModalProps {
  visible: boolean;
  onClose: () => void;
  conversation: Conversation | null;
  isCustomer: boolean;
  messageCount?: number;
}

export default function ConversationInfoModal({
  visible,
  onClose,
  conversation,
  isCustomer,
  messageCount = 0,
}: ConversationInfoModalProps) {
  if (!conversation) return null;

  const otherPartyName = isCustomer
    ? conversation.shopName
    : conversation.customerName;

  const otherPartyImage = isCustomer
    ? conversation.shopImageUrl
    : conversation.customerImageUrl;

  const otherPartyType = isCustomer ? "Shop" : "Customer";

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isArchived = isCustomer
    ? conversation.isArchivedCustomer
    : conversation.isArchivedShop;

  const unreadCount = isCustomer
    ? conversation.unreadCountCustomer
    : conversation.unreadCountShop;

  const InfoRow = ({
    icon,
    label,
    value,
    valueColor,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: string;
    valueColor?: string;
  }) => (
    <View className="flex-row items-center py-3 border-b border-zinc-800">
      <View className="w-10 h-10 rounded-full bg-zinc-800 items-center justify-center mr-3">
        <Ionicons name={icon} size={18} color="#FFCC00" />
      </View>
      <View className="flex-1">
        <Text className="text-gray-400 text-xs">{label}</Text>
        <Text className={`text-base ${valueColor || "text-white"}`}>{value}</Text>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        className="flex-1 bg-black/60 justify-end"
      >
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View className="bg-zinc-900 rounded-t-3xl max-h-[80%]">
            {/* Header */}
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-zinc-800">
              <View className="flex-row items-center">
                <Ionicons name="information-circle" size={20} color="#FFCC00" />
                <Text className="text-white text-lg font-semibold ml-2">
                  Conversation Info
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} className="p-1">
                <Ionicons name="close" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <ScrollView className="px-5 py-4">
              {/* Profile Section */}
              <View className="items-center mb-6">
                {otherPartyImage ? (
                  <Image
                    source={{ uri: otherPartyImage }}
                    className="w-20 h-20 rounded-full bg-zinc-800"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="w-20 h-20 rounded-full bg-[#FFCC00] items-center justify-center">
                    <Text className="text-black text-2xl font-bold">
                      {otherPartyName?.charAt(0).toUpperCase() || "?"}
                    </Text>
                  </View>
                )}
                <Text className="text-white text-xl font-semibold mt-3">
                  {otherPartyName || "Unknown"}
                </Text>
                <Text className="text-gray-400 text-sm">{otherPartyType}</Text>
              </View>

              {/* Info Rows */}
              <View className="bg-zinc-800/50 rounded-xl px-4 mb-4">
                <InfoRow
                  icon="calendar-outline"
                  label="Started"
                  value={formatDate(conversation.createdAt)}
                />
                <InfoRow
                  icon="time-outline"
                  label="Last Message"
                  value={formatDate(conversation.lastMessageAt)}
                />
                <InfoRow
                  icon="chatbubbles-outline"
                  label="Messages"
                  value={messageCount.toString()}
                />
                <InfoRow
                  icon="mail-unread-outline"
                  label="Unread"
                  value={unreadCount.toString()}
                  valueColor={unreadCount > 0 ? "text-[#FFCC00]" : undefined}
                />
              </View>

              {/* Status Section */}
              <View className="bg-zinc-800/50 rounded-xl px-4 mb-4">
                <InfoRow
                  icon="archive-outline"
                  label="Archived"
                  value={isArchived ? "Yes" : "No"}
                  valueColor={isArchived ? "text-orange-400" : undefined}
                />
                <InfoRow
                  icon="ban-outline"
                  label="Blocked"
                  value={
                    conversation.isBlocked
                      ? `Yes (by ${conversation.blockedBy})`
                      : "No"
                  }
                  valueColor={conversation.isBlocked ? "text-red-400" : undefined}
                />
              </View>

              {/* IDs Section (for debugging/support) */}
              <View className="bg-zinc-800/50 rounded-xl px-4">
                <InfoRow
                  icon="finger-print-outline"
                  label="Conversation ID"
                  value={conversation.conversationId.slice(0, 8) + "..."}
                />
              </View>
            </ScrollView>

            {/* Close Button */}
            <View className="px-5 pb-4 pt-2">
              <TouchableOpacity
                onPress={onClose}
                className="bg-[#FFCC00] rounded-xl py-4 items-center"
              >
                <Text className="text-black font-semibold">Close</Text>
              </TouchableOpacity>
            </View>

            {/* Bottom safe area */}
            <View className="h-6" />
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
