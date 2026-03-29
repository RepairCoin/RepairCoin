import { useState, useCallback, useRef, useEffect } from "react";
import { FlatList } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useFocusEffect } from "expo-router";
import { messageApi } from "@/feature/messages/services/message.services";
import { useAuthStore } from "@/shared/store/auth.store";
import { Message, Conversation, MessageAttachment } from "../../types";
import { MESSAGE_POLL_INTERVAL } from "../../constants";
import { AttachmentFile } from "../../components/MessageInput";
import { encryptMessage } from "../../utils/encryption";

export function useChat() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [messageText, setMessageText] = useState("");
  const flatListRef = useRef<FlatList>(null);
  const { userType } = useAuthStore();

  const isCustomer = userType === "customer";

  const hasMarkedRead = useRef(false);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;

    try {
      const response = await messageApi.getMessages(conversationId);
      setMessages(response.data || []);

      // Only mark as read once on first load, not every poll
      if (!hasMarkedRead.current) {
        hasMarkedRead.current = true;
        await messageApi.markConversationAsRead(conversationId);
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  const fetchConversation = useCallback(async () => {
    if (!conversationId) return;

    try {
      const conv = await messageApi.getConversation(conversationId);
      if (conv) {
        setConversation(conv);
      }
    } catch (error) {
      console.error("Failed to fetch conversation:", error);
    }
  }, [conversationId]);

  useFocusEffect(
    useCallback(() => {
      hasMarkedRead.current = false;
      fetchConversation();
      fetchMessages();
    }, [fetchConversation, fetchMessages])
  );

  // Poll for new messages
  useEffect(() => {
    if (!conversationId) return;

    const interval = setInterval(() => {
      fetchMessages();
    }, MESSAGE_POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [conversationId, fetchMessages]);

  const handleSend = async (attachmentFiles?: AttachmentFile[], isLocked?: boolean, password?: string, hint?: string) => {
    const hasText = messageText.trim().length > 0;
    const hasAttachments = attachmentFiles && attachmentFiles.length > 0;

    if ((!hasText && !hasAttachments) || !conversationId || isSending) return;

    const text = messageText.trim();
    setMessageText("");
    setIsSending(true);

    try {
      let uploadedAttachments: MessageAttachment[] = [];

      // Upload attachments first if any
      if (hasAttachments) {
        const uploadResponse = await messageApi.uploadAttachments(attachmentFiles);
        if (uploadResponse.success && uploadResponse.data) {
          uploadedAttachments = uploadResponse.data.map((att) => ({
            type: att.type,
            url: att.url,
            name: att.name,
            mimeType: att.mimetype,
            size: att.size,
          }));
        }
      }

      // Encrypt if locked
      let finalText = text || "";
      let finalAttachments = uploadedAttachments;
      let metadata: Record<string, any> = {};

      if (isLocked && password) {
        // Encrypt message text
        if (finalText) {
          const encrypted = encryptMessage(finalText, password);
          finalText = encrypted.ciphertext;
          metadata.encryption = {
            algorithm: encrypted.algorithm,
            ...(hint && { hint }),
          };
        }

        // Encrypt attachment URLs
        if (uploadedAttachments.length > 0) {
          finalAttachments = uploadedAttachments.map((att) => {
            const encUrl = encryptMessage(att.url, password);
            return { ...att, url: encUrl.ciphertext };
          });
          metadata.encryption = {
            ...metadata.encryption,
            encryptedAttachments: true,
          };
        }
      }

      // Send message
      const response = await messageApi.sendMessage({
        conversationId,
        messageText: finalText,
        messageType: isLocked ? "encrypted" : "text",
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        attachments: finalAttachments.length > 0 ? finalAttachments : undefined,
        isEncrypted: isLocked || false,
      });

      if (response.data) {
        setMessages((prev) => [...prev, response.data]);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      setMessageText(text);
    } finally {
      setIsSending(false);
    }
  };

  const handleGoBack = () => {
    router.back();
  };

  const scrollToEnd = () => {
    flatListRef.current?.scrollToEnd({ animated: false });
  };

  const otherPartyName = isCustomer ? conversation?.shopName : conversation?.customerName;

  return {
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
    refetchConversation: fetchConversation,
  };
}
