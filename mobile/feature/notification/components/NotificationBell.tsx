import { View, Pressable, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState, useEffect } from "react";
import { notificationApi } from "@/services/notification.services";
import { useAuthStore } from "@/store/auth.store";

interface NotificationBellProps {
  userType?: "customer" | "shop";
}

export default function NotificationBell({ userType = "customer" }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const { isAuthenticated } = useAuthStore();

  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const response = await notificationApi.getUnreadCount();
      setUnreadCount(response.count || 0);
    } catch (error) {
      console.error("Failed to fetch unread count:", error);
    }
  }, [isAuthenticated]);

  // Fetch unread count when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchUnreadCount();
    }, [fetchUnreadCount])
  );

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    if (!isAuthenticated) return;

    // Initial fetch
    fetchUnreadCount();

    // Set up polling interval
    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [isAuthenticated, fetchUnreadCount]);

  const handlePress = () => {
    const route = userType === "shop"
      ? "/shop/notification"
      : "/customer/notification";
    router.push(route as any);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={{ width: 40, height: 40, position: 'relative' }}
      className="bg-[#121212] rounded-full items-center justify-center"
    >
      <Feather name="bell" size={20} color="white" />

      {/* Badge */}
      {unreadCount > 0 && (
        <View
          style={{
            position: 'absolute',
            top: -4,
            left: -4,
            minWidth: 18,
            height: 18,
            backgroundColor: '#EF4444',
            borderRadius: 9,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 4,
          }}
        >
          <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
