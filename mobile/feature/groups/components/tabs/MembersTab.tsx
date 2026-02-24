import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  useGroupMembers,
  useApproveMember,
  useRejectMember,
  useRemoveMember,
} from "../../hooks";
import { AffiliateShopGroupMember } from "../../types";

interface MembersTabProps {
  groupId: string;
  isAdmin: boolean;
}

type MemberFilter = "active" | "pending";

export function MembersTab({ groupId, isAdmin }: MembersTabProps) {
  const [filter, setFilter] = useState<MemberFilter>("active");

  const { data: activeMembers = [], isLoading: isLoadingActive } =
    useGroupMembers(groupId, "active");
  const { data: pendingMembers = [], isLoading: isLoadingPending } =
    useGroupMembers(groupId, "pending");

  const approveMutation = useApproveMember(groupId);
  const rejectMutation = useRejectMember(groupId);
  const removeMutation = useRemoveMember(groupId);

  const members = filter === "active" ? activeMembers : pendingMembers;
  const isLoading = filter === "active" ? isLoadingActive : isLoadingPending;

  const handleApprove = (member: AffiliateShopGroupMember) => {
    Alert.alert(
      "Approve Member",
      `Approve ${member.shopName || "this shop"} to join the group?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: () => approveMutation.mutate(member.shopId),
        },
      ]
    );
  };

  const handleReject = (member: AffiliateShopGroupMember) => {
    Alert.alert(
      "Reject Request",
      `Reject ${member.shopName || "this shop"}'s request to join?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: () => rejectMutation.mutate(member.shopId),
        },
      ]
    );
  };

  const handleRemove = (member: AffiliateShopGroupMember) => {
    Alert.alert(
      "Remove Member",
      `Remove ${member.shopName || "this shop"} from the group?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeMutation.mutate(member.shopId),
        },
      ]
    );
  };

  return (
    <View className="p-4">
      {/* Filter Tabs */}
      {isAdmin && (
        <View className="flex-row mb-4">
          <Pressable
            onPress={() => setFilter("active")}
            className={`flex-1 py-2 rounded-lg mr-2 ${
              filter === "active" ? "bg-yellow-500" : "bg-zinc-800"
            }`}
          >
            <Text
              className={`text-center font-medium ${
                filter === "active" ? "text-black" : "text-gray-400"
              }`}
            >
              Active ({activeMembers.length})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setFilter("pending")}
            className={`flex-1 py-2 rounded-lg ${
              filter === "pending" ? "bg-orange-500" : "bg-zinc-800"
            }`}
          >
            <Text
              className={`text-center font-medium ${
                filter === "pending" ? "text-black" : "text-gray-400"
              }`}
            >
              Pending ({pendingMembers.length})
            </Text>
          </Pressable>
        </View>
      )}

      {/* Members List */}
      {isLoading ? (
        <View className="items-center py-10">
          <ActivityIndicator size="large" color="#FFCC00" />
        </View>
      ) : members.length === 0 ? (
        <View className="items-center py-10">
          <Ionicons name="people-outline" size={48} color="#333" />
          <Text className="text-gray-500 mt-4 text-center">
            {filter === "active"
              ? "No active members yet"
              : "No pending requests"}
          </Text>
        </View>
      ) : (
        <View>
          {members.map((member) => (
            <MemberCard
              key={member.shopId}
              member={member}
              isAdmin={isAdmin}
              isPending={filter === "pending"}
              onApprove={() => handleApprove(member)}
              onReject={() => handleReject(member)}
              onRemove={() => handleRemove(member)}
              isApproving={approveMutation.isPending}
              isRejecting={rejectMutation.isPending}
              isRemoving={removeMutation.isPending}
            />
          ))}
        </View>
      )}
    </View>
  );
}

interface MemberCardProps {
  member: AffiliateShopGroupMember;
  isAdmin: boolean;
  isPending: boolean;
  onApprove: () => void;
  onReject: () => void;
  onRemove: () => void;
  isApproving: boolean;
  isRejecting: boolean;
  isRemoving: boolean;
}

function MemberCard({
  member,
  isAdmin,
  isPending,
  onApprove,
  onReject,
  onRemove,
  isApproving,
  isRejecting,
  isRemoving,
}: MemberCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <View className="bg-zinc-900 rounded-xl p-4 mb-3 border border-zinc-800">
      <View className="flex-row items-center">
        {/* Avatar */}
        <View className="w-12 h-12 rounded-full bg-zinc-800 items-center justify-center mr-3">
          <Ionicons name="storefront" size={24} color="#FFCC00" />
        </View>

        {/* Info */}
        <View className="flex-1">
          <View className="flex-row items-center">
            <Text className="text-white font-semibold" numberOfLines={1}>
              {member.shopName || `Shop ${member.shopId.slice(0, 8)}...`}
            </Text>
            {member.role === "admin" && (
              <View className="bg-yellow-500/20 px-2 py-0.5 rounded ml-2">
                <Text className="text-yellow-500 text-xs">Leader</Text>
              </View>
            )}
          </View>
          <Text className="text-gray-500 text-sm">
            {isPending ? "Requested" : "Joined"} {formatDate(member.joinedAt)}
          </Text>
        </View>
      </View>

      {/* Request Message (for pending) */}
      {isPending && member.requestMessage && (
        <View className="bg-zinc-800 rounded-lg p-3 mt-3">
          <Text className="text-gray-400 text-sm">{member.requestMessage}</Text>
        </View>
      )}

      {/* RCN Info (for active) */}
      {!isPending && member.allocatedRcn !== undefined && (
        <View className="flex-row mt-3 pt-3 border-t border-zinc-800">
          <View className="flex-1">
            <Text className="text-gray-500 text-xs">Allocated</Text>
            <Text className="text-white font-medium">
              {member.allocatedRcn} RCN
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-gray-500 text-xs">Used</Text>
            <Text className="text-white font-medium">{member.usedRcn} RCN</Text>
          </View>
          <View className="flex-1">
            <Text className="text-gray-500 text-xs">Available</Text>
            <Text className="text-green-500 font-medium">
              {member.availableRcn} RCN
            </Text>
          </View>
        </View>
      )}

      {/* Admin Actions */}
      {isAdmin && member.role !== "admin" && (
        <View className="flex-row mt-3 pt-3 border-t border-zinc-800 gap-2">
          {isPending ? (
            <>
              <Pressable
                onPress={onApprove}
                disabled={isApproving}
                className="flex-1 bg-green-500/20 py-2 rounded-lg"
              >
                <Text className="text-green-500 text-center font-medium">
                  {isApproving ? "Approving..." : "Approve"}
                </Text>
              </Pressable>
              <Pressable
                onPress={onReject}
                disabled={isRejecting}
                className="flex-1 bg-red-500/20 py-2 rounded-lg"
              >
                <Text className="text-red-500 text-center font-medium">
                  {isRejecting ? "Rejecting..." : "Reject"}
                </Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={onRemove}
              disabled={isRemoving}
              className="flex-1 bg-red-500/20 py-2 rounded-lg"
            >
              <Text className="text-red-500 text-center font-medium">
                {isRemoving ? "Removing..." : "Remove Member"}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
