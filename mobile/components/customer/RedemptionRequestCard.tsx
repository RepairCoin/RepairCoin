import { Entypo, Octicons } from "@expo/vector-icons";
import { View, Text, Pressable } from "react-native";

type Props = {
  name: string;
  success: boolean;
};

export default function RedemptionRequestCard({ name, success }: Props) {
  return (
    <View className="bg-[#202325] w-full p-4 rounded-xl my-2">
      <View className="flex-row justify-between">
        <Text className="text-white text-xl font-extrabold">{name}</Text>
        <Text className="text-white text-xl font-extrabold">10 RCN</Text>
      </View>
      <View className="flex-row justify-between">
        <Text className="text-[#666] text-lg font-semibold">
          Mike Repair Shop
        </Text>
        <Text className="text-[#666] text-lg font-semibold">
          3:03PM • July 22, 2025
        </Text>
      </View>
      {success ? (
        <Pressable className="bg-[#DDF6E2] py-1 w-56 items-center rounded-lg mt-2">
          <Text className="text-[#1A9D5B]">
            <Entypo name="check" color="#1A9D5B" size={14} />
            {"  "}Approved Request
          </Text>
        </Pressable>
      ) : (
        <Pressable className="bg-[#F6C8C8] py-1 w-56 items-center rounded-lg mt-2">
          <Text className="text-[#E34C4C]">
            <Octicons name="x" color="#E34C4C" size={14} />
            {"  "}Rejected Request
          </Text>
        </Pressable>
      )}
    </View>
  );
}
