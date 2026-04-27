import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RedemptionSession } from "../types";
import { RequestCard } from "./RequestCard";

interface PendingRequestsProps {
  pendingSessions: RedemptionSession[];
  isLoading: boolean;
  actionLoading: boolean;
  onAccept: (sessionId: string) => void;
  onReject: (sessionId: string) => void;
}

export const PendingRequests: React.FC<PendingRequestsProps> = ({
  pendingSessions,
  isLoading,
  actionLoading,
  onAccept,
  onReject,
}) => {
  return (
    <View className="mt-6">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-white text-lg font-bold">Pending Requests</Text>
        {pendingSessions.length > 0 && (
          <View className="bg-[#FFCC00] px-2 py-1 rounded-full">
            <Text className="text-black text-xs font-bold">
              {pendingSessions.length}
            </Text>
          </View>
        )}
      </View>
      <View className="bg-zinc-900 rounded-xl p-4">
        {isLoading ? (
          <View className="py-4 items-center">
            <ActivityIndicator color="#FFCC00" />
          </View>
        ) : pendingSessions.length > 0 ? (
          pendingSessions.map((session: RedemptionSession) => (
            <RequestCard
              key={session.sessionId}
              session={session}
              onAccept={onAccept}
              onReject={onReject}
              disabled={actionLoading}
            />
          ))
        ) : (
          <View className="py-6 items-center">
            <Ionicons name="receipt-outline" size={40} color="#666" />
            <Text className="text-gray-400 mt-3 text-center">
              No pending requests
            </Text>
            <Text className="text-gray-500 text-sm text-center mt-1">
              Visit a shop to request a redemption
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};
