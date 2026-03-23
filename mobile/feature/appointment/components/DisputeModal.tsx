import { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  NoShowHistoryEntry,
  disputeApi,
} from "../services/dispute.services";
import { useAppToast } from "@/shared/hooks/useAppToast";

interface DisputeModalProps {
  visible: boolean;
  onClose: () => void;
  noShowEntry: NoShowHistoryEntry;
  onDisputeSubmitted: () => void;
}

const DISPUTE_REASONS = [
  "I was present but no one was available",
  "I called to cancel/reschedule but was still marked",
  "The appointment was cancelled by the shop",
  "I had an emergency and notified the shop",
  "Technical issue with the booking system",
  "Other (please describe below)",
];

export default function DisputeModal({
  visible,
  onClose,
  noShowEntry,
  onDisputeSubmitted,
}: DisputeModalProps) {
  const { showSuccess } = useAppToast();
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    success: boolean;
    autoApproved: boolean;
    message: string;
  } | null>(null);

  // Reset on open
  useEffect(() => {
    if (visible) {
      setSelectedReason("");
      setCustomReason("");
      setError("");
      setResult(null);
    }
  }, [visible]);

  const finalReason =
    selectedReason === "Other (please describe below)"
      ? customReason.trim()
      : selectedReason
      ? `${selectedReason}${customReason.trim() ? ` — ${customReason.trim()}` : ""}`
      : customReason.trim();

  const isValid = finalReason.length >= 10;

  const daysRemaining = (() => {
    const markedAt = new Date(noShowEntry.markedNoShowAt);
    const windowEnd = new Date(
      markedAt.getTime() + 7 * 24 * 60 * 60 * 1000
    );
    const now = new Date();
    return Math.max(
      0,
      Math.ceil((windowEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    );
  })();

  const handleSubmit = async () => {
    if (!isValid) {
      setError("Please provide a reason (minimum 10 characters).");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await disputeApi.submitDispute(
        noShowEntry.orderId,
        finalReason
      );
      setResult({
        success: true,
        autoApproved: response.autoApproved,
        message: response.message,
      });
      showSuccess(
        response.autoApproved ? "Dispute approved!" : "Dispute submitted"
      );
      onDisputeSubmitted();
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          "Failed to submit dispute. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1 bg-black/80 justify-end">
          <View className="bg-[#121212] rounded-t-3xl max-h-[90%]">
            {/* Handle */}
            <View className="w-10 h-1 bg-gray-600 rounded-full self-center mt-3 mb-2" />

            {/* Header */}
            <View className="flex-row items-center justify-between px-5 pb-3 border-b border-zinc-800">
              <View className="flex-row items-center">
                <View className="w-9 h-9 rounded-full bg-orange-500/10 items-center justify-center mr-3">
                  <Ionicons name="alert-circle" size={20} color="#f97316" />
                </View>
                <View>
                  <Text className="text-white font-bold text-lg">
                    Dispute No-Show
                  </Text>
                  <Text className="text-gray-500 text-xs">
                    Contest this record
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={onClose}
                className="w-8 h-8 rounded-full bg-[#1a1a1a] items-center justify-center"
              >
                <Ionicons name="close" size={18} color="#999" />
              </TouchableOpacity>
            </View>

            <ScrollView
              className="px-5 py-4"
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Success State */}
              {result?.success ? (
                <View
                  className={`p-4 rounded-xl border mb-4 ${
                    result.autoApproved
                      ? "bg-green-500/10 border-green-500/30"
                      : "bg-blue-500/10 border-blue-500/30"
                  }`}
                >
                  <View className="flex-row items-start">
                    <Ionicons
                      name={
                        result.autoApproved
                          ? "checkmark-circle"
                          : "time-outline"
                      }
                      size={20}
                      color={result.autoApproved ? "#22c55e" : "#3b82f6"}
                    />
                    <View className="ml-3 flex-1">
                      <Text
                        className={`font-semibold ${
                          result.autoApproved
                            ? "text-green-400"
                            : "text-blue-400"
                        }`}
                      >
                        {result.autoApproved
                          ? "Dispute Approved!"
                          : "Dispute Submitted"}
                      </Text>
                      <Text className="text-gray-300 text-sm mt-1">
                        {result.message}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={onClose}
                    className="bg-zinc-700 rounded-xl py-3 items-center mt-4"
                  >
                    <Text className="text-white font-semibold">Close</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {/* No-Show Details */}
                  <View className="bg-[#1a1a1a] rounded-xl p-4 mb-4">
                    <Text className="text-gray-400 text-xs font-medium mb-2">
                      NO-SHOW RECORD
                    </Text>
                    <View className="flex-row justify-between">
                      <View>
                        <Text className="text-gray-500 text-xs">Date</Text>
                        <Text className="text-white text-sm">
                          {formatDate(noShowEntry.scheduledTime)}
                        </Text>
                      </View>
                      <View>
                        <Text className="text-gray-500 text-xs">
                          Marked On
                        </Text>
                        <Text className="text-white text-sm">
                          {formatDate(noShowEntry.markedNoShowAt)}
                        </Text>
                      </View>
                    </View>
                    {daysRemaining > 0 ? (
                      <Text className="text-amber-400 text-xs mt-3">
                        Dispute window closes in {daysRemaining} day
                        {daysRemaining !== 1 ? "s" : ""}
                      </Text>
                    ) : (
                      <Text className="text-red-400 text-xs mt-3">
                        Dispute window has expired
                      </Text>
                    )}
                  </View>

                  {daysRemaining === 0 ? (
                    <View className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl mb-4">
                      <Text className="text-red-300 text-sm text-center">
                        The 7-day dispute window has expired.
                      </Text>
                    </View>
                  ) : (
                    <>
                      {/* Reason Selection */}
                      <Text className="text-gray-400 text-sm font-medium mb-2">
                        Reason for Dispute
                      </Text>
                      <View className="mb-4">
                        {DISPUTE_REASONS.map((reason) => {
                          const isSelected = selectedReason === reason;
                          return (
                            <TouchableOpacity
                              key={reason}
                              onPress={() => setSelectedReason(reason)}
                              className={`p-3 rounded-xl border mb-2 ${
                                isSelected
                                  ? "border-amber-500 bg-amber-500/10"
                                  : "border-zinc-800 bg-[#1a1a1a]"
                              }`}
                            >
                              <Text
                                className={`text-sm ${
                                  isSelected
                                    ? "text-amber-200"
                                    : "text-gray-300"
                                }`}
                              >
                                {reason}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {/* Additional Details */}
                      <Text className="text-gray-400 text-sm font-medium mb-2">
                        {selectedReason ===
                        "Other (please describe below)"
                          ? "Describe your reason *"
                          : "Additional Details (optional)"}
                      </Text>
                      <TextInput
                        value={customReason}
                        onChangeText={(t) => {
                          setCustomReason(t);
                          setError("");
                        }}
                        placeholder="Any additional context..."
                        placeholderTextColor="#666"
                        multiline
                        numberOfLines={3}
                        className="bg-[#1a1a1a] text-white rounded-xl p-3 border border-zinc-800 mb-4 min-h-[80px]"
                        style={{ textAlignVertical: "top" }}
                      />

                      {/* Error */}
                      {error ? (
                        <View className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl mb-4">
                          <Text className="text-red-300 text-sm">{error}</Text>
                        </View>
                      ) : null}

                      {/* Info */}
                      <View className="p-3 bg-[#1a1a1a] rounded-xl mb-4">
                        <Text className="text-gray-500 text-xs">
                          Your dispute will be reviewed by the shop. First
                          offenses may be automatically approved.
                        </Text>
                      </View>
                    </>
                  )}
                </>
              )}

              <View className="h-4" />
            </ScrollView>

            {/* Footer */}
            {!result?.success && daysRemaining > 0 && (
              <View className="px-5 pb-8 pt-3 border-t border-zinc-800 flex-row gap-3">
                <TouchableOpacity
                  onPress={onClose}
                  className="flex-1 py-3.5 border border-zinc-700 rounded-xl items-center"
                >
                  <Text className="text-gray-300 font-semibold">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={!isValid || submitting}
                  className={`flex-1 py-3.5 rounded-xl items-center ${
                    isValid ? "bg-amber-500" : "bg-zinc-700"
                  }`}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text
                      className={`font-bold ${
                        isValid ? "text-black" : "text-gray-500"
                      }`}
                    >
                      Submit Dispute
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {!result?.success && daysRemaining === 0 && (
              <View className="px-5 pb-8 pt-3 border-t border-zinc-800">
                <TouchableOpacity
                  onPress={onClose}
                  className="py-3.5 border border-zinc-700 rounded-xl items-center"
                >
                  <Text className="text-gray-300 font-semibold">Close</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
