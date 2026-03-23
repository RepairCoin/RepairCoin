import { View, Text, Modal, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { CalendarBooking } from "@/shared/interfaces/appointment.interface";
import { formatTimeRange, formatBookingDate } from "../utils/timeFormat";
import { getStatusColor } from "../utils/statusUtils";

interface BookingDetailModalProps {
  booking: CalendarBooking | null;
  visible: boolean;
  onClose: () => void;
  onViewOrder: (orderId: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  paid: "Confirmed",
  confirmed: "Confirmed",
  "in-progress": "In Progress",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export default function BookingDetailModal({
  booking,
  visible,
  onClose,
  onViewOrder,
}: BookingDetailModalProps) {
  if (!booking) return null;

  const statusColor = getStatusColor(booking.status as any);
  const statusLabel = STATUS_LABELS[booking.status] || booking.status;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/70 justify-end">
        <View className="bg-[#121212] rounded-t-3xl pt-4 pb-8 px-5">
          {/* Handle bar */}
          <View className="w-10 h-1 bg-gray-600 rounded-full self-center mb-4" />

          {/* Header */}
          <View className="flex-row items-start justify-between mb-5">
            <View className="flex-1 mr-3">
              <Text className="text-white text-xl font-bold" numberOfLines={2}>
                {booking.serviceName}
              </Text>
              <View
                className="px-3 py-1 rounded-full self-start mt-2"
                style={{ backgroundColor: statusColor + "20" }}
              >
                <Text
                  className="text-sm font-semibold"
                  style={{ color: statusColor }}
                >
                  {statusLabel}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              className="bg-[#1a1a1a] w-8 h-8 rounded-full items-center justify-center"
            >
              <Ionicons name="close" size={18} color="#999" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Date & Time */}
            <DetailRow
              icon="calendar-outline"
              label="Date"
              value={formatBookingDate(booking.bookingDate)}
            />
            <DetailRow
              icon="time-outline"
              label="Time"
              value={formatTimeRange(
                booking.bookingTimeSlot,
                booking.bookingEndTime
              )}
            />

            {/* Customer */}
            <DetailRow
              icon="person-outline"
              label="Customer"
              value={
                booking.customerName ||
                `${booking.customerAddress.slice(0, 10)}...`
              }
            />

            {/* Amount */}
            <DetailRow
              icon="cash-outline"
              label="Amount"
              value={`$${booking.totalAmount.toFixed(2)}`}
              valueColor="#FFCC00"
            />

            {/* Notes */}
            {booking.notes && (
              <DetailRow
                icon="document-text-outline"
                label="Notes"
                value={booking.notes}
              />
            )}

            {/* Order ID */}
            <DetailRow
              icon="receipt-outline"
              label="Order ID"
              value={booking.orderId.slice(0, 16) + "..."}
              mono
            />

            {/* Booked on */}
            <View className="mt-3 pt-3 border-t border-gray-800">
              <Text className="text-gray-500 text-xs text-center">
                Booked on{" "}
                {new Date(booking.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          </ScrollView>

          {/* View Order Button */}
          <TouchableOpacity
            onPress={() => onViewOrder(booking.orderId)}
            className="bg-[#FFCC00] rounded-xl py-3.5 mt-4 flex-row items-center justify-center"
          >
            <Feather name="external-link" size={18} color="#000" />
            <Text className="text-black font-bold text-base ml-2">
              View Full Order
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function DetailRow({
  icon,
  label,
  value,
  valueColor = "#fff",
  mono = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  valueColor?: string;
  mono?: boolean;
}) {
  return (
    <View className="flex-row items-start py-3 border-b border-gray-800/50">
      <View className="w-8 h-8 rounded-full bg-[#1a1a1a] items-center justify-center mr-3 mt-0.5">
        <Ionicons name={icon} size={16} color="#FFCC00" />
      </View>
      <View className="flex-1">
        <Text className="text-gray-500 text-xs mb-0.5">{label}</Text>
        <Text
          className={`text-base font-medium ${mono ? "font-mono" : ""}`}
          style={{ color: valueColor }}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}
