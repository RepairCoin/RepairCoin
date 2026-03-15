import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AffiliateShopGroup } from "../types";

interface GroupCardProps {
  group: AffiliateShopGroup;
  onPress: () => void;
  showJoinButton?: boolean;
  onJoin?: () => void;
  isJoining?: boolean;
}

export function GroupCard({
  group,
  onPress,
  showJoinButton,
  onJoin,
  isJoining,
}: GroupCardProps) {
  const isAdmin = group.role === "admin";
  const isMember = group.membershipStatus === "active";
  const isPending = group.membershipStatus === "pending";

  return (
    <Pressable
      onPress={onPress}
      className="bg-zinc-900 rounded-xl p-4 mb-3 border border-zinc-800 active:bg-zinc-800"
    >
      {/* Header */}
      <View className="flex-row items-center mb-3">
        {/* Icon */}
        <View className="w-12 h-12 rounded-full bg-zinc-800 items-center justify-center mr-3">
          {group.icon ? (
            <Text className="text-2xl">{group.icon}</Text>
          ) : (
            <Ionicons name="people" size={24} color="#FFCC00" />
          )}
        </View>

        {/* Name and badges */}
        <View className="flex-1">
          <View className="flex-row items-center flex-wrap gap-1">
            <Text
              className="text-white font-semibold text-base mr-2"
              numberOfLines={1}
            >
              {group.groupName}
            </Text>
            {isAdmin && (
              <View className="bg-yellow-500/20 px-2 py-0.5 rounded">
                <Text className="text-yellow-500 text-xs font-medium">
                  Leader
                </Text>
              </View>
            )}
            {isMember && !isAdmin && (
              <View className="bg-green-500/20 px-2 py-0.5 rounded">
                <Text className="text-green-500 text-xs font-medium">
                  Member
                </Text>
              </View>
            )}
            {isPending && (
              <View className="bg-orange-500/20 px-2 py-0.5 rounded">
                <Text className="text-orange-500 text-xs font-medium">
                  Pending
                </Text>
              </View>
            )}
          </View>

          {/* Token info */}
          {group.customTokenSymbol && (
            <View className="flex-row items-center mt-1">
              <View className="bg-purple-500/20 px-2 py-0.5 rounded mr-2">
                <Text className="text-purple-400 text-xs">
                  {group.customTokenSymbol}
                </Text>
              </View>
              {group.customTokenName && (
                <Text className="text-gray-500 text-xs" numberOfLines={1}>
                  {group.customTokenName}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Arrow or Join button */}
        {showJoinButton && !isMember && !isPending ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onJoin?.();
            }}
            disabled={isJoining}
            className={`px-4 py-2 rounded-lg ${
              isJoining ? "bg-zinc-700" : "bg-yellow-500"
            }`}
          >
            <Text
              className={`font-semibold text-sm ${
                isJoining ? "text-gray-400" : "text-black"
              }`}
            >
              {isJoining ? "Joining..." : "Join"}
            </Text>
          </Pressable>
        ) : (
          <Ionicons name="chevron-forward" size={20} color="#666" />
        )}
      </View>

      {/* Description */}
      {group.description && (
        <Text className="text-gray-400 text-sm mb-3" numberOfLines={2}>
          {group.description}
        </Text>
      )}

      {/* Footer */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Ionicons name="people-outline" size={16} color="#666" />
          <Text className="text-gray-500 text-sm ml-1">
            {group.memberCount || 0} members
          </Text>
        </View>

        <View className="flex-row items-center">
          {group.isPrivate ? (
            <>
              <Ionicons name="lock-closed" size={14} color="#666" />
              <Text className="text-gray-500 text-xs ml-1">Private</Text>
            </>
          ) : (
            <>
              <Ionicons name="globe-outline" size={14} color="#666" />
              <Text className="text-gray-500 text-xs ml-1">Public</Text>
            </>
          )}
        </View>
      </View>
    </Pressable>
  );
}
