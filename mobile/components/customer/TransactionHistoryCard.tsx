import { Entypo, Octicons } from "@expo/vector-icons";
import { View, Text } from "react-native";

type Props = {
  type: string;
  amount: number;
  shopName?: string;
  description: string;
  createdAt: string;
};

export default function TransactionHistoryCard({ type, amount, shopName, description, createdAt }: Props) {
  const isEarned = type === "earned" || type === "bonus" || type === "referral" || type === "tier_bonus";
  const formattedDate = new Date(createdAt).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
  return (
    <View className="bg-white w-full py-2 px-4 rounded-full flex-row items-center my-2">
      <View
        className={`w-10 h-10 ${isEarned ? "bg-[#DDF6E2]" : "bg-[#F6C8C8]"} rounded-full items-center justify-center`}
      >
        {isEarned ? (
          <Entypo name="check" color="#1A9D5B" size={18} />
        ) : (
          <Octicons name="x" color="#E34C4C" size={18} />
        )}
      </View>
      <View className="flex-1 px-2">
        <View className="flex-row justify-between">
          <Text className="text-black text-xl font-extrabold" numberOfLines={1}>
            {shopName || "RepairCoin"}
          </Text>
          <Text className="text-black text-xl font-extrabold">
            {isEarned ? "+" : "-"}{amount} RCN
          </Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-[#666] text-base font-semibold" numberOfLines={1}>
            {type}
          </Text>
          <Text className="text-[#666] text-base font-semibold">{formattedDate}</Text>
        </View>
      </View>
    </View>
  );
}
