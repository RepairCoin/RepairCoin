import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

export default function ServicesTab() {
  return (
    <View className="px-4">
      <View className="items-center justify-center py-12">
        <Ionicons name="construct-outline" size={48} color="#666" />
        <Text className="text-gray-400 text-lg mt-4">No services yet</Text>
        <Text className="text-gray-500 text-sm mt-1">
          This shop hasn't added any services
        </Text>
      </View>
    </View>
  );
}
