import { View, Text, Pressable, Modal, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type NotificationMenuProps = {
  visible: boolean;
  onClose: () => void;
  isRegistered: boolean;
  onTurnOff: () => void;
  onTurnOn: () => void;
};

export default function NotificationMenu({
  visible,
  onClose,
  isRegistered,
  onTurnOff,
  onTurnOn,
}: NotificationMenuProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/50" onPress={onClose}>
        <View className="absolute top-24 right-4 bg-zinc-800 rounded-xl overflow-hidden min-w-[200px]">
          <TouchableOpacity
            onPress={isRegistered ? onTurnOff : onTurnOn}
            className="flex-row items-center px-4 py-3"
          >
            <Ionicons
              name={isRegistered ? "notifications-off-outline" : "notifications-outline"}
              size={20}
              color={isRegistered ? "#EF4444" : "#22C55E"}
            />
            <Text
              className={`ml-3 text-base ${
                isRegistered ? "text-red-400" : "text-green-400"
              }`}
            >
              {isRegistered ? "Turn off notifications" : "Turn on notifications"}
            </Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}
