import { useState } from "react";
import { View, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useChat } from "../hooks";
import {
  ChatHeader,
  DateDivider,
  SystemMessage,
  MessageBubble,
  MessageInput,
  EmptyChat,
  ConversationMoreMenu,
  ConversationInfoModal,
} from "../components";
import { Message } from "../types";
import { messageApi } from "../services/message.services";

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

  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const handleArchive = async () => {
    if (!conversation) return;
    try {
      const isArchived = isCustomer
        ? conversation.isArchivedCustomer
        : conversation.isArchivedShop;

      if (isArchived) {
        await messageApi.unarchiveConversation(conversation.conversationId);
        Alert.alert("Success", "Conversation unarchived");
      } else {
        await messageApi.archiveConversation(conversation.conversationId);
        Alert.alert("Success", "Conversation archived");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to update conversation");
    }
  };

  const handleBlock = async () => {
    if (!conversation) return;
    try {
      const blockedByMe = conversation.blockedBy === (isCustomer ? "customer" : "shop");

      if (conversation.isBlocked && blockedByMe) {
        await messageApi.unblockConversation(conversation.conversationId);
        Alert.alert("Success", "User unblocked");
      } else {
        await messageApi.blockConversation(conversation.conversationId);
        Alert.alert("Success", "User blocked");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to update block status");
    }
  };

  const handleDelete = async () => {
    if (!conversation) return;
    try {
      await messageApi.deleteConversation(conversation.conversationId);
      Alert.alert("Success", "Conversation deleted", [
        { text: "OK", onPress: handleGoBack },
      ]);
    } catch (error) {
      Alert.alert("Error", "Failed to delete conversation");
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
          onMorePress={() => setShowMoreMenu(true)}
          shopImageUrl={conversation?.shopImageUrl}
          shopId={conversation?.shopId}
          customerImageUrl={conversation?.customerImageUrl}
          customerAddress={conversation?.customerAddress}
          isCustomer={isCustomer}
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

      {/* More Options Menu */}
      <ConversationMoreMenu
        visible={showMoreMenu}
        onClose={() => setShowMoreMenu(false)}
        conversation={conversation}
        isCustomer={isCustomer}
        onViewInfo={() => setShowInfoModal(true)}
        onArchive={handleArchive}
        onBlock={handleBlock}
        onDelete={handleDelete}
      />

      {/* Conversation Info Modal */}
      <ConversationInfoModal
        visible={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        conversation={conversation}
        isCustomer={isCustomer}
        messageCount={messages.length}
      />
    </SafeAreaView>
  );
}
