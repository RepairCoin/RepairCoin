import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  Image,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Message, Conversation } from "../types";
import { formatMessageTime } from "../utils";
import { decryptMessage } from "../utils/encryption";

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
};

export default function LockedMessageBubble({
  message,
  isOwnMessage,
  conversation,
  isCustomer,
  unlockSession,
}: LockedMessageBubbleProps) {
  // Check session cache first
  const cached = unlockSession?.getUnlocked(message.messageId);

  const [isUnlocked, setIsUnlocked] = useState(!!cached);
  const [decryptedText, setDecryptedText] = useState<string | null>(cached?.text ?? null);
  const [decryptedAttachmentUrls, setDecryptedAttachmentUrls] = useState<string[]>(cached?.attachmentUrls ?? []);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const senderInitial = isCustomer
    ? conversation?.shopName?.charAt(0).toUpperCase()
    : conversation?.customerName?.charAt(0).toUpperCase();

  const encryption = message.metadata?.encryption;
  const hint = encryption?.hint as string | undefined;

  const handleUnlock = () => {
    if (!password) return;

    setError("");

    let text: string | null = null;
    let urls: string[] = [];

    // Decrypt text if present
    if (message.messageText) {
      const result = decryptMessage(message.messageText, password);
      if (result === null) {
        setError("Incorrect password");
        return;
      }
      text = result;
    } else {
      text = "";
    }

    // Decrypt attachment URLs if present
    if (encryption?.encryptedAttachments && message.attachments?.length) {
      for (let i = 0; i < message.attachments.length; i++) {
        const decUrl = decryptMessage(message.attachments[i].url, password);
        if (decUrl === null) {
          setError("Incorrect password");
          return;
        }
        urls.push(decUrl);
      }
    }

    // Apply state
    setDecryptedText(text);
    setDecryptedAttachmentUrls(urls);
    setIsUnlocked(true);
    setShowPasswordModal(false);
    setPassword("");

    // Save to session so it stays unlocked while in conversation
    unlockSession?.setUnlocked(message.messageId, { text, attachmentUrls: urls });
  };

  const handleLock = () => {
    setIsUnlocked(false);
    setDecryptedText(null);
    setDecryptedAttachmentUrls([]);
  };

  // Unlocked view — show decrypted content
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
            {/* Unlocked indicator */}
            <Pressable onPress={handleLock} className="flex-row items-center mb-1">
              <Ionicons name="lock-open" size={10} color="#F59E0B" />
              <Text className="text-amber-500 text-[10px] ml-1">UNLOCKED</Text>
              <Text className="text-zinc-500 text-[10px] ml-1">(tap to re-lock)</Text>
            </Pressable>

            {/* Decrypted attachments */}
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

            {/* Decrypted text */}
            {decryptedText && (
              <Text className={`text-sm ${isOwnMessage ? "text-white" : "text-white"}`}>
                {decryptedText}
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

  // Locked view — show placeholder
  return (
    <>
      <View className={`flex-row mb-2 px-4 ${isOwnMessage ? "justify-end" : "justify-start"}`}>
        {!isOwnMessage && (
          <View className="w-8 h-8 rounded-full bg-zinc-700 items-center justify-center mr-2">
            <Text className="text-white text-xs font-bold">{senderInitial || "?"}</Text>
          </View>
        )}

        <View className={`max-w-[70%] ${isOwnMessage ? "items-end" : "items-start"}`}>
          <Pressable
            onPress={() => setShowPasswordModal(true)}
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

      {/* Password Modal */}
      <Modal
        visible={showPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowPasswordModal(false);
          setPassword("");
          setError("");
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <Pressable
            onPress={() => {
              setShowPasswordModal(false);
              setPassword("");
              setError("");
            }}
            className="flex-1 bg-black/70 justify-center px-6"
          >
            <Pressable onPress={() => {}} className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
              <View className="items-center mb-4">
                <View className="w-14 h-14 rounded-full bg-amber-500/20 items-center justify-center mb-3">
                  <Ionicons name="lock-closed" size={28} color="#F59E0B" />
                </View>
                <Text className="text-white text-lg font-bold">Unlock Message</Text>
                <Text className="text-zinc-400 text-sm mt-1 text-center">
                  Enter the password to view this message
                </Text>
                {hint ? (
                  <View className="bg-amber-500/10 rounded-lg px-3 py-2 mt-2">
                    <Text className="text-amber-400 text-xs text-center">Hint: {hint}</Text>
                  </View>
                ) : null}
              </View>

              <TextInput
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setError("");
                }}
                placeholder="Enter password"
                placeholderTextColor="#71717A"
                secureTextEntry
                autoFocus
                className="text-white text-base bg-zinc-800 rounded-xl px-4 py-3 border border-zinc-700 mb-2"
              />

              {error ? (
                <Text className="text-red-400 text-xs mb-3">{error}</Text>
              ) : null}

              <View className="flex-row gap-3 mt-2">
                <Pressable
                  onPress={() => {
                    setShowPasswordModal(false);
                    setPassword("");
                    setError("");
                  }}
                  className="flex-1 py-3 rounded-xl bg-zinc-800 items-center"
                >
                  <Text className="text-zinc-300 font-semibold">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleUnlock}
                  disabled={!password}
                  className={`flex-1 py-3 rounded-xl items-center ${
                    password ? "bg-amber-500" : "bg-zinc-800"
                  }`}
                >
                  <Text className={`font-semibold ${password ? "text-black" : "text-zinc-500"}`}>
                    Unlock
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
