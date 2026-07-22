import { useState } from "react";
import { View, Text, Image, Modal, Pressable, StatusBar, Alert, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { Message, Conversation } from "../types";
import { formatMessageTime } from "@/shared/utilities/messageFormatters";
import LockedMessageBubble from "./LockedMessageBubble";

type UnlockSession = {
  getUnlocked: (messageId: string) => { text: string | null; attachmentUrls: string[] } | undefined;
  setUnlocked: (messageId: string, data: { text: string | null; attachmentUrls: string[] }) => void;
};

type MessageBubbleProps = {
  message: Message;
  isOwnMessage: boolean;
  conversation: Conversation | null;
  isCustomer: boolean;
  unlockSession?: UnlockSession;
  onRequestUnlock?: (message: Message) => void;
  onLongPress?: (message: Message) => void;
};

export default function MessageBubble({
  message,
  isOwnMessage,
  conversation,
  isCustomer,
  unlockSession,
  onRequestUnlock,
  onLongPress,
}: MessageBubbleProps) {
  // Route encrypted messages to LockedMessageBubble
  if (message.isEncrypted || message.messageType === "encrypted") {
    return (
      <LockedMessageBubble
        message={message}
        isOwnMessage={isOwnMessage}
        conversation={conversation}
        isCustomer={isCustomer}
        unlockSession={unlockSession}
        onRequestUnlock={onRequestUnlock}
        onLongPress={onLongPress}
      />
    );
  }

  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

  const handleDownloadImage = async (url: string) => {
    // Write-only access: saving to the gallery does not require the broad
    // READ_MEDIA_IMAGES permission (removed for Google Play compliance).
    const { status } = await MediaLibrary.requestPermissionsAsync(true);
    if (status !== "granted") {
      Alert.alert("Permission required", "Allow access to your photo library to save images.");
      return;
    }
    try {
      const filename = url.split("/").pop()?.split("?")[0] || `image_${Date.now()}.jpg`;
      const localUri = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.downloadAsync(url, localUri);
      await MediaLibrary.saveToLibraryAsync(localUri);
      Alert.alert("Saved", "Image saved to your photo library.");
    } catch {
      Alert.alert("Error", "Failed to save image. Please try again.");
    }
  };

  const handleOpenFile = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Error", "Cannot open this file on your device.");
      }
    } catch {
      Alert.alert("Error", "Failed to open file. Please try again.");
    }
  };

  const senderInitial = isCustomer
    ? conversation?.shopName?.charAt(0).toUpperCase()
    : conversation?.customerName?.charAt(0).toUpperCase();

  return (
    <>
      {/* Full-screen image viewer */}
      <Modal
        visible={!!fullScreenImage}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setFullScreenImage(null)}
      >
        <StatusBar hidden />
        <Pressable
          className="flex-1 bg-black items-center justify-center"
          onPress={() => setFullScreenImage(null)}
        >
          {fullScreenImage && (
            <Image
              source={{ uri: fullScreenImage }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="contain"
            />
          )}
          {/* Close button */}
          <Pressable
            onPress={() => setFullScreenImage(null)}
            className="absolute top-12 right-4 w-9 h-9 rounded-full bg-black/60 items-center justify-center"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={20} color="#fff" />
          </Pressable>
          {/* Download button */}
          <Pressable
            onPress={() => fullScreenImage && handleDownloadImage(fullScreenImage)}
            className="absolute top-12 left-4 w-9 h-9 rounded-full bg-black/60 items-center justify-center"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="download-outline" size={20} color="#fff" />
          </Pressable>
        </Pressable>
      </Modal>

    <View className={`flex-row mb-2 px-4 ${isOwnMessage ? "justify-end" : "justify-start"}`}>
      {/* Avatar for received messages */}
      {!isOwnMessage && (
        <View className="w-8 h-8 rounded-full bg-zinc-700 items-center justify-center mr-2">
          <Text className="text-white text-xs font-bold">{senderInitial || "?"}</Text>
        </View>
      )}

      <View className={`max-w-[70%] ${isOwnMessage ? "items-end" : "items-start"}`}>
        {/* Message Bubble */}
        <Pressable
          onPress={() => {}}
          onLongPress={() => isOwnMessage && onLongPress?.(message)}
          delayLongPress={400}
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
                    <View>
                      <Pressable onPress={() => setFullScreenImage(attachment.url)}>
                        <Image
                          source={{ uri: attachment.url }}
                          className="w-48 h-48 rounded-lg"
                          resizeMode="cover"
                        />
                      </Pressable>
                      {/* Download icon — top-right corner of image */}
                      <Pressable
                        onPress={() => handleDownloadImage(attachment.url)}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 items-center justify-center"
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons name="download-outline" size={14} color="#fff" />
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => handleOpenFile(attachment.url)}
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
                        className={`ml-2 text-xs flex-1 ${isOwnMessage ? "text-black" : "text-white"}`}
                        numberOfLines={1}
                      >
                        {attachment.name}
                      </Text>
                      <Ionicons
                        name="open-outline"
                        size={14}
                        color={isOwnMessage ? "#00000080" : "#9CA3AF"}
                        style={{ marginLeft: 6 }}
                      />
                    </Pressable>
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
    </>
  );
}
