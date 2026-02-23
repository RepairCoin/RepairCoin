import { View, Text, TouchableOpacity, Modal, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MyAppointment } from "@/shared/interfaces/appointment.interface";
import { formatDate, formatTime } from "./AppointmentCard";

interface CancelModalProps {
  visible: boolean;
  appointment: MyAppointment | null;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function CancelModal({
  visible,
  appointment,
  isPending,
  onClose,
  onConfirm,
}: CancelModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/70 justify-center items-center px-6">
        <View className="bg-zinc-900 rounded-2xl p-6 w-full max-w-sm">
          {/* Icon */}
          <View className="items-center mb-4">
            <View className="bg-red-500/20 rounded-full p-4">
              <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
            </View>
          </View>

          {/* Title */}
          <Text className="text-white text-xl font-bold text-center mb-2">
            Cancel Appointment?
          </Text>

          {/* Description */}
          <Text className="text-gray-400 text-center mb-2">
            Are you sure you want to cancel your appointment for{" "}
            <Text className="text-white font-semibold">
              {appointment?.serviceName}
            </Text>
            ?
          </Text>

          {/* Policy Note */}
          <View className="flex-row items-center justify-center mb-4">
            <Ionicons name="information-circle-outline" size={14} color="#FFCC00" />
            <Text className="text-yellow-500 text-xs ml-1">
              Cancellation is only available 24+ hours before the appointment
            </Text>
          </View>

          {/* Appointment Details */}
          {appointment && (
            <View className="bg-zinc-800 rounded-xl p-3 mb-6">
              <View className="flex-row items-center mb-2">
                <Ionicons name="calendar-outline" size={16} color="#9CA3AF" />
                <Text className="text-gray-300 text-sm ml-2">
                  {formatDate(appointment.bookingDate).month}{" "}
                  {formatDate(appointment.bookingDate).date},{" "}
                  {formatDate(appointment.bookingDate).year}
                </Text>
              </View>
              <View className="flex-row items-center">
                <Ionicons name="time-outline" size={16} color="#9CA3AF" />
                <Text className="text-gray-300 text-sm ml-2">
                  {formatTime(appointment.bookingTimeSlot)}
                  {appointment.bookingEndTime &&
                    ` - ${formatTime(appointment.bookingEndTime)}`}
                </Text>
              </View>
            </View>
          )}

          {/* Buttons */}
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={onClose}
              className="flex-1 py-3 rounded-xl bg-zinc-800"
              disabled={isPending}
            >
              <Text className="text-white text-center font-semibold">
                Keep It
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onConfirm}
              disabled={isPending}
              className="flex-1 py-3 rounded-xl bg-red-500"
            >
              {isPending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-white text-center font-semibold">
                  Yes, Cancel
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
