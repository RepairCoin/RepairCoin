import { useState, useCallback } from "react";
import { View, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, Pressable, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useChat, useConversationPresence } from "../hooks";
import { useUnlockSession } from "../hooks/useUnlockSession";
import { useAppToast } from "@/shared/hooks";
import { useEndBootWhenReady } from "@/shared/hooks/useEndBootWhenReady";
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
import UnlockModal from "../components/UnlockModal";
import { Message } from "../types";
import { messageApi } from "../services/message.services";

export default function ChatScreen() {
  const {
    conversationId,
    messages,
    conversation,
    isLoading,
    isLoadingMore,
    hasMore,
    isSending,
    messageText,
    setMessageText,
    flatListRef,
    isCustomer,
    otherPartyName,
    handleSend,
    handleGoBack,
    loadMore,
    refetchConversation,
    removeMessage,
  } = useChat();

  // Tell the backend we're viewing this thread (over the shared WebSocket) so it
  // suppresses push + email notifications for messages that land while we're
  // looking. Mirrors the web chat's conversation:open/close presence signals.
  useConversationPresence(conversationId);

  // Lift the cold-start boot splash once the conversation has loaded — this is
  // the screen a "new_message" push deep-links to.
  useEndBootWhenReady(!isLoading);

  const { showSuccess, showError } = useAppToast();
  const unlockSession = useUnlockSession();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [unlockMessage, setUnlockMessage] = useState<Message | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<Message | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [, forceUpdate] = useState(0);

  const handleTextChange = useCallback(
    (text: string) => {
      setMessageText(text);
    },
    [setMessageText]
  );

  const handleConfirmDelete = async () => {
    if (!deleteMessage) return;
    setIsDeleting(true);
    try {
      await messageApi.deleteMessage(deleteMessage.messageId);
      removeMessage(deleteMessage.messageId);
      showSuccess("Message deleted.");
    } catch {
      showError("Failed to delete message. Please try again.");
    } finally {
      setIsDeleting(false);
      setDeleteMessage(null);
    }
  };

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
    // Inverted list: the chronologically earlier message is the next index. Show
    // a date divider above the first (oldest) message of each day.
    const previousMessage = messages[index + 1];
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
            onRequestUnlock={(msg) => setUnlockMessage(msg)}
            onLongPress={(msg) => setDeleteMessage(msg)}
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
          // Inverted so newest messages sit at the bottom and the view opens
          // pinned there — no manual scroll-to-end. Data is newest-first.
          // Skipped when empty so EmptyChat isn't rendered upside down.
          inverted={messages.length > 0}
          data={messages}
          keyExtractor={(item) => item.messageId}
          renderItem={renderMessage}
          contentContainerStyle={{
            flexGrow: 1,
            paddingVertical: 16,
          }}
          showsVerticalScrollIndicator={false}
          // On an inverted list onEndReached fires at the TOP — load older
          // messages. loadMore self-guards against overlap.
          onEndReached={hasMore ? loadMore : undefined}
          onEndReachedThreshold={0.3}
          // Footer renders at the top of an inverted list — the older-messages
          // loading spinner.
          ListFooterComponent={
            isLoadingMore ? (
              <View className="py-3 items-center">
                <ActivityIndicator size="small" color="#FFCC00" />
              </View>
            ) : null
          }
          ListEmptyComponent={EmptyChat}
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

      {/* Delete Message Modal */}
      <Modal
        visible={!!deleteMessage}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setDeleteMessage(null)}
      >
        <Pressable
          className="flex-1 bg-black/70 justify-center px-6"
          onPress={() => setDeleteMessage(null)}
        >
          <Pressable
            onPress={() => {}}
            className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800"
          >
            <Text className="text-white text-lg font-bold mb-1">Delete message?</Text>
            <Text className="text-zinc-400 text-sm mb-6">
              This message and its attachments will be permanently removed.
            </Text>
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setDeleteMessage(null)}
                className="flex-1 py-3 rounded-xl bg-zinc-800 items-center"
              >
                <Text className="text-zinc-300 font-semibold">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmDelete}
                disabled={isDeleting}
                className={`flex-1 py-3 rounded-xl items-center ${isDeleting ? "bg-red-900" : "bg-red-500"}`}
              >
                <Text className="text-white font-semibold">
                  {isDeleting ? "Deleting..." : "Delete"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Unlock Message Modal — outside KeyboardAvoidingView */}
      <UnlockModal
        visible={!!unlockMessage}
        message={unlockMessage}
        unlockSession={unlockSession}
        onClose={() => setUnlockMessage(null)}
        onUnlocked={() => forceUpdate((n) => n + 1)}
      />
    </SafeAreaView>
  );
}
