import { useState, useCallback } from "react";
import { View, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useChat } from "../hooks";
import { useUnlockSession } from "../hooks/useUnlockSession";
import { useAppToast } from "@/shared/hooks";
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
    refetchConversation,
  } = useChat();

  const { showSuccess, showError } = useAppToast();
  const unlockSession = useUnlockSession();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const handleTextChange = useCallback(
    (text: string) => {
      setMessageText(text);
    },
    [setMessageText]
  );

  const handleArchive = async () => {
    if (!conversation) return;
    try {
      const isArchived = isCustomer
        ? conversation.isArchivedCustomer
        : conversation.isArchivedShop;

      if (isArchived) {
        await messageApi.unarchiveConversation(conversation.conversationId);
        showSuccess("Conversation unarchived");
        handleGoBack();
      } else {
        await messageApi.archiveConversation(conversation.conversationId);
        showSuccess("Conversation archived");
        handleGoBack();
      }
    } catch (error) {
      showError("Failed to update conversation");
    }
  };

  const handleBlock = async () => {
    if (!conversation) return;
    try {
      const blockedByMe = conversation.blockedBy === (isCustomer ? "customer" : "shop");

      if (conversation.isBlocked && blockedByMe) {
        await messageApi.unblockConversation(conversation.conversationId);
        await refetchConversation();
        showSuccess("User unblocked");
      } else {
        await messageApi.blockConversation(conversation.conversationId);
        await refetchConversation();
        showSuccess("User blocked");
      }
    } catch (error) {
      showError("Failed to update block status");
    }
  };

  const handleDelete = async () => {
    if (!conversation) return;
    try {
      await messageApi.deleteConversation(conversation.conversationId);
      showSuccess("Conversation deleted");
      handleGoBack();
    } catch (error) {
      showError("Failed to delete conversation");
    }
  };

  const handleResolve = async () => {
    if (!conversation) return;
    try {
      const isResolved = conversation.status === "resolved";
      if (isResolved) {
        await messageApi.reopenConversation(conversation.conversationId);
        await refetchConversation();
        showSuccess("Conversation reopened");
      } else {
        await messageApi.resolveConversation(conversation.conversationId);
        await refetchConversation();
        showSuccess("Conversation marked as resolved");
      }
    } catch (error) {
      showError("Failed to update conversation status");
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
            unlockSession={unlockSession}
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
          isResolved={conversation?.status === "resolved"}
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
          ListFooterComponent={null}
        />

        <MessageInput
          value={messageText}
          onChangeText={handleTextChange}
          onSend={handleSend}
          isSending={isSending}
          disabled={conversation?.isBlocked}
          disabledMessage={
            conversation?.isBlocked
              ? conversation.blockedBy === (isCustomer ? "customer" : "shop")
                ? "You blocked this conversation. Unblock to send messages."
                : "This conversation has been blocked."
              : undefined
          }
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
        onResolve={handleResolve}
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
