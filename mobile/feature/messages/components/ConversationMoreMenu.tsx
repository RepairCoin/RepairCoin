import React from "react";
import { Modal, TouchableOpacity, View, Text, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Conversation } from "@/shared/interfaces/message.interface";

interface MenuOption {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  destructive?: boolean;
}

interface ConversationMoreMenuProps {
  visible: boolean;
  onClose: () => void;
  conversation: Conversation | null;
  isCustomer: boolean;
  onViewInfo: () => void;
  onArchive: () => void;
  onBlock: () => void;
  onDelete: () => void;
  onResolve: () => void;
}

export default function ConversationMoreMenu({
  visible,
  onClose,
  conversation,
  isCustomer,
  onViewInfo,
  onArchive,
  onBlock,
  onDelete,
  onResolve,
}: ConversationMoreMenuProps) {
  const isArchived = isCustomer
    ? conversation?.isArchivedCustomer
    : conversation?.isArchivedShop;

  const isBlocked = conversation?.isBlocked;
  const blockedByMe = conversation?.blockedBy === (isCustomer ? "customer" : "shop");
  const isResolved = conversation?.status === "resolved";

  const handleArchive = () => {
    onClose();
    onArchive();
  };

  const handleBlock = () => {
    onClose();
    if (isBlocked && blockedByMe) {
      // Unblock
      onBlock();
    } else if (!isBlocked) {
      // Confirm block
      Alert.alert(
        "Block User",
        "Are you sure you want to block this user? They won't be able to send you messages.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Block", style: "destructive", onPress: onBlock },
        ]
      );
    }
  };

  const handleDelete = () => {
    onClose();
    Alert.alert(
      "Delete Conversation",
      "Are you sure you want to delete this conversation? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: onDelete },
      ]
    );
  };

  const handleViewInfo = () => {
    onClose();
    onViewInfo();
  };

  const handleResolve = () => {
    onClose();
    onResolve();
  };

  const options: MenuOption[] = [
    {
      key: "info",
      label: "View Info",
      icon: "information-circle-outline",
    },
    {
      key: "resolve",
      label: isResolved ? "Reopen Conversation" : "Mark as Resolved",
      icon: isResolved ? "refresh-outline" : "checkmark-circle-outline",
      color: isResolved ? undefined : "#22C55E",
    },
    {
      key: "archive",
      label: isArchived ? "Unarchive" : "Archive",
      icon: isArchived ? "archive" : "archive-outline",
    },
    {
      key: "block",
      label: isBlocked && blockedByMe ? "Unblock" : "Block User",
      icon: isBlocked && blockedByMe ? "lock-open-outline" : "ban-outline",
      color: isBlocked && blockedByMe ? undefined : "#EF4444",
    },
    {
      key: "delete",
      label: "Delete Conversation",
      icon: "trash-outline",
      color: "#EF4444",
      destructive: true,
    },
  ];

  const handleOptionPress = (key: string) => {
    switch (key) {
      case "info":
        handleViewInfo();
        break;
      case "resolve":
        handleResolve();
        break;
      case "archive":
        handleArchive();
        break;
      case "block":
        handleBlock();
        break;
      case "delete":
        handleDelete();
        break;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        className="flex-1 bg-black/60 justify-end"
      >
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View className="bg-zinc-900 rounded-t-3xl">
            {/* Header */}
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-zinc-800">
              <View className="flex-row items-center">
                <Ionicons name="ellipsis-horizontal" size={20} color="#FFCC00" />
                <Text className="text-white text-lg font-semibold ml-2">Options</Text>
              </View>
              <TouchableOpacity onPress={onClose} className="p-1">
                <Ionicons name="close" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Options */}
            <View className="px-4 py-3">
              {options.map((option) => (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => handleOptionPress(option.key)}
                  className="flex-row items-center px-4 py-4 rounded-xl mb-2 active:bg-zinc-800"
                >
                  <View className="w-10 h-10 rounded-full bg-zinc-800 items-center justify-center mr-3">
                    <Ionicons
                      name={option.icon}
                      size={20}
                      color={option.color || "#FFCC00"}
                    />
                  </View>
                  <Text
                    className={`text-base flex-1 ${
                      option.destructive ? "text-red-500" : "text-gray-200"
                    }`}
                  >
                    {option.label}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color="#6B7280" />
                </TouchableOpacity>
              ))}
            </View>

            {/* Cancel Button */}
            <View className="px-4 pb-4">
              <TouchableOpacity
                onPress={onClose}
                className="bg-zinc-800 rounded-xl py-4 items-center"
              >
                <Text className="text-white font-semibold">Cancel</Text>
              </TouchableOpacity>
            </View>

            {/* Bottom safe area */}
            <View className="h-6" />
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
