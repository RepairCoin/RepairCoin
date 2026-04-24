import React from "react";
import { View, Text, ActivityIndicator } from "react-native";

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  submessage?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible,
  message = "Processing...",
  submessage = "Please wait while we process your request",
}) => {
  if (!visible) return null;

  return (
    <View
      className="absolute top-0 left-0 right-0 bottom-0 bg-black/50 justify-center items-center z-50"
      style={{ position: "absolute" }}
    >
      <View className="bg-zinc-800 p-8 rounded-2xl items-center mx-4">
        <ActivityIndicator size="large" color="#FFCC00" />
        <Text className="text-white mt-4 text-lg font-semibold">{message}</Text>
        <Text className="text-gray-400 mt-2 text-center">{submessage}</Text>
      </View>
    </View>
  );
};
