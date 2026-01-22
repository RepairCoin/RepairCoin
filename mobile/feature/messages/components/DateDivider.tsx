import { View, Text } from "react-native";
import { formatDateDivider } from "../utils";

type DateDividerProps = {
  dateString: string;
};

export default function DateDivider({ dateString }: DateDividerProps) {
  return (
    <View className="items-center my-4">
      <View className="bg-zinc-800 px-3 py-1 rounded-full">
        <Text className="text-xs text-zinc-400">{formatDateDivider(dateString)}</Text>
      </View>
    </View>
  );
}
