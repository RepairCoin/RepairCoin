import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Message, Conversation } from "../types";
import { formatMessageTime } from "../utils";

type UnlockSession = {
  getUnlocked: (messageId: string) => { text: string | null; attachmentUrls: string[] } | undefined;
  setUnlocked: (messageId: string, data: { text: string | null; attachmentUrls: string[] }) => void;
};

type LockedMessageBubbleProps = {
  message: Message;
  isOwnMessage: boolean;
  conversation: Conversation | null;
  isCustomer: boolean;
  unlockSession?: UnlockSession;
  onRequestUnlock?: (message: Message) => void;
};

export default function LockedMessageBubble({
  message,
  isOwnMessage,
  conversation,
  isCustomer,
  unlockSession,
  onRequestUnlock,
}: LockedMessageBubbleProps) {
  const cached = unlockSession?.getUnlocked(message.messageId);

  const [isUnlocked, setIsUnlocked] = useState(!!cached);
  const [decryptedText, setDecryptedText] = useState<string | null>(cached?.text ?? null);
  const [decryptedAttachmentUrls, setDecryptedAttachmentUrls] = useState<string[]>(cached?.attachmentUrls ?? []);

  const senderInitial = isCustomer
    ? conversation?.shopName?.charAt(0).toUpperCase()
    : conversation?.customerName?.charAt(0).toUpperCase();

  const encryption = message.metadata?.encryption;
  const hint = encryption?.hint as string | undefined;

  const handleLock = () => {
    setIsUnlocked(false);
    setDecryptedText(null);
    setDecryptedAttachmentUrls([]);
  };

  // Called from ChatScreen after successful unlock
  // Check session cache on each render in case it was unlocked via modal
  if (!isUnlocked && cached) {
    // Session was populated by the modal — sync local state
    setIsUnlocked(true);
    setDecryptedText(cached.text);
    setDecryptedAttachmentUrls(cached.attachmentUrls);
  }

  // Unlocked view
  if (isUnlocked && decryptedText !== null) {
    return (
      <View className={`flex-row mb-2 px-4 ${isOwnMessage ? "justify-end" : "justify-start"}`}>
        {!isOwnMessage && (
          <View className="w-8 h-8 rounded-full bg-zinc-700 items-center justify-center mr-2">
            <Text className="text-white text-xs font-bold">{senderInitial || "?"}</Text>
          </View>
        )}

        <View className={`max-w-[70%] ${isOwnMessage ? "items-end" : "items-start"}`}>
          <View
            className={`rounded-2xl px-4 py-2 border ${
              isOwnMessage
                ? "bg-amber-500/20 border-amber-500/30"
                : "bg-zinc-800 border-amber-500/30"
            }`}
          >
            <Pressable onPress={handleLock} className="flex-row items-center mb-1">
              <Ionicons name="lock-open" size={10} color="#F59E0B" />
              <Text className="text-amber-500 text-[10px] ml-1">UNLOCKED</Text>
              <Text className="text-zinc-500 text-[10px] ml-1">(tap to re-lock)</Text>
            </Pressable>

            {decryptedAttachmentUrls.length > 0 && (
              <View className="mb-2">
                {decryptedAttachmentUrls.map((url, idx) => (
                  <View key={idx} className="mb-1">
                    {message.attachments[idx]?.type === "image" && url ? (
                      <Image
                        source={{ uri: url }}
                        className="w-48 h-48 rounded-lg"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="flex-row items-center p-2 rounded-lg bg-zinc-700">
                        <Ionicons name="document-outline" size={16} color="#fff" />
                        <Text className="ml-2 text-xs text-white" numberOfLines={1}>
                          {message.attachments[idx]?.name || "File"}
                        </Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {decryptedText && (
              <Text className="text-sm text-white">{decryptedText}</Text>
            )}
          </View>

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

  // Locked view
  return (
    <View className={`flex-row mb-2 px-4 ${isOwnMessage ? "justify-end" : "justify-start"}`}>
      {!isOwnMessage && (
        <View className="w-8 h-8 rounded-full bg-zinc-700 items-center justify-center mr-2">
          <Text className="text-white text-xs font-bold">{senderInitial || "?"}</Text>
        </View>
      )}

      <View className={`max-w-[70%] ${isOwnMessage ? "items-end" : "items-start"}`}>
        <Pressable
          onPress={() => onRequestUnlock?.(message)}
          className={`rounded-2xl px-4 py-3 border ${
            isOwnMessage
              ? "bg-amber-500/10 border-amber-500/30"
              : "bg-zinc-800 border-amber-500/30"
          }`}
        >
          <View className="items-center py-2">
            <View className="w-10 h-10 rounded-full bg-amber-500/20 items-center justify-center mb-2">
              <Ionicons name="lock-closed" size={20} color="#F59E0B" />
            </View>
            <Text className="text-amber-500 text-xs font-semibold">Locked Message</Text>
            {hint ? (
              <Text className="text-zinc-400 text-[10px] mt-1">Hint: {hint}</Text>
            ) : null}
            <Text className="text-zinc-500 text-[10px] mt-1">Tap to unlock</Text>
          </View>
        </Pressable>

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
