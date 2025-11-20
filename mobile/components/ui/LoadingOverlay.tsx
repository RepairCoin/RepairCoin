import { View, Text, Modal, ActivityIndicator } from "react-native";

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  indicatorColor?: string;
  animationType?: "none" | "slide" | "fade";
}

export function LoadingOverlay({ 
  visible, 
  message = "Loading...",
  indicatorColor = "#FFCC00",
  animationType = "fade"
}: LoadingOverlayProps) {
  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType={animationType}
    >
      <View className="flex-1 justify-center items-center bg-black/60">
        <View className="bg-zinc-900 p-6 rounded-2xl items-center">
          <ActivityIndicator size="large" color={indicatorColor} />
          <Text className="text-white mt-3 text-base">{message}</Text>
        </View>
      </View>
    </Modal>
  );
}