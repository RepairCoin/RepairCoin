import { useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useAppToast } from "@/shared/hooks/useAppToast";
import { useFlagReview } from "../hooks/useModeration";

interface FlagReviewModalProps {
  visible: boolean;
  onClose: () => void;
  reviewId?: string;
}

const MIN_REASON = 3;
const MAX_REASON = 300;

export default function FlagReviewModal({
  visible,
  onClose,
  reviewId,
}: FlagReviewModalProps) {
  const [reason, setReason] = useState("");
  const { showError } = useAppToast();

  const resetAndClose = () => {
    setReason("");
    onClose();
  };

  const { mutate, isPending } = useFlagReview(resetAndClose);

  const handleFlag = () => {
    if (isPending) return;
    const r = reason.trim();
    if (r.length < MIN_REASON) {
      showError(`Please add a reason (at least ${MIN_REASON} characters).`);
      return;
    }
    if (!reviewId) {
      showError("Missing review reference.");
      return;
    }
    mutate({ reviewId, reason: r });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isPending ? undefined : onClose}
    >
      <Pressable
        className="flex-1 bg-black/70 justify-center items-center px-6"
        onPress={isPending ? undefined : onClose}
      >
        <Pressable
          className="bg-zinc-900 rounded-3xl w-full overflow-hidden"
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View className="items-center pt-6 pb-3 px-6">
            <View className="w-14 h-14 rounded-full bg-red-500/15 items-center justify-center mb-3">
              <MaterialIcons name="flag" size={28} color="#EF4444" />
            </View>
            <Text className="text-white text-xl font-bold">Flag Review</Text>
            <Text className="text-gray-500 text-xs mt-2 text-center">
              Report this review to admins for moderation.
            </Text>
          </View>

          <View className="px-6">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-gray-300 text-sm font-semibold">Reason</Text>
              <Text className="text-gray-500 text-xs">
                {reason.length}/{MAX_REASON}
              </Text>
            </View>
            <TextInput
              className="bg-zinc-800 rounded-xl px-3 py-3 text-white text-sm"
              placeholder="Why is this review inappropriate?"
              placeholderTextColor="#666"
              value={reason}
              onChangeText={(t) => setReason(t.slice(0, MAX_REASON))}
              multiline
              style={{ minHeight: 88, textAlignVertical: "top" }}
            />
          </View>

          {/* Actions */}
          <View className="px-6 pt-4 pb-6 flex-row gap-3">
            <TouchableOpacity
              onPress={onClose}
              disabled={isPending}
              className="flex-1 py-3.5 rounded-xl bg-zinc-800 items-center"
              activeOpacity={0.7}
            >
              <Text className="text-white font-semibold">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleFlag}
              disabled={isPending}
              className="flex-1 py-3.5 rounded-xl bg-red-500 items-center flex-row justify-center"
              activeOpacity={0.7}
            >
              {isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="flag" size={18} color="#fff" />
                  <Text className="text-white font-bold ml-1.5">Flag</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
