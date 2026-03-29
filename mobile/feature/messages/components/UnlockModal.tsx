import { useState, useEffect } from "react";
import { View, Text, Pressable, TextInput, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Message } from "../types";
import { decryptMessage } from "../utils/encryption";

type UnlockSession = {
  setUnlocked: (messageId: string, data: { text: string | null; attachmentUrls: string[] }) => void;
};

type UnlockModalProps = {
  visible: boolean;
  message: Message | null;
  unlockSession?: UnlockSession;
  onClose: () => void;
  onUnlocked: () => void;
};

export default function UnlockModal({
  visible,
  message,
  unlockSession,
  onClose,
  onUnlocked,
}: UnlockModalProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const encryption = message?.metadata?.encryption;
  const hint = encryption?.hint as string | undefined;

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!visible) {
      setPassword("");
      setError("");
    }
  }, [visible]);

  const handleUnlock = () => {
    if (!password || !message) return;

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

    // Save to session
    unlockSession?.setUnlocked(message.messageId, { text, attachmentUrls: urls });

    setPassword("");
    onClose();
    onUnlocked();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable onPress={onClose} className="flex-1 bg-black/70 justify-center px-6">
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
              onPress={onClose}
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
    </Modal>
  );
}
