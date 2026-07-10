import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";

interface QuickAction {
  key: string;
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
}

const ACTIONS: QuickAction[] = [
  {
    key: "gift",
    label: "Gift Token",
    icon: <MaterialIcons name="card-giftcard" size={24} color="#fff" />,
    onPress: () => router.push("/customer/gift-token"),
  },
  {
    key: "qr",
    label: "QR Code",
    icon: <Ionicons name="qr-code-outline" size={24} color="#fff" />,
    onPress: () => router.push("/customer/qrcode"),
  },
  {
    key: "redeem",
    label: "Redeem",
    icon: <Ionicons name="wallet-outline" size={24} color="#fff" />,
    onPress: () => router.push("/customer/redeem"),
  },
  {
    key: "bookings",
    label: "My Bookings",
    icon: <Ionicons name="calendar-outline" size={24} color="#fff" />,
    // Bookings live in the Services tab's Bookings sub-tab.
    onPress: () =>
      router.navigate({
        pathname: "/customer/tabs/service",
        params: { tab: "Bookings" },
      }),
  },
];

/**
 * V2 Home "Quick Actions": a title + four flat dark tiles. Replaces the old
 * balance-heavy ActionCard on the customer home.
 */
function QuickActions() {
  return (
    <View className="mt-5">
      <Text className="text-white text-lg font-bold mb-3">Quick Actions</Text>
      <View className="flex-row justify-between">
        {ACTIONS.map((a) => (
          <Pressable
            key={a.key}
            onPress={a.onPress}
            className="flex-1 mx-1 bg-zinc-900 border border-zinc-800 rounded-2xl py-4 items-center active:bg-zinc-800"
          >
            {a.icon}
            <Text className="text-white text-[11px] mt-2 text-center">
              {a.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default React.memo(QuickActions);
