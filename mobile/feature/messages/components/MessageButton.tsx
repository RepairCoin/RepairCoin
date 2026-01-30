import { View, Pressable, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { useAuthStore } from "@/shared/store/auth.store";
import { messageApi } from "@/feature/messages/services/message.services";

interface MessageButtonProps {
  userType?: "customer" | "shop";
}

export default function MessageButton({ userType = "customer" }: MessageButtonProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const { isAuthenticated } = useAuthStore();

  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const response = await messageApi.getUnreadCount();
      setUnreadCount(response.count || 0);
    } catch (error) {
      // Silently fail - API may not be implemented yet
      setUnreadCount(0);
    }
  }, [isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      fetchUnreadCount();
    }, [fetchUnreadCount])
  );

  const handlePress = () => {
    const route = userType === "shop"
      ? "/shop/messages"
      : "/customer/messages";
    router.push(route as any);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={{ width: 40, height: 40, position: 'relative' }}
      className="bg-[#121212] rounded-full items-center justify-center"
    >
      <Feather name="message-circle" size={20} color="white" />

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
