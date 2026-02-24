import { useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface JoinGroupModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (inviteCode: string, message?: string) => Promise<void>;
  isSubmitting: boolean;
}

export function JoinGroupModal({
  visible,
  onClose,
  onSubmit,
  isSubmitting,
}: JoinGroupModalProps) {
  const [inviteCode, setInviteCode] = useState("");
  const [message, setMessage] = useState("");

  const resetForm = () => {
    setInviteCode("");
    setMessage("");
  };

  const handleSubmit = async () => {
    if (!inviteCode.trim()) return;
    await onSubmit(inviteCode.trim(), message.trim() || undefined);
    resetForm();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-zinc-950">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-4 border-b border-zinc-800">
          <Pressable onPress={handleClose} className="p-2 -ml-2">
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
          <Text className="text-white font-semibold text-lg">
            Join with Invite Code
          </Text>
          <View className="w-10" />
        </View>

        <View className="flex-1 px-4 pt-6">
          {/* Invite Code Input */}
          <View className="mb-4">
            <Text className="text-gray-400 text-sm mb-2">
              Invite Code <Text className="text-red-500">*</Text>
            </Text>
            <TextInput
              value={inviteCode}
              onChangeText={setInviteCode}
              placeholder="Enter invite code"
              placeholderTextColor="#666"
              className="bg-zinc-900 rounded-lg p-4 text-white border border-zinc-800 text-center text-lg tracking-widest"
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>

          {/* Optional Message */}
          <View className="mb-6">
            <Text className="text-gray-400 text-sm mb-2">
              Message (Optional)
            </Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Tell the group admin why you want to join..."
              placeholderTextColor="#666"
              className="bg-zinc-900 rounded-lg p-3 text-white border border-zinc-800 min-h-[100px]"
              multiline
              textAlignVertical="top"
              maxLength={200}
            />
          </View>

          {/* Info */}
          <View className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
            <View className="flex-row items-start">
              <Ionicons
                name="information-circle-outline"
                size={20}
                color="#666"
                style={{ marginTop: 2 }}
              />
              <Text className="text-gray-500 text-sm ml-2 flex-1">
                Ask the group admin for their invite code to join their group
                directly. Your request may still need admin approval.
              </Text>
            </View>
          </View>
        </View>

        {/* Submit Button */}
        <View className="px-4 py-4 border-t border-zinc-800">
          <Pressable
            onPress={handleSubmit}
            disabled={!inviteCode.trim() || isSubmitting}
            className={`rounded-lg p-4 items-center ${
              inviteCode.trim() && !isSubmitting
                ? "bg-yellow-500"
                : "bg-zinc-700"
            }`}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text
                className={`font-semibold text-base ${
                  inviteCode.trim() ? "text-black" : "text-gray-500"
                }`}
              >
                Join Group
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
