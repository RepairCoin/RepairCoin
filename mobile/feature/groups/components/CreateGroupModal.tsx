import { useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useHaptics } from "@/shared/hooks/useHaptics";
import { CreateGroupData } from "../types";

const ICON_OPTIONS = [
  "🏪",
  "🛒",
  "🏬",
  "🏢",
  "🏭",
  "🏗️",
  "🏠",
  "🏡",
  "💼",
  "📦",
  "🎯",
  "⭐",
  "💎",
  "🔥",
  "⚡",
  "🌟",
  "🎨",
  "🎭",
  "🎪",
  "🎡",
  "🚀",
  "💫",
  "🌈",
  "🎁",
];

interface CreateGroupModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: CreateGroupData) => Promise<void>;
  isSubmitting: boolean;
}

export function CreateGroupModal({
  visible,
  onClose,
  onSubmit,
  isSubmitting,
}: CreateGroupModalProps) {
  const [groupName, setGroupName] = useState("");
  const [customTokenName, setCustomTokenName] = useState("");
  const [customTokenSymbol, setCustomTokenSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("🏪");
  const [isPrivate, setIsPrivate] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const haptics = useHaptics();

  const resetForm = () => {
    setGroupName("");
    setCustomTokenName("");
    setCustomTokenSymbol("");
    setDescription("");
    setSelectedIcon("🏪");
    setIsPrivate(false);
  };

  const handleSubmit = async () => {
    if (!groupName.trim() || !customTokenName.trim() || !customTokenSymbol.trim()) {
      return;
    }

    await onSubmit({
      groupName: groupName.trim(),
      customTokenName: customTokenName.trim(),
      customTokenSymbol: customTokenSymbol.trim().toUpperCase(),
      description: description.trim() || undefined,
      icon: selectedIcon,
      isPrivate,
    });

    resetForm();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const isValid =
    groupName.trim() && customTokenName.trim() && customTokenSymbol.trim();

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
          <Text className="text-white font-semibold text-lg">Create Group</Text>
          <View className="w-10" />
        </View>

        <ScrollView className="flex-1 px-4 pt-4">
          {/* Group Icon */}
          <View className="mb-4">
            <Text className="text-gray-400 text-sm mb-2">Group Icon</Text>
            <Pressable
              onPress={() => setShowIconPicker(!showIconPicker)}
              className="flex-row items-center bg-zinc-900 rounded-lg p-3 border border-zinc-800"
            >
              <Text className="text-3xl mr-3">{selectedIcon}</Text>
              <Text className="text-white flex-1">Tap to change icon</Text>
              <Ionicons
                name={showIconPicker ? "chevron-up" : "chevron-down"}
                size={20}
                color="#666"
              />
            </Pressable>

            {showIconPicker && (
              <View className="flex-row flex-wrap bg-zinc-900 rounded-lg p-3 mt-2 border border-zinc-800">
                {ICON_OPTIONS.map((icon) => (
                  <Pressable
                    key={icon}
                    onPress={() => {
                      setSelectedIcon(icon);
                      setShowIconPicker(false);
                    }}
                    className={`w-12 h-12 items-center justify-center rounded-lg m-1 ${
                      selectedIcon === icon ? "bg-yellow-500/20" : "bg-zinc-800"
                    }`}
                  >
                    <Text className="text-2xl">{icon}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Group Name */}
          <View className="mb-4">
            <Text className="text-gray-400 text-sm mb-2">
              Group Name <Text className="text-red-500">*</Text>
            </Text>
            <TextInput
              value={groupName}
              onChangeText={setGroupName}
              placeholder="e.g., Downtown Alliance"
              placeholderTextColor="#666"
              className="bg-zinc-900 rounded-lg p-3 text-white border border-zinc-800"
              maxLength={50}
            />
          </View>

          {/* Token Name */}
          <View className="mb-4">
            <Text className="text-gray-400 text-sm mb-2">
              Custom Token Name <Text className="text-red-500">*</Text>
            </Text>
            <TextInput
              value={customTokenName}
              onChangeText={setCustomTokenName}
              placeholder="e.g., Downtown Bucks"
              placeholderTextColor="#666"
              className="bg-zinc-900 rounded-lg p-3 text-white border border-zinc-800"
              maxLength={30}
            />
          </View>

          {/* Token Symbol */}
          <View className="mb-4">
            <Text className="text-gray-400 text-sm mb-2">
              Token Symbol <Text className="text-red-500">*</Text>
            </Text>
            <TextInput
              value={customTokenSymbol}
              onChangeText={(text) =>
                setCustomTokenSymbol(text.toUpperCase().slice(0, 10))
              }
              placeholder="e.g., DTB"
              placeholderTextColor="#666"
              className="bg-zinc-900 rounded-lg p-3 text-white border border-zinc-800"
              autoCapitalize="characters"
              maxLength={10}
            />
            <Text className="text-gray-500 text-xs mt-1">
              Max 10 characters, will be displayed in uppercase
            </Text>
          </View>

          {/* Description */}
          <View className="mb-4">
            <Text className="text-gray-400 text-sm mb-2">Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Describe your group..."
              placeholderTextColor="#666"
              className="bg-zinc-900 rounded-lg p-3 text-white border border-zinc-800 min-h-[100px]"
              multiline
              textAlignVertical="top"
              maxLength={500}
            />
          </View>

          {/* Private Toggle */}
          <Pressable
            onPress={() => { haptics.selection(); setIsPrivate(!isPrivate); }}
            className="flex-row items-center justify-between bg-zinc-900 rounded-lg p-4 mb-6 border border-zinc-800"
          >
            <View className="flex-row items-center flex-1">
              <Ionicons
                name={isPrivate ? "lock-closed" : "globe-outline"}
                size={20}
                color="#FFCC00"
              />
              <View className="ml-3 flex-1">
                <Text className="text-white font-medium">
                  {isPrivate ? "Private Group" : "Public Group"}
                </Text>
                <Text className="text-gray-500 text-xs">
                  {isPrivate
                    ? "Only invited shops can join"
                    : "Any shop can request to join"}
                </Text>
              </View>
            </View>
            <View
              className={`w-12 h-7 rounded-full ${
                isPrivate ? "bg-yellow-500" : "bg-zinc-700"
              } justify-center px-1`}
            >
              <View
                className={`w-5 h-5 rounded-full bg-white ${
                  isPrivate ? "self-end" : "self-start"
                }`}
              />
            </View>
          </Pressable>

          {/* Info Box */}
          <View className="bg-blue-500/10 rounded-lg p-4 mb-6 border border-blue-500/20">
            <View className="flex-row items-start">
              <Ionicons
                name="information-circle"
                size={20}
                color="#3b82f6"
                style={{ marginTop: 2 }}
              />
              <View className="ml-2 flex-1">
                <Text className="text-blue-400 font-medium mb-1">
                  Group Requirements
                </Text>
                <Text className="text-blue-300/70 text-sm">
                  Creating a group requires an active subscription or 10K+ RCG
                  tokens. As the creator, you'll be the group admin.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Submit Button */}
        <View className="px-4 py-4 border-t border-zinc-800">
          <Pressable
            onPress={() => { haptics.medium(); handleSubmit(); }}
            disabled={!isValid || isSubmitting}
            className={`rounded-lg p-4 items-center ${
              isValid && !isSubmitting ? "bg-yellow-500" : "bg-zinc-700"
            }`}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text
                className={`font-semibold text-base ${
                  isValid ? "text-black" : "text-gray-500"
                }`}
              >
                Create Group
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
