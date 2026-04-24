import React from "react";
import { View, Text, Pressable } from "react-native";
import { RedemptionSession } from "../types";
import { formatDate } from "../utils";

interface RequestCardProps {
  session: RedemptionSession;
  onAccept: (sessionId: string) => void;
  onReject: (sessionId: string) => void;
  disabled?: boolean;
}

export const RequestCard: React.FC<RequestCardProps> = ({
  session,
  onAccept,
  onReject,
  disabled,
}) => {
  const amount = session.maxAmount || session.amount || 0;

  return (
    <View className="bg-zinc-800 p-4 rounded-xl mb-3">
      <View className="flex-row justify-between">
        <Text className="text-lg text-white font-bold">
          {session.shopId || "Shop"}
        </Text>
        <Text className="text-lg text-[#FFCC00] font-bold">{amount} RCN</Text>
      </View>
      <View className="flex-row justify-between mt-1">
        <Text className="text-gray-500 text-sm">{session.shopId}</Text>
        <Text className="text-gray-500 text-sm">
          {formatDate(session.createdAt)}
        </Text>
      </View>
      <View className="flex-row justify-between mt-4">
        <Pressable
          className={`bg-green-500/20 py-2 flex-1 mr-2 items-center rounded-lg ${disabled ? "opacity-50" : ""}`}
          onPress={() => onAccept(session.sessionId)}
          disabled={disabled}
        >
          <Text className="text-green-400 font-semibold">Accept</Text>
        </Pressable>
        <Pressable
          className={`bg-red-500/20 py-2 flex-1 ml-2 items-center rounded-lg ${disabled ? "opacity-50" : ""}`}
          onPress={() => onReject(session.sessionId)}
          disabled={disabled}
        >
          <Text className="text-red-400 font-semibold">Reject</Text>
        </Pressable>
      </View>
    </View>
  );
};
