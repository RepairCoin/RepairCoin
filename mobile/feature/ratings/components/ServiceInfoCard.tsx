import { View, Text } from "react-native";

interface ServiceInfoCardProps {
  serviceName?: string;
  shopName?: string;
}

export default function ServiceInfoCard({
  serviceName,
  shopName,
}: ServiceInfoCardProps) {
  return (
    <View className="py-6">
      <View className="bg-zinc-900 rounded-xl p-4">
        <Text className="text-gray-400 text-sm mb-1">Service</Text>
        <Text className="text-white text-lg font-semibold">
          {serviceName || "Service"}
        </Text>
        {shopName && (
          <Text className="text-gray-500 text-sm mt-1">at {shopName}</Text>
        )}
      </View>
    </View>
  );
}
