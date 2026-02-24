import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AffiliateShopGroup } from "../../types";

interface OverviewTabProps {
  group: AffiliateShopGroup;
}

export function OverviewTab({ group }: OverviewTabProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <View className="p-4">
      {/* Description */}
      <View className="bg-zinc-900 rounded-xl p-4 mb-4 border border-zinc-800">
        <Text className="text-gray-400 text-sm mb-2">About</Text>
        <Text className="text-white text-base leading-6">
          {group.description || "No description provided."}
        </Text>
      </View>

      {/* Token Info */}
      <View className="bg-zinc-900 rounded-xl p-4 mb-4 border border-zinc-800">
        <Text className="text-gray-400 text-sm mb-3">Custom Token</Text>
        <View className="flex-row items-center">
          <View className="w-12 h-12 rounded-full bg-purple-500/20 items-center justify-center mr-3">
            <Text className="text-purple-400 font-bold text-lg">
              {group.customTokenSymbol?.charAt(0) || "T"}
            </Text>
          </View>
          <View>
            <Text className="text-white font-semibold text-lg">
              {group.customTokenName || "Custom Token"}
            </Text>
            <Text className="text-purple-400 text-sm">
              {group.customTokenSymbol || "TOKEN"}
            </Text>
          </View>
        </View>
      </View>

      {/* Details */}
      <View className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
        <Text className="text-gray-400 text-sm mb-3">Details</Text>

        <View className="flex-row items-center py-3 border-b border-zinc-800">
          <Ionicons name="calendar-outline" size={18} color="#666" />
          <Text className="text-gray-400 ml-3 flex-1">Created</Text>
          <Text className="text-white">{formatDate(group.createdAt)}</Text>
        </View>

        <View className="flex-row items-center py-3 border-b border-zinc-800">
          <Ionicons name="time-outline" size={18} color="#666" />
          <Text className="text-gray-400 ml-3 flex-1">Last Updated</Text>
          <Text className="text-white">{formatDate(group.updatedAt)}</Text>
        </View>

        <View className="flex-row items-center py-3 border-b border-zinc-800">
          <Ionicons name="people-outline" size={18} color="#666" />
          <Text className="text-gray-400 ml-3 flex-1">Members</Text>
          <Text className="text-white">{group.memberCount || 0}</Text>
        </View>

        <View className="flex-row items-center py-3">
          <Ionicons
            name={group.isPrivate ? "lock-closed-outline" : "globe-outline"}
            size={18}
            color="#666"
          />
          <Text className="text-gray-400 ml-3 flex-1">Visibility</Text>
          <Text className="text-white">
            {group.isPrivate ? "Private" : "Public"}
          </Text>
        </View>
      </View>
    </View>
  );
}
