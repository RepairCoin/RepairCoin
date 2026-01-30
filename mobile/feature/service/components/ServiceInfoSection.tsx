import { View, Text } from "react-native";

interface ServiceInfoSectionProps {
  category: string;
  serviceName: string;
  priceUsd: number;
  description?: string;
}

export function ServiceInfoSection({
  category,
  serviceName,
  priceUsd,
  description,
}: ServiceInfoSectionProps) {
  return (
    <>
      {/* Category */}
      <View className="flex-row items-center justify-between mb-2">
        <View className="bg-gray-800 px-3 py-1 rounded-full">
          <Text className="text-gray-400 text-xs uppercase">{category}</Text>
        </View>
      </View>

      {/* Service Name */}
      <Text className="text-white text-2xl font-bold mb-2">{serviceName}</Text>

      {/* Price */}
      <Text className="text-[#FFCC00] text-3xl font-bold mb-4">
        ${priceUsd}
      </Text>

      {/* Description */}
      <View className="mb-6">
        <Text className="text-gray-400 text-base leading-6">
          {description || "No description available."}
        </Text>
      </View>

      {/* Divider */}
      <View className="h-px bg-gray-800 mb-6" />
    </>
  );
}
