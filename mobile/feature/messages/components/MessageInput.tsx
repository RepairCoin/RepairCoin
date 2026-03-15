import { useState } from "react";
import {
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  Text,
  Image,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";

export type AttachmentFile = {
  uri: string;
  name: string;
  type: string;
};

type MessageInputProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: (attachments?: AttachmentFile[]) => void;
  isSending: boolean;
  disabled?: boolean;
  disabledMessage?: string;
};

export default function MessageInput({
  value,
  onChangeText,
  onSend,
  isSending,
  disabled = false,
  disabledMessage,
}: MessageInputProps) {
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  const canSend = (value.trim() || attachments.length > 0) && !isSending && !disabled;

  const pickImage = async () => {
    setShowAttachMenu(false);

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 5 - attachments.length,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      const newAttachments: AttachmentFile[] = result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.fileName || `image_${Date.now()}.jpg`,
        type: asset.mimeType || "image/jpeg",
      }));
      setAttachments((prev) => [...prev, ...newAttachments].slice(0, 5));
    }
  };

  const takePhoto = async () => {
    setShowAttachMenu(false);

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setAttachments((prev) =>
        [
          ...prev,
          {
            uri: asset.uri,
            name: asset.fileName || `photo_${Date.now()}.jpg`,
            type: asset.mimeType || "image/jpeg",
          },
        ].slice(0, 5)
      );
    }
  };

  const pickDocument = async () => {
    setShowAttachMenu(false);

    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      multiple: true,
    });

    if (!result.canceled && result.assets) {
      const newAttachments: AttachmentFile[] = result.assets.map((asset: DocumentPicker.DocumentPickerAsset) => ({
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType || "application/pdf",
      }));
      setAttachments((prev) => [...prev, ...newAttachments].slice(0, 5));
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = () => {
    onSend(attachments.length > 0 ? attachments : undefined);
    setAttachments([]);
  };

  if (disabled && disabledMessage) {
    return (
      <View className="px-4 py-4 border-t border-zinc-800 bg-zinc-900">
        <View className="flex-row items-center justify-center bg-zinc-800 rounded-full py-3 px-4">
          <Ionicons name="ban-outline" size={18} color="#EF4444" />
          <Text className="text-zinc-400 text-sm ml-2">{disabledMessage}</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="border-t border-zinc-800 bg-zinc-900">
      {/* Attachment Previews */}
      {attachments.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="px-4 pt-3"
          contentContainerStyle={{ gap: 8 }}
        >
          {attachments.map((file, index) => (
            <View key={index} className="relative">
              {file.type.startsWith("image/") ? (
                <Image
                  source={{ uri: file.uri }}
                  className="w-16 h-16 rounded-lg"
                  resizeMode="cover"
                />
              ) : (
                <View className="w-16 h-16 rounded-lg bg-zinc-800 items-center justify-center">
                  <Ionicons name="document" size={24} color="#FFCC00" />
                  <Text className="text-zinc-400 text-[8px] mt-1" numberOfLines={1}>
                    PDF
                  </Text>
                </View>
              )}
              <Pressable
                onPress={() => removeAttachment(index)}
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 items-center justify-center"
              >
                <Ionicons name="close" size={12} color="#fff" />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Attachment Menu */}
      {showAttachMenu && (
        <View className="flex-row px-4 py-3 gap-4">
          <Pressable
            onPress={pickImage}
            className="flex-row items-center bg-zinc-800 rounded-full px-4 py-2"
          >
            <Ionicons name="image" size={18} color="#FFCC00" />
            <Text className="text-zinc-300 text-sm ml-2">Gallery</Text>
          </Pressable>
          <Pressable
            onPress={takePhoto}
            className="flex-row items-center bg-zinc-800 rounded-full px-4 py-2"
          >
            <Ionicons name="camera" size={18} color="#FFCC00" />
            <Text className="text-zinc-300 text-sm ml-2">Camera</Text>
          </Pressable>
          <Pressable
            onPress={pickDocument}
            className="flex-row items-center bg-zinc-800 rounded-full px-4 py-2"
          >
            <Ionicons name="document" size={18} color="#FFCC00" />
            <Text className="text-zinc-300 text-sm ml-2">PDF</Text>
          </Pressable>
        </View>
      )}

      {/* Input Row */}
      <View className="px-4 py-4">
        <View className="flex-row items-center">
          {/* Attachment Button */}
          <Pressable
            onPress={() => setShowAttachMenu(!showAttachMenu)}
            disabled={isSending || attachments.length >= 5}
            className={`w-10 h-10 rounded-full items-center justify-center mr-2 ${
              showAttachMenu ? "bg-[#FFCC00]" : "bg-zinc-800"
            }`}
          >
            <Ionicons
              name={showAttachMenu ? "close" : "add"}
              size={22}
              color={showAttachMenu ? "#000" : attachments.length >= 5 ? "#71717A" : "#FFCC00"}
            />
          </Pressable>

          {/* Text Input */}
          <View className="flex-1 h-12 bg-zinc-800 rounded-full px-4 mr-2 border border-zinc-700 justify-center">
            <TextInput
              value={value}
              onChangeText={onChangeText}
              placeholder="Type a message..."
              placeholderTextColor="#71717A"
              className="text-white text-sm"
              editable={!isSending && !disabled}
            />
          </View>

          {/* Send Button */}
          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            className={`w-12 h-12 rounded-full items-center justify-center ${
              canSend ? "bg-[#FFCC00]" : "bg-zinc-800"
            }`}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Ionicons name="send" size={20} color={canSend ? "#000" : "#71717A"} />
            )}
          </Pressable>
        </View>

        {/* Attachment Count Hint */}
        {attachments.length > 0 && (
          <Text className="text-zinc-500 text-xs mt-2 text-center">
            {attachments.length}/5 attachments
          </Text>
        )}
      </View>
    </View>
  );
}
