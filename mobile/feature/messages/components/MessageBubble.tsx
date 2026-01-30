import { View, Text, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Message, Conversation } from "../types";
import { formatMessageTime } from "../utils";

type MessageBubbleProps = {
  message: Message;
  isOwnMessage: boolean;
  conversation: Conversation | null;
  isCustomer: boolean;
};

export default function MessageBubble({
  message,
  isOwnMessage,
  conversation,
  isCustomer,
}: MessageBubbleProps) {
  const senderInitial = isCustomer
    ? conversation?.shopName?.charAt(0).toUpperCase()
    : conversation?.customerName?.charAt(0).toUpperCase();

  return (
    <View className={`flex-row mb-2 px-4 ${isOwnMessage ? "justify-end" : "justify-start"}`}>
      {/* Avatar for received messages */}
      {!isOwnMessage && (
        <View className="w-8 h-8 rounded-full bg-zinc-700 items-center justify-center mr-2">
          <Text className="text-white text-xs font-bold">{senderInitial || "?"}</Text>
        </View>
      )}

      <View className={`max-w-[70%] ${isOwnMessage ? "items-end" : "items-start"}`}>
        {/* Message Bubble */}
        <View
          className={`rounded-2xl px-4 py-2 ${
            isOwnMessage ? "bg-[#FFCC00]" : "bg-zinc-800 border border-zinc-700"
          }`}
        >
          {/* Service Link Card */}
          {message.messageType === "service_link" && message.metadata && (
            <View className="mb-2">
              <View
                className={`rounded-lg overflow-hidden border ${
                  isOwnMessage ? "border-black/20 bg-black/10" : "border-zinc-700 bg-zinc-900"
                }`}
              >
                {message.metadata.serviceImage && (
                  <Image
                    source={{ uri: message.metadata.serviceImage }}
                    className="w-full h-24"
                    resizeMode="cover"
                  />
                )}
                <View className="p-2">
                  <Text
                    className={`font-semibold text-sm mb-1 ${
                      isOwnMessage ? "text-black" : "text-white"
                    }`}
                    numberOfLines={1}
                  >
                    {message.metadata.serviceName}
                  </Text>
                  <View className="flex-row items-center justify-between">
                    <Text
                      className={`text-xs ${isOwnMessage ? "text-black/70" : "text-zinc-400"}`}
                    >
                      {message.metadata.serviceCategory}
                    </Text>
                    <Text
                      className={`text-sm font-bold ${
                        isOwnMessage ? "text-black" : "text-[#FFCC00]"
                      }`}
                    >
                      ${message.metadata.servicePrice}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <View className="mb-2">
              {message.attachments.map((attachment, idx) => (
                <View key={idx} className="mb-1">
                  {attachment.type === "image" ? (
                    <Image
                      source={{ uri: attachment.url }}
                      className="w-48 h-48 rounded-lg"
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      className={`flex-row items-center p-2 rounded-lg ${
                        isOwnMessage ? "bg-black/10" : "bg-zinc-700"
                      }`}
                    >
                      <Ionicons
                        name="document-outline"
                        size={16}
                        color={isOwnMessage ? "#000" : "#fff"}
                      />
                      <Text
                        className={`ml-2 text-xs ${isOwnMessage ? "text-black" : "text-white"}`}
                        numberOfLines={1}
                      >
                        {attachment.name}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Message Text */}
          {message.messageText && (
            <Text className={`text-sm ${isOwnMessage ? "text-black" : "text-white"}`}>
              {message.messageText}
            </Text>
          )}
        </View>

        {/* Timestamp */}
        <View className="flex-row items-center mt-1">
          <Text className="text-xs text-zinc-500">{formatMessageTime(message.createdAt)}</Text>
          {isOwnMessage && (
            <Ionicons
              name={message.isRead ? "checkmark-done" : "checkmark"}
              size={14}
              color={message.isRead ? "#3B82F6" : "#71717A"}
              style={{ marginLeft: 4 }}
            />
          )}
        </View>
      </View>
    </View>
  );
}
