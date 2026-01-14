import { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import { useFocusEffect } from "expo-router";
import { messageApi } from "@/services/message.services";
import { Message, Conversation } from "@/interfaces/message.interface";
import { useAuthStore } from "@/store/auth.store";
import { format, isToday, isYesterday } from "date-fns";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [messageText, setMessageText] = useState("");
  const flatListRef = useRef<FlatList>(null);
  const { userProfile, userType } = useAuthStore();

  const isCustomer = userType === "customer";

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;

    try {
      const response = await messageApi.getMessages(conversationId);
      setMessages(response.data || []);

      // Mark conversation as read
      await messageApi.markConversationAsRead(conversationId);
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  const fetchConversation = useCallback(async () => {
    if (!conversationId) return;

    try {
      // Get conversations and find the current one
      const response = await messageApi.getConversations();
      const conv = response.data?.find((c) => c.conversationId === conversationId);
      if (conv) {
        setConversation(conv);
      }
    } catch (error) {
      console.error("Failed to fetch conversation:", error);
    }
  }, [conversationId]);

  useFocusEffect(
    useCallback(() => {
      fetchConversation();
      fetchMessages();
    }, [fetchConversation, fetchMessages])
  );

  // Poll for new messages every 5 seconds
  useEffect(() => {
    if (!conversationId) return;

    const interval = setInterval(() => {
      fetchMessages();
    }, 5000);

    return () => clearInterval(interval);
  }, [conversationId, fetchMessages]);

  const handleSend = async () => {
    if (!messageText.trim() || !conversationId || isSending) return;

    const text = messageText.trim();
    setMessageText("");
    setIsSending(true);

    try {
      const response = await messageApi.sendMessage({
        conversationId,
        messageText: text,
        messageType: "text",
      });

      // Add the new message to the list
      if (response.data) {
        setMessages((prev) => [...prev, response.data]);
        // Scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      // Restore the message text on error
      setMessageText(text);
    } finally {
      setIsSending(false);
    }
  };

  const formatMessageTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "h:mm a");
    } catch {
      return "";
    }
  };

  const formatDateDivider = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isToday(date)) return "Today";
      if (isYesterday(date)) return "Yesterday";
      return format(date, "MMM d, yyyy");
    } catch {
      return "";
    }
  };

  const shouldShowDateDivider = (currentMessage: Message, previousMessage?: Message) => {
    if (!previousMessage) return true;

    const currentDate = new Date(currentMessage.createdAt).toDateString();
    const previousDate = new Date(previousMessage.createdAt).toDateString();

    return currentDate !== previousDate;
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const previousMessage = index > 0 ? messages[index - 1] : undefined;
    const showDateDivider = shouldShowDateDivider(item, previousMessage);
    const isOwnMessage = item.senderType === (isCustomer ? "customer" : "shop");
    const isSystemMessage = item.messageType === "system";

    return (
      <View>
        {/* Date Divider */}
        {showDateDivider && (
          <View className="items-center my-4">
            <View className="bg-zinc-800 px-3 py-1 rounded-full">
              <Text className="text-xs text-zinc-400">
                {formatDateDivider(item.createdAt)}
              </Text>
            </View>
          </View>
        )}

        {/* System Message */}
        {isSystemMessage ? (
          <View className="items-center my-2">
            <View className="bg-zinc-800 px-4 py-2 rounded-lg max-w-[80%]">
              <Text className="text-xs text-zinc-400 text-center">
                {item.messageText}
              </Text>
            </View>
          </View>
        ) : (
          /* Regular Message */
          <View className={`flex-row mb-2 px-4 ${isOwnMessage ? "justify-end" : "justify-start"}`}>
            {/* Avatar for received messages */}
            {!isOwnMessage && (
              <View className="w-8 h-8 rounded-full bg-zinc-700 items-center justify-center mr-2">
                <Text className="text-white text-xs font-bold">
                  {(isCustomer ? conversation?.shopName : conversation?.customerName)?.charAt(0).toUpperCase() || "?"}
                </Text>
              </View>
            )}

            <View className={`max-w-[70%] ${isOwnMessage ? "items-end" : "items-start"}`}>
              {/* Message Bubble */}
              <View
                className={`rounded-2xl px-4 py-2 ${
                  isOwnMessage
                    ? "bg-[#FFCC00]"
                    : "bg-zinc-800 border border-zinc-700"
                }`}
              >
                {/* Service Link Card */}
                {item.messageType === "service_link" && item.metadata && (
                  <View className="mb-2">
                    <View
                      className={`rounded-lg overflow-hidden border ${
                        isOwnMessage
                          ? "border-black/20 bg-black/10"
                          : "border-zinc-700 bg-zinc-900"
                      }`}
                    >
                      {/* Service Image */}
                      {item.metadata.serviceImage && (
                        <Image
                          source={{ uri: item.metadata.serviceImage }}
                          className="w-full h-24"
                          resizeMode="cover"
                        />
                      )}
                      {/* Service Details */}
                      <View className="p-2">
                        <Text
                          className={`font-semibold text-sm mb-1 ${
                            isOwnMessage ? "text-black" : "text-white"
                          }`}
                          numberOfLines={1}
                        >
                          {item.metadata.serviceName}
                        </Text>
                        <View className="flex-row items-center justify-between">
                          <Text
                            className={`text-xs ${
                              isOwnMessage ? "text-black/70" : "text-zinc-400"
                            }`}
                          >
                            {item.metadata.serviceCategory}
                          </Text>
                          <Text
                            className={`text-sm font-bold ${
                              isOwnMessage ? "text-black" : "text-[#FFCC00]"
                            }`}
                          >
                            ${item.metadata.servicePrice}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                )}

                {/* Attachments */}
                {item.attachments && item.attachments.length > 0 && (
                  <View className="mb-2">
                    {item.attachments.map((attachment, idx) => (
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
                              className={`ml-2 text-xs ${
                                isOwnMessage ? "text-black" : "text-white"
                              }`}
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
                {item.messageText && (
                  <Text
                    className={`text-sm ${isOwnMessage ? "text-black" : "text-white"}`}
                  >
                    {item.messageText}
                  </Text>
                )}
              </View>

              {/* Timestamp */}
              <View className="flex-row items-center mt-1">
                <Text className="text-xs text-zinc-500">
                  {formatMessageTime(item.createdAt)}
                </Text>
                {isOwnMessage && (
                  <Ionicons
                    name={item.isRead ? "checkmark-done" : "checkmark"}
                    size={14}
                    color={item.isRead ? "#3B82F6" : "#71717A"}
                    style={{ marginLeft: 4 }}
                  />
                )}
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  const otherPartyName = isCustomer ? conversation?.shopName : conversation?.customerName;

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-zinc-950">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FFCC00" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-zinc-950" edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View className="flex-row items-center px-4 py-3 border-b border-zinc-800 bg-zinc-900">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center mr-2"
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </Pressable>

          <View className="w-10 h-10 rounded-full bg-[#FFCC00] items-center justify-center mr-3">
            <Text className="text-black font-bold">
              {otherPartyName?.charAt(0).toUpperCase() || "?"}
            </Text>
          </View>

          <View className="flex-1">
            <Text className="text-white font-semibold">
              {otherPartyName || "Conversation"}
            </Text>
            <Text className="text-zinc-400 text-xs">
              {isCustomer ? "Shop" : "Customer"}
            </Text>
          </View>

          <Pressable className="w-10 h-10 items-center justify-center">
            <Ionicons name="ellipsis-vertical" size={20} color="white" />
          </Pressable>
        </View>

        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.messageId}
          renderItem={renderMessage}
          contentContainerStyle={{
            flexGrow: 1,
            paddingVertical: 16,
          }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-20">
              <Ionicons name="chatbubble-outline" size={48} color="#666" />
              <Text className="text-zinc-400 mt-4">No messages yet</Text>
              <Text className="text-zinc-600 text-sm mt-1">
                Start the conversation!
              </Text>
            </View>
          }
        />

        {/* Input Area */}
        <View className="px-4 py-4 border-t border-zinc-800 bg-zinc-900">
          <View className="flex-row items-center">
            <View className="flex-1 h-12 bg-zinc-800 rounded-full px-4 mr-2 border border-zinc-700 justify-center">
              <TextInput
                value={messageText}
                onChangeText={setMessageText}
                placeholder="Type a message..."
                placeholderTextColor="#71717A"
                className="text-white text-sm"
                editable={!isSending}
              />
            </View>

            <Pressable
              onPress={handleSend}
              disabled={!messageText.trim() || isSending}
              className={`w-12 h-12 rounded-full items-center justify-center ${
                messageText.trim() && !isSending
                  ? "bg-[#FFCC00]"
                  : "bg-zinc-800"
              }`}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Ionicons
                  name="send"
                  size={20}
                  color={messageText.trim() ? "#000" : "#71717A"}
                />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
