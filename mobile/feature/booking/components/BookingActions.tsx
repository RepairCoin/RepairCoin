import { View, Text } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import ActionButton from "./ActionButton";
import InfoBanner from "./InfoBanner";

// --- Shop Actions ---

interface ShopActionsProps {
  status: string;
  isApproved: boolean;
  isActionLoading: boolean;
  onApprove: () => void;
  onMarkComplete: () => void;
  onCancel: () => void;
  onReschedule: () => void;
  onNoShow: () => void;
}

export function ShopActions({ status, isApproved, isActionLoading, onApprove, onMarkComplete, onCancel, onReschedule, onNoShow }: ShopActionsProps) {
  if (status === "pending") {
    return (
      <View className="gap-2">
        <InfoBanner color="#eab308" borderColor="#854d0e" text="Waiting for customer to complete payment." />
        <ActionButton label="Cancel Booking" icon="x-circle" color="#ef4444" variant="outline" onPress={onCancel} disabled={isActionLoading} />
      </View>
    );
  }

  if (status === "paid" && !isApproved) {
    return (
      <View className="gap-2">
        <InfoBanner color="#3b82f6" borderColor="#1e40af" text="Payment received. Approve this booking to proceed with the service." />
        <ActionButton label="Approve Booking" icon="check" bg="#FFCC00" textColor="#000" onPress={onApprove} disabled={isActionLoading} loading={isActionLoading} />
        <View className="flex-row gap-2">
          <ActionButton label="Reschedule" icon="calendar" color="#FFCC00" variant="outline" onPress={onReschedule} disabled={isActionLoading} flex />
          <ActionButton label="Cancel" color="#ef4444" variant="outline" onPress={onCancel} disabled={isActionLoading} flex />
        </View>
      </View>
    );
  }

  if (status === "paid" && isApproved) {
    return (
      <View className="gap-2">
        <InfoBanner color="#22c55e" borderColor="#166534" text="Booking approved. Mark as complete after the service is done to issue RCN rewards." />
        <ActionButton label="Mark as Complete" icon="check-circle" bg="#22c55e" textColor="#fff" onPress={onMarkComplete} disabled={isActionLoading} loading={isActionLoading} />
        <View className="flex-row gap-2">
          <ActionButton label="Reschedule" icon="calendar" color="#FFCC00" variant="outline" onPress={onReschedule} disabled={isActionLoading} flex />
          <ActionButton label="No-Show" color="#f97316" variant="outline" onPress={onNoShow} disabled={isActionLoading} flex />
        </View>
        <ActionButton label="Cancel Booking" color="#ef4444" variant="outline" onPress={onCancel} disabled={isActionLoading} />
      </View>
    );
  }

  return null;
}

// --- Customer Actions ---

interface CustomerActionsProps {
  status: string;
  isApproved: boolean;
  isActionLoading: boolean;
  rcnEarned: number;
  hasReview?: boolean;
  onReschedule: () => void;
  onCancel: () => void;
  onWriteReview: () => void;
  onBookAgain: () => void;
}

export function CustomerActions({ status, isApproved, isActionLoading, rcnEarned, hasReview, onReschedule, onCancel, onWriteReview, onBookAgain }: CustomerActionsProps) {
  if (status === "paid") {
    return (
      <View className="gap-2">
        <InfoBanner
          color="#3b82f6"
          borderColor="#1e40af"
          text={isApproved
            ? "Your booking has been approved. The shop will complete the service soon."
            : "Payment received. Waiting for shop to approve your booking."}
        />
        <ActionButton label="Request Reschedule" icon="calendar" color="#FFCC00" variant="outline" onPress={onReschedule} disabled={isActionLoading} />
        <ActionButton label="Cancel Booking" icon="x-circle" color="#ef4444" variant="outline" onPress={onCancel} disabled={isActionLoading} loading={isActionLoading} />
      </View>
    );
  }

  if (status === "completed") {
    return (
      <View className="gap-3">
        <View className="flex-row items-center p-3 bg-green-900/20 rounded-xl border border-green-700/50">
          <Feather name="check-circle" size={20} color="#22c55e" />
          <View className="ml-3 flex-1">
            <Text className="text-green-400 font-semibold">Service Completed</Text>
            <Text className="text-green-400/70 text-sm">You earned {rcnEarned} RCN rewards!</Text>
          </View>
        </View>
        <ActionButton
          label={hasReview ? "Already Reviewed" : "Write a Review"}
          iconComponent={<Ionicons name={hasReview ? "checkmark-circle" : "star"} size={20} color={hasReview ? "#22c55e" : "#000"} />}
          bg={hasReview ? "#27272a" : "#FFCC00"}
          textColor={hasReview ? "#22c55e" : "#000"}
          onPress={onWriteReview}
          disabled={hasReview}
        />
        <ActionButton label="Book Again" icon="refresh-cw" color="#FFCC00" variant="outline" onPress={onBookAgain} />
      </View>
    );
  }

  return null;
}
