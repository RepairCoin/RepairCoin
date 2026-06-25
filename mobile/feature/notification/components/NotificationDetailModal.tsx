import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import { Notification } from "../types";
import {
  getNotificationStyle,
  getNotificationTitle,
  getNotificationDetails,
} from "@/shared/utilities/notificationHelpers";

type NotificationDetailModalProps = {
  notification: Notification | null;
  onClose: () => void;
  onDelete: (id: string) => void;
};

export default function NotificationDetailModal({
  notification,
  onClose,
  onDelete,
}: NotificationDetailModalProps) {
  if (!notification) return null;

  const style = getNotificationStyle(notification.notificationType, notification.metadata);
  const title = getNotificationTitle(
    notification.notificationType,
    notification.metadata
  );
  const details = getNotificationDetails(notification.metadata);
  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
  });

  return (
    <Modal
      visible={!!notification}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 bg-black/60 justify-end" onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="bg-zinc-900 rounded-t-3xl border-t border-yellow-500/20 max-h-[85%]"
        >
          {/* Drag handle */}
          <View className="items-center pt-3 pb-1">
            <View className="w-10 h-1 bg-zinc-600 rounded-full" />
          </View>

          {/* Header */}
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-zinc-800">
            <View className="flex-row items-center flex-1 mr-3">
              <View className="w-10 h-10 rounded-full bg-zinc-800 items-center justify-center mr-3">
                {style.icon}
              </View>
              <Text
                className="text-white text-lg font-semibold flex-1"
                numberOfLines={1}
              >
                {title}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} className="p-1">
              <Ionicons name="close" size={24} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView
            className="px-5 py-4"
            showsVerticalScrollIndicator={false}
          >
            {/* Message */}
            <Text className="text-zinc-300 text-base leading-6">
              {notification.message}
            </Text>

            {/* Details */}
            {details.length > 0 && (
              <View className="bg-zinc-950 rounded-xl p-4 mt-4">
                <Text className="text-yellow-500 text-sm font-semibold mb-3">
                  Details
                </Text>
                {details.map((row) => (
                  <View
                    key={row.label}
                    className="flex-row justify-between items-start py-1"
                  >
                    <Text className="text-zinc-500 text-sm mr-4">
                      {row.label}
                    </Text>
                    <Text className="text-white text-sm flex-1 text-right">
                      {row.value}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Timestamp */}
            <Text className="text-zinc-500 text-sm mt-4">{timeAgo}</Text>
          </ScrollView>

          {/* Footer actions */}
          <View className="flex-row justify-end gap-3 px-5 py-4 border-t border-zinc-800">
            <TouchableOpacity
              onPress={() => {
                onDelete(notification.id);
                onClose();
              }}
              className="px-5 py-3 rounded-xl bg-red-600"
            >
              <Text className="text-white font-medium">Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClose}
              className="px-5 py-3 rounded-xl bg-[#FFCC00]"
            >
              <Text className="text-black font-medium">Close</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
