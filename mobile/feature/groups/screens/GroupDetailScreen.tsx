import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import { useGroup, useGroupMembers, useGroupAnalytics } from "../hooks";
import {
  OverviewTab,
  MembersTab,
  TokenOperationsTab,
  TransactionsTab,
  AnalyticsTab,
} from "../components/tabs";

type DetailTab = "Overview" | "Members" | "Tokens" | "History" | "Analytics";

export default function GroupDetailScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const [activeTab, setActiveTab] = useState<DetailTab>("Overview");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    data: group,
    isLoading,
    refetch: refetchGroup,
  } = useGroup(groupId || "");

  // Derive membership status from group data
  const isAdmin = group?.role === "admin";
  const isMember = group?.membershipStatus === "active";

  const { refetch: refetchMembers } = useGroupMembers(groupId || "");
  // Only fetch analytics if user is an admin (analytics tab is admin-only)
  const { refetch: refetchAnalytics } = useGroupAnalytics(groupId || "", isAdmin);

  useFocusEffect(
    useCallback(() => {
      if (groupId) {
        refetchGroup();
      }
    }, [groupId])
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    const promises: Promise<unknown>[] = [refetchGroup(), refetchMembers()];
    if (isAdmin) {
      promises.push(refetchAnalytics());
    }
    await Promise.all(promises);
    setIsRefreshing(false);
  };

  const handleBack = () => {
    router.back();
  };

  const handleCopyInviteCode = async () => {
    if (group?.inviteCode) {
      await Clipboard.setStringAsync(group.inviteCode);
    }
  };

  // Only show tabs for members and admins
  const tabs: DetailTab[] = isAdmin
    ? ["Overview", "Members", "Tokens", "History", "Analytics"]
    : isMember
      ? ["Overview", "Members", "Tokens", "History"]
      : [];

  const showTabs = tabs.length > 0;

  if (isLoading) {
    return (
      <View className="flex-1 bg-zinc-950 items-center justify-center">
        <ActivityIndicator size="large" color="#FFCC00" />
      </View>
    );
  }

  if (!group) {
    return (
      <View className="flex-1 bg-zinc-950">
        <AppHeader title="Group" onBackPress={handleBack} />
        <View className="flex-1 items-center justify-center">
          <Ionicons name="alert-circle-outline" size={64} color="#666" />
          <Text className="text-gray-500 text-lg mt-4">Group not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-zinc-950">
      <AppHeader onBackPress={handleBack} />

      {/* Group Header */}
      <View className="px-4 pb-4 border-b border-zinc-800">
        <View className="flex-row items-center">
          {/* Icon */}
          <View className="w-16 h-16 rounded-full bg-zinc-800 items-center justify-center mr-4">
            {group.icon ? (
              <Text className="text-3xl">{group.icon}</Text>
            ) : (
              <Ionicons name="people" size={32} color="#FFCC00" />
            )}
          </View>

          {/* Info */}
          <View className="flex-1">
            <View className="flex-row items-center flex-wrap gap-2">
              <Text className="text-white font-bold text-xl">
                {group.groupName}
              </Text>
              {isAdmin && (
                <View className="bg-yellow-500/20 px-2 py-0.5 rounded">
                  <Text className="text-yellow-500 text-xs font-medium">
                    Leader
                  </Text>
                </View>
              )}
            </View>

            {/* Token info */}
            {group.customTokenSymbol && (
              <View className="flex-row items-center mt-1">
                <View className="bg-purple-500/20 px-2 py-0.5 rounded">
                  <Text className="text-purple-400 text-sm font-medium">
                    {group.customTokenSymbol}
                  </Text>
                </View>
                {group.customTokenName && (
                  <Text className="text-gray-500 text-sm ml-2">
                    {group.customTokenName}
                  </Text>
                )}
              </View>
            )}

            {/* Stats */}
            <View className="flex-row items-center mt-2 gap-4">
              <View className="flex-row items-center">
                <Ionicons name="people-outline" size={14} color="#666" />
                <Text className="text-gray-500 text-sm ml-1">
                  {group.memberCount || 0} members
                </Text>
              </View>
              <View className="flex-row items-center">
                <Ionicons
                  name={group.isPrivate ? "lock-closed" : "globe-outline"}
                  size={14}
                  color="#666"
                />
                <Text className="text-gray-500 text-sm ml-1">
                  {group.isPrivate ? "Private" : "Public"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Invite Code (Admin only) */}
        {isAdmin && group.inviteCode && (
          <Pressable
            onPress={handleCopyInviteCode}
            className="flex-row items-center justify-between bg-zinc-900 rounded-lg p-3 mt-4 border border-zinc-800"
          >
            <View className="flex-row items-center">
              <Ionicons name="key-outline" size={18} color="#FFCC00" />
              <Text className="text-gray-400 text-sm ml-2">Invite Code:</Text>
              <Text className="text-white font-mono ml-2">
                {group.inviteCode}
              </Text>
            </View>
            <Ionicons name="copy-outline" size={18} color="#666" />
          </Pressable>
        )}
      </View>

      {/* Tabs - only shown for members and admins */}
      {showTabs && (
        <View className="h-12 border-b border-zinc-800">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, alignItems: "center" }}
            className="flex-1"
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab;
              return (
                <Pressable
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  className={`h-12 px-4 mr-2 justify-center border-b-2 ${
                    isActive ? "border-yellow-500" : "border-transparent"
                  }`}
                >
                  <Text
                    className={`font-medium ${
                      isActive ? "text-yellow-500" : "text-gray-500"
                    }`}
                  >
                    {tab}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Tab Content */}
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#FFCC00"
          />
        }
      >
        {showTabs ? (
          <>
            {activeTab === "Overview" && <OverviewTab group={group} />}
            {activeTab === "Members" && (
              <MembersTab groupId={groupId!} isAdmin={isAdmin} />
            )}
            {activeTab === "Tokens" && (
              <TokenOperationsTab groupId={groupId!} group={group} />
            )}
            {activeTab === "History" && <TransactionsTab groupId={groupId!} />}
            {activeTab === "Analytics" && <AnalyticsTab groupId={groupId!} />}
          </>
        ) : (
          /* Non-members see overview content directly without tabs */
          <OverviewTab group={group} />
        )}
      </ScrollView>
    </View>
  );
}
