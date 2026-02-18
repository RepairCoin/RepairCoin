import { useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";

interface MarkNoShowModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (notes?: string) => void;
  isLoading?: boolean;
  customerName?: string;
}

export default function MarkNoShowModal({
  visible,
  onClose,
  onConfirm,
  isLoading = false,
  customerName,
}: MarkNoShowModalProps) {
  const [notes, setNotes] = useState("");

  const handleConfirm = () => {
    onConfirm(notes.trim() || undefined);
    setNotes("");
  };

  const handleClose = () => {
    setNotes("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-black/70 items-center justify-center px-4">
        <View className="bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-sm">
          {/* Header with Warning Icon */}
          <View className="items-center mb-4">
            <View className="w-16 h-16 rounded-full bg-orange-900/30 items-center justify-center mb-3">
              <Ionicons name="person-remove" size={32} color="#f97316" />
            </View>
            <Text className="text-white text-xl font-bold text-center">
              Mark as No-Show?
            </Text>
          </View>

          {/* Warning Message */}
          <View className="flex-row items-start p-3 bg-orange-900/20 rounded-xl border border-orange-700/50 mb-4">
            <Feather name="alert-triangle" size={18} color="#f97316" />
            <Text className="text-orange-300 text-sm ml-2 flex-1">
              This action will mark the customer{" "}
              {customerName ? (
                <Text className="font-semibold">{customerName}</Text>
              ) : (
                "as"
              )}{" "}
              as a no-show. This may affect their future booking privileges.
            </Text>
          </View>

          {/* Description */}
          <Text className="text-gray-400 text-center mb-4">
            The customer did not show up for their scheduled appointment. This
            will be recorded in their history.
          </Text>

          {/* Notes Input */}
          <View className="mb-4">
            <Text className="text-gray-400 text-sm mb-2">Notes (optional)</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Add any additional notes..."
              placeholderTextColor="#666"
              multiline
              numberOfLines={3}
              className="bg-[#252525] text-white rounded-xl p-3 border border-[#333] min-h-[80px]"
              style={{ textAlignVertical: "top" }}
            />
          </View>

          {/* Action Buttons */}
          <View className="flex-row space-x-3">
            <TouchableOpacity
              onPress={handleClose}
              disabled={isLoading}
              className="flex-1 py-3 rounded-xl border border-gray-700"
            >
              <Text className="text-gray-300 font-semibold text-center">
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleConfirm}
              disabled={isLoading}
              className="flex-1 py-3 rounded-xl bg-orange-600"
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-white font-semibold text-center">
                  Mark No-Show
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
