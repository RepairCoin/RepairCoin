import { View, Text, Pressable } from "react-native";
import { formatDistanceToNow } from "date-fns";
import { Notification } from "../types";
import {
  getNotificationStyle,
  getNotificationTitle,
} from "@/shared/utilities/notificationHelpers";

interface NotificationCardProps {
  notification: Notification;
  onPress?: () => void;
}

export default function NotificationCard({ notification, onPress }: NotificationCardProps) {
  const style = getNotificationStyle(notification.notificationType, notification.metadata);
  const title = getNotificationTitle(
    notification.notificationType,
    notification.metadata
  );

  // Pressing opens the detail modal (handled by the parent via onPress),
  // matching the web NotificationBell. No navigation away from the list.
  const handlePress = () => {
    onPress?.();
  };

  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true });

  // Background: light yellow if unread, transparent if read
  const bgColor = !notification.isRead ? "bg-yellow-500/10" : "bg-transparent";
  const borderColor = !notification.isRead ? "border-yellow-500/30" : "border-zinc-800";

  return (
    <Pressable
      onPress={handlePress}
      className={`flex-row items-start p-4 mx-4 mb-3 rounded-xl border ${bgColor} ${borderColor} ${
        !notification.isRead ? "border-l-4 border-l-red-500" : ""
      }`}
      style={({ pressed }) => ({
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {/* Icon */}
      <View
        className={`w-11 h-11 rounded-full items-center justify-center mr-3 ${style.bgColor}`}
      >
        {style.icon}
      </View>

      {/* Content */}
      <View className="flex-1">
        <View className="flex-row items-start justify-between">
          <Text
            className="text-white text-base font-semibold flex-1 pr-2"
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text className="text-zinc-500 text-xs">{timeAgo}</Text>
        </View>
        <Text
          className="text-zinc-400 text-sm leading-5 mt-1"
          numberOfLines={3}
        >
          {notification.message}
        </Text>
      </View>

      {/* Unread indicator */}
      {!notification.isRead && (
        <View className="w-2.5 h-2.5 rounded-full bg-red-500 ml-2 mt-1.5" />
      )}
    </Pressable>
  );
}
