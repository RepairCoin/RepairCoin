import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export default function HorizontalCard({
  label,
  Icon,
  number,
}: {
  label: string;
  Icon: any;
  number: number | string;
}) {
  return (
    <View className="flex h-28 rounded-2xl overflow-hidden mx-4 my-2">
      <LinearGradient
        colors={["#373737", "#121212"]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        className="flex-1 h-full p-4 relative"
      >
        <View
          className="w-48 h-48 border-[#141414] border-[40px] rounded-full absolute"
          style={{
            top: -25,
            left: 100,
          }}
        />
        <View className="flex-col justify-center px-2 h-full">
          <View className="flex-row items-center justify-between w-full">
            <Text className="text-[#FFCC00] text-sm font-bold">{label}</Text>
            {Icon}
          </View>
          <Text className="text-white text-2xl mt-2 font-semibold">
            {number}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}
