import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { RescheduleRequest, RescheduleRequestStatus } from "@/shared/services/appointment.services";

interface RescheduleRequestCardProps {
  request: RescheduleRequest;
  onApprove: (requestId: string) => void;
  onReject: (requestId: string, reason?: string) => void;
  isApproving?: boolean;
  isRejecting?: boolean;
}

const STATUS_COLORS: Record<RescheduleRequestStatus, string> = {
  pending: "#FFCC00",
  approved: "#22c55e",
  rejected: "#ef4444",
  expired: "#f97316",
  cancelled: "#6b7280",
};

const STATUS_LABELS: Record<RescheduleRequestStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  expired: "Expired",
  cancelled: "Cancelled",
};

const formatTime12Hour = (time: string) => {
  if (!time) return "N/A";
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

const formatDate = (dateString: string) => {
  if (!dateString) return "N/A";
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

const formatDateTime = (dateString: string) => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export default function RescheduleRequestCard({
  request,
  onApprove,
  onReject,
  isApproving = false,
  isRejecting = false,
}: RescheduleRequestCardProps) {
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const isPending = request.status === "pending";
  const statusColor = STATUS_COLORS[request.status] || "#999";
  const statusLabel = STATUS_LABELS[request.status] || request.status;

  const handleReject = () => {
    onReject(request.requestId, rejectReason.trim() || undefined);
    setShowRejectModal(false);
    setRejectReason("");
  };

  return (
    <>
      <View
        className="bg-[#1a1a1a] rounded-xl p-4 mb-3 border-l-4"
        style={{ borderLeftColor: statusColor }}
      >
        {/* Header */}
        <View className="flex-row items-start justify-between mb-3">
          <View className="flex-1">
            <Text className="text-white text-base font-semibold" numberOfLines={1}>
              {request.serviceName || "Service"}
            </Text>
            <View className="flex-row items-center mt-1">
              <Feather name="user" size={12} color="#999" />
              <Text className="text-gray-400 text-sm ml-1">
                {request.customerName || "Customer"}
              </Text>
            </View>
          </View>

          {/* Status Badge */}
          <View
            className="px-2 py-1 rounded-full"
            style={{ backgroundColor: statusColor + "20" }}
          >
            <Text className="text-xs font-medium" style={{ color: statusColor }}>
              {statusLabel}
            </Text>
          </View>
        </View>

        {/* Time Change Display */}
        <View className="bg-[#252525] rounded-lg p-3 mb-3">
          {/* Original Time */}
          <View className="flex-row items-center mb-2">
            <View className="w-20">
              <Text className="text-gray-500 text-xs uppercase">From</Text>
            </View>
            <View className="flex-row items-center flex-1">
              <Feather name="calendar" size={14} color="#999" />
              <Text className="text-gray-300 text-sm ml-2">
                {formatDate(request.originalDate)}{" "}
                <Text className="text-gray-500">at</Text>{" "}
                {formatTime12Hour(request.originalTimeSlot)}
              </Text>
            </View>
          </View>

          {/* Arrow */}
          <View className="flex-row items-center mb-2 ml-10">
            <Ionicons name="arrow-down" size={16} color="#FFCC00" />
          </View>

          {/* Requested Time */}
          <View className="flex-row items-center">
            <View className="w-20">
              <Text className="text-[#FFCC00] text-xs uppercase">To</Text>
            </View>
            <View className="flex-row items-center flex-1">
              <Feather name="calendar" size={14} color="#FFCC00" />
              <Text className="text-white text-sm ml-2 font-medium">
                {formatDate(request.requestedDate)}{" "}
                <Text className="text-gray-400">at</Text>{" "}
                {formatTime12Hour(request.requestedTimeSlot)}
              </Text>
            </View>
          </View>
        </View>

        {/* Customer Reason */}
        {request.customerReason && (
          <View className="mb-3">
            <Text className="text-gray-500 text-xs uppercase mb-1">
              Customer's Reason
            </Text>
            <Text className="text-gray-300 text-sm">
              "{request.customerReason}"
            </Text>
          </View>
        )}

        {/* Request Time */}
        <View className="flex-row items-center mb-3">
          <Feather name="clock" size={12} color="#666" />
          <Text className="text-gray-500 text-xs ml-1">
            Requested {formatDateTime(request.createdAt)}
          </Text>
          {request.expiresAt && isPending && (
            <Text className="text-orange-400 text-xs ml-2">
              Expires {formatDateTime(request.expiresAt)}
            </Text>
          )}
        </View>

        {/* Shop Reason (for rejected) */}
        {request.shopReason && request.status === "rejected" && (
          <View className="mb-3 bg-red-900/20 rounded-lg p-2">
            <Text className="text-red-400 text-xs">
              Rejection reason: {request.shopReason}
            </Text>
          </View>
        )}

        {/* Action Buttons - Only for pending requests */}
        {isPending && (
          <View className="flex-row space-x-2 gap-2 mt-1">
            <TouchableOpacity
              onPress={() => setShowRejectModal(true)}
              disabled={isApproving || isRejecting}
              className="flex-1 py-2.5 rounded-xl items-center border border-red-700/50"
            >
              {isRejecting ? (
                <ActivityIndicator size="small" color="#ef4444" />
              ) : (
                <View className="flex-row items-center">
                  <Ionicons name="close" size={16} color="#ef4444" />
                  <Text className="text-red-400 font-medium ml-1">Reject</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => onApprove(request.requestId)}
              disabled={isApproving || isRejecting}
              className="flex-1 py-2.5 rounded-xl items-center bg-[#22c55e]"
            >
              {isApproving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <View className="flex-row items-center">
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text className="text-white font-medium ml-1">Approve</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Reject Reason Modal */}
      <Modal
        visible={showRejectModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRejectModal(false)}
      >
        <View className="flex-1 bg-black/70 items-center justify-center px-4">
          <View className="bg-[#1a1a1a] rounded-2xl p-6 w-full max-w-sm">
            <View className="items-center mb-4">
              <View className="w-14 h-14 rounded-full bg-red-900/30 items-center justify-center mb-3">
                <Ionicons name="close-circle" size={28} color="#ef4444" />
              </View>
              <Text className="text-white text-lg font-bold">
                Reject Request
              </Text>
            </View>

            <Text className="text-gray-400 text-center mb-4">
              Provide a reason for rejecting this reschedule request (optional).
            </Text>

            <TextInput
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="e.g., Requested time is unavailable..."
              placeholderTextColor="#666"
              multiline
              numberOfLines={3}
              className="bg-[#252525] text-white rounded-xl p-3 border border-[#333] min-h-[80px] mb-4"
              style={{ textAlignVertical: "top" }}
            />

            <View className="flex-row space-x-3">
              <TouchableOpacity
                onPress={() => {
                  setShowRejectModal(false);
                  setRejectReason("");
                }}
                className="flex-1 py-3 rounded-xl border border-gray-700"
              >
                <Text className="text-gray-300 font-semibold text-center">
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleReject}
                className="flex-1 py-3 rounded-xl bg-red-600"
              >
                <Text className="text-white font-semibold text-center">
                  Reject
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
