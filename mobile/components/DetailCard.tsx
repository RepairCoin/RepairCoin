import { Text, View } from "react-native";

type DetailCardProps = {
  icon: any;
  title: string;
  label: string;
  badge: any;
};

export default function DetailCard({
  icon,
  title,
  label,
  badge,
}: DetailCardProps) {
  return (
    <View className="w-full h-28 bg-[#1A1A1C] rounded-3xl flex-row overflow-hidden px-5 py-5">
      <View className="flex-3">
        <View className="flex-row items-center">
          <View className="w-9 h-9 rounded-full bg-white justify-center items-center">
            {icon}
          </View>
          <Text className="text-[#FFCC00] text-xl font-semibold ml-4">
            {title}
          </Text>
        </View>
        <Text className="text-white text-sm mt-auto">
          {label}
        </Text>
      </View>
      <View className="flex-1 justify-center">
        <Text className="text-[#FFCC00] text-2xl font-extrabold text-right">
          {badge}
        </Text>
      </View>
    </View>
  );
}
