import { Entypo, Octicons } from "@expo/vector-icons";
import { View, Text } from "react-native";

type Props = {
  success: boolean;
};

export default function TransactionHistoryCard({ success }: Props) {
  return (
    <View className="bg-white w-full p-4 rounded-full flex-row items-center my-2">
      <View
        className={`w-14 h-14 ${success ? "bg-[#DDF6E2]" : "bg-[#F6C8C8]"} rounded-full items-center justify-center`}
      >
        {success ? (
          <Entypo name="check" color="#1A9D5B" size={24} />
        ) : (
          <Octicons name="x" color="#E34C4C" size={24} />
        )}
      </View>
      <View className="flex-1 px-2">
        <View className="flex-row justify-between">
          <Text className="text-black text-xl font-extrabold">
            Mike Repair Inc.
          </Text>
          <Text className="text-black text-xl font-extrabold">+10 RCN</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-[#666] text-lg font-semibold">
            Small Repair • Repair
          </Text>
          <Text className="text-[#666] text-lg font-semibold">10/13/2025</Text>
        </View>
      </View>
    </View>
  );
}
