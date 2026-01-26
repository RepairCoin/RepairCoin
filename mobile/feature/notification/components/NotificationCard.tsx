import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/shared/store/auth.store";
import { formatDistanceToNow } from "date-fns";
import { Notification } from "../types";
import { getNotificationStyle, getNavigationRoute } from "../utils";

interface NotificationCardProps {
  notification: Notification;
  onPress?: () => void;
}

export default function NotificationCard({ notification, onPress }: NotificationCardProps) {
  const router = useRouter();
  const { userType } = useAuthStore();
  const style = getNotificationStyle(notification.notificationType);

  const handlePress = () => {
    if (onPress) {
      onPress();
    }

    const route = getNavigationRoute(notification, userType);
    if (route) {
      router.push(route as any);
    }
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
      <View className="w-10 h-10 rounded-full bg-zinc-800 items-center justify-center mr-3">
        {style.icon}
      </View>

      {/* Content */}
      <View className="flex-1">
        <Text
          className={`text-white text-sm leading-5 ${!notification.isRead ? "font-semibold" : ""}`}
          numberOfLines={3}
        >
          {notification.message}
        </Text>
        <Text className="text-zinc-500 text-xs mt-1">{timeAgo}</Text>
      </View>

      {/* Unread indicator */}
      {!notification.isRead && (
        <View className="w-3 h-3 rounded-full bg-red-500 mt-1" />
      )}
    </Pressable>
  );
}
