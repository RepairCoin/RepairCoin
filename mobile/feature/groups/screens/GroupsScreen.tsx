import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import { GroupCard, CreateGroupModal, JoinGroupModal } from "../components";
import {
  useMyGroups,
  useAllGroups,
  useCreateGroup,
  useJoinGroup,
  useJoinByInviteCode,
} from "../hooks";
import { AffiliateShopGroup, GroupsTab, CreateGroupData } from "../types";

export default function GroupsScreen() {
  const [activeTab, setActiveTab] = useState<GroupsTab>("My Groups");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joiningGroupId, setJoiningGroupId] = useState<string | null>(null);

  // Queries
  const {
    data: myGroups = [],
    isLoading: isLoadingMyGroups,
    refetch: refetchMyGroups,
  } = useMyGroups();

  const {
    data: allGroups = [],
    isLoading: isLoadingAllGroups,
    refetch: refetchAllGroups,
  } = useAllGroups();

  // Mutations
  const createGroupMutation = useCreateGroup();
  const joinGroupMutation = useJoinGroup();
  const joinByCodeMutation = useJoinByInviteCode();

  // Refetch on focus
  useFocusEffect(
    useCallback(() => {
      refetchMyGroups();
      refetchAllGroups();
    }, [])
  );

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetchMyGroups(), refetchAllGroups()]);
    setIsRefreshing(false);
  };

  const handleBack = () => {
    router.back();
  };

  const handleGroupPress = (group: AffiliateShopGroup) => {
    router.push(`/shop/groups/${group.groupId}` as any);
  };

  const handleCreateGroup = async (data: CreateGroupData) => {
    try {
      await createGroupMutation.mutateAsync(data);
      setShowCreateModal(false);
    } catch (error) {
      console.error("Failed to create group:", error);
    }
  };

  const handleJoinGroup = async (groupId: string) => {
    setJoiningGroupId(groupId);
    try {
      await joinGroupMutation.mutateAsync({ groupId });
    } catch (error) {
      console.error("Failed to join group:", error);
    } finally {
      setJoiningGroupId(null);
    }
  };

  const handleJoinByCode = async (inviteCode: string, message?: string) => {
    try {
      await joinByCodeMutation.mutateAsync({ inviteCode, requestMessage: message });
      setShowJoinModal(false);
    } catch (error) {
      console.error("Failed to join by code:", error);
    }
  };

  // Filter discover groups to exclude ones user is already a member of
  const discoverGroups = allGroups.filter(
    (group) =>
      !myGroups.some((myGroup) => myGroup.groupId === group.groupId)
  );

  const isLoading = activeTab === "My Groups" ? isLoadingMyGroups : isLoadingAllGroups;
  const groups = activeTab === "My Groups" ? myGroups : discoverGroups;

  const tabs: GroupsTab[] = ["My Groups", "Discover"];

  return (
    <View className="flex-1 bg-zinc-950">
      <AppHeader title="Affiliate Groups" onBackPress={handleBack} />

      {/* Tabs */}
      <View className="flex-row px-4 pt-4 pb-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`flex-1 py-3 rounded-lg mr-2 last:mr-0 ${
                isActive ? "bg-yellow-500" : "bg-zinc-900"
              }`}
            >
              <Text
                className={`text-center font-semibold ${
                  isActive ? "text-black" : "text-gray-400"
                }`}
              >
                {tab}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Action Buttons */}
      <View className="flex-row px-4 py-3 gap-3">
        <Pressable
          onPress={() => setShowCreateModal(true)}
          className="flex-1 flex-row items-center justify-center bg-yellow-500 rounded-lg py-3"
        >
          <Ionicons name="add" size={20} color="#000" />
          <Text className="text-black font-semibold ml-1">Create Group</Text>
        </Pressable>
        <Pressable
          onPress={() => setShowJoinModal(true)}
          className="flex-1 flex-row items-center justify-center bg-zinc-800 rounded-lg py-3 border border-zinc-700"
        >
          <Ionicons name="enter-outline" size={20} color="#fff" />
          <Text className="text-white font-semibold ml-1">Join by Code</Text>
        </Pressable>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#FFCC00"
          />
        }
      >
        {isLoading ? (
          <View className="items-center justify-center py-20">
            <ActivityIndicator size="large" color="#FFCC00" />
          </View>
        ) : groups.length === 0 ? (
          <View className="items-center justify-center py-20">
            <Ionicons name="people-outline" size={64} color="#333" />
            <Text className="text-gray-500 text-lg mt-4 text-center">
              {activeTab === "My Groups"
                ? "You haven't joined any groups yet"
                : "No groups available to discover"}
            </Text>
            <Text className="text-gray-600 text-sm mt-2 text-center px-8">
              {activeTab === "My Groups"
                ? "Create a new group or join one using an invite code"
                : "Be the first to create a group!"}
            </Text>
          </View>
        ) : (
          <View className="pb-6">
            {groups.map((group) => (
              <GroupCard
                key={group.groupId}
                group={group}
                onPress={() => handleGroupPress(group)}
                showJoinButton={activeTab === "Discover"}
                onJoin={() => handleJoinGroup(group.groupId)}
                isJoining={joiningGroupId === group.groupId}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Modals */}
      <CreateGroupModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateGroup}
        isSubmitting={createGroupMutation.isPending}
      />

      <JoinGroupModal
        visible={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onSubmit={handleJoinByCode}
        isSubmitting={joinByCodeMutation.isPending}
      />
    </View>
  );
}
