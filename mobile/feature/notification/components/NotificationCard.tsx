import { View, Text, Pressable } from "react-native";
import { Ionicons, MaterialCommunityIcons, FontAwesome5, Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Notification } from "@/interfaces/notification.interface";
import { formatDistanceToNow } from "date-fns";

interface NotificationCardProps {
  notification: Notification;
  onPress?: () => void;
}

// Map notification types to icons and colors
const getNotificationStyle = (type: string) => {
  switch (type) {
    case "reward_issued":
      return {
        icon: <FontAwesome5 name="coins" size={20} color="#FFCC00" />,
        bgColor: "bg-yellow-500/20",
        borderColor: "border-yellow-500/30",
      };
    case "token_gifted":
      return {
        icon: <Ionicons name="gift" size={20} color="#EC4899" />,
        bgColor: "bg-pink-500/20",
        borderColor: "border-pink-500/30",
      };
    case "redemption_approval_requested":
    case "redemption_approval_request":
      return {
        icon: <MaterialCommunityIcons name="cash-refund" size={20} color="#F97316" />,
        bgColor: "bg-orange-500/20",
        borderColor: "border-orange-500/30",
      };
    case "redemption_approved":
      return {
        icon: <Ionicons name="checkmark-circle" size={20} color="#22C55E" />,
        bgColor: "bg-green-500/20",
        borderColor: "border-green-500/30",
      };
    case "redemption_rejected":
      return {
        icon: <Ionicons name="close-circle" size={20} color="#EF4444" />,
        bgColor: "bg-red-500/20",
        borderColor: "border-red-500/30",
      };
    case "booking_confirmed":
    case "service_booking_received":
      return {
        icon: <Ionicons name="calendar-outline" size={20} color="#3B82F6" />,
        bgColor: "bg-blue-500/20",
        borderColor: "border-blue-500/30",
      };
    case "appointment_reminder":
    case "upcoming_appointment":
      return {
        icon: <Ionicons name="alarm" size={20} color="#8B5CF6" />,
        bgColor: "bg-purple-500/20",
        borderColor: "border-purple-500/30",
      };
    case "service_order_completed":
    case "order_completed":
      return {
        icon: <Ionicons name="checkmark-done" size={20} color="#22C55E" />,
        bgColor: "bg-green-500/20",
        borderColor: "border-green-500/30",
      };
    case "subscription_expiring":
      return {
        icon: <Ionicons name="warning" size={20} color="#F59E0B" />,
        bgColor: "bg-amber-500/20",
        borderColor: "border-amber-500/30",
      };
    case "reschedule_request_created":
    case "reschedule_request_approved":
    case "reschedule_request_rejected":
      return {
        icon: <Feather name="clock" size={20} color="#06B6D4" />,
        bgColor: "bg-cyan-500/20",
        borderColor: "border-cyan-500/30",
      };
    default:
      return {
        icon: <Ionicons name="notifications" size={20} color="#9CA3AF" />,
        bgColor: "bg-gray-500/20",
        borderColor: "border-gray-500/30",
      };
  }
};

// Get navigation route based on notification type
const getNavigationRoute = (notification: Notification): string | null => {
  const { notificationType, metadata } = notification;

  switch (notificationType) {
    case "reward_issued":
    case "token_gifted":
    case "redemption_approved":
    case "redemption_rejected":
      return "/(dashboard)/customer/tabs/home";
    case "redemption_approval_requested":
    case "redemption_approval_request":
      // Navigate to redemption approval screen if we have sessionId
      if (metadata?.sessionId) {
        return `/(dashboard)/customer/tabs/home`;
      }
      return "/(dashboard)/customer/tabs/home";
    case "booking_confirmed":
    case "appointment_reminder":
    case "service_order_completed":
    case "order_completed":
      // Navigate to bookings tab
      return "/(dashboard)/customer/tabs/service/tabs/bookings";
    case "subscription_expiring":
      // For shop owners - navigate to subscription settings
      return null;
    case "reschedule_request_created":
    case "reschedule_request_approved":
    case "reschedule_request_rejected":
      return "/(dashboard)/customer/tabs/service/tabs/bookings";
    default:
      return null;
  }
};

export default function NotificationCard({ notification, onPress }: NotificationCardProps) {
  const router = useRouter();
  const style = getNotificationStyle(notification.notificationType);

  const handlePress = () => {
    if (onPress) {
      onPress();
    }

    const route = getNavigationRoute(notification);
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
