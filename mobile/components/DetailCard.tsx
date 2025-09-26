import { MaterialIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

export default function DetailCard() {
  return (
    <View className="w-full h-28 bg-[#1A1A1C] rounded-3xl flex-row overflow-hidden px-5 py-5">
      <View className="flex-3">
        <View className="flex-row items-center">
          <View className="w-9 h-9 rounded-full bg-white justify-center items-center">
            <MaterialIcons name="info" color="#000" size={20} />
          </View>
          <Text className="text-[#FFCC00] text-xl font-semibold ml-4">
            RCN Balance
          </Text>
        </View>
        <Text className="text-white text-sm mt-auto">
          This is the total RCN tokens you currently have
        </Text>
      </View>
      <View className="flex-1 justify-center">
        <Text className="text-[#FFCC00] text-2xl font-extrabold text-right">
          Bronze
        </Text>
      </View>
    </View>
  );
}
