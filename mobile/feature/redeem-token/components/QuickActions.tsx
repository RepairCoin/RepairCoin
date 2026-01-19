import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { router } from "expo-router";

export const QuickActions: React.FC = () => {
  return (
    <View className="mt-6 flex-row">
      <TouchableOpacity
        onPress={() => router.push("/customer/qrcode")}
        className="flex-1 bg-[#FFCC00] rounded-xl py-4 mr-2 flex-row items-center justify-center"
        activeOpacity={0.8}
      >
        <Ionicons name="qr-code-outline" size={20} color="#000" />
        <Text className="text-black font-bold ml-2">Show QR Code</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => router.push("/customer/tabs/history")}
        className="flex-1 bg-zinc-800 rounded-xl py-4 ml-2 flex-row items-center justify-center"
        activeOpacity={0.8}
      >
        <Feather name="clock" size={20} color="#fff" />
        <Text className="text-white font-bold ml-2">History</Text>
      </TouchableOpacity>
    </View>
  );
};
