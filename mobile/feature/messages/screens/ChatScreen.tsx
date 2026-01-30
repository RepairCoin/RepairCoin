import { View, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useChat } from "../hooks";
import {
  ChatHeader,
  DateDivider,
  SystemMessage,
  MessageBubble,
  MessageInput,
  EmptyChat,
} from "../components";
import { Message } from "../types";

export default function ChatScreen() {
  const {
    messages,
    conversation,
    isLoading,
    isSending,
    messageText,
    setMessageText,
    flatListRef,
    isCustomer,
    otherPartyName,
    handleSend,
    handleGoBack,
    scrollToEnd,
  } = useChat();

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
        {showDateDivider && <DateDivider dateString={item.createdAt} />}

        {isSystemMessage ? (
          <SystemMessage text={item.messageText} />
        ) : (
          <MessageBubble
            message={item}
            isOwnMessage={isOwnMessage}
            conversation={conversation}
            isCustomer={isCustomer}
          />
        )}
      </View>
    );
  };

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
        <ChatHeader
          name={otherPartyName}
          subtitle={isCustomer ? "Shop" : "Customer"}
          onBack={handleGoBack}
        />

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
          onContentSizeChange={scrollToEnd}
          ListEmptyComponent={EmptyChat}
        />

        <MessageInput
          value={messageText}
          onChangeText={setMessageText}
          onSend={handleSend}
          isSending={isSending}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
