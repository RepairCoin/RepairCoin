import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { useAppToast } from "@/shared/hooks/useAppToast";
import { useMyGroups } from "@/feature/groups/hooks/useGroups";
import {
  ServiceGroupLink,
  serviceGroupApi,
} from "@/feature/appointment/services/serviceGroup.services";

export default function ServiceGroupSettingsScreen() {
  const { serviceId, serviceName } = useLocalSearchParams<{
    serviceId: string;
    serviceName: string;
  }>();
  const { showSuccess, showError } = useAppToast();

  const [loading, setLoading] = useState(true);
  const [linkedGroups, setLinkedGroups] = useState<ServiceGroupLink[]>([]);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editRewardPct, setEditRewardPct] = useState("");
  const [editMultiplier, setEditMultiplier] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch shop's groups
  const { data: myGroups = [], isLoading: groupsLoading } = useMyGroups();

  const loadLinkedGroups = useCallback(async () => {
    if (!serviceId) return;
    try {
      const groups = await serviceGroupApi.getServiceGroups(serviceId);
      setLinkedGroups(groups);
    } catch {
      // Ignore - empty list is fine
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [serviceId]);

  useEffect(() => {
    loadLinkedGroups();
  }, [loadLinkedGroups]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadLinkedGroups();
  }, [loadLinkedGroups]);

  const isLinked = (groupId: string) =>
    linkedGroups.some((lg) => lg.groupId === groupId);

  const handleLink = async (groupId: string) => {
    setSaving(true);
    try {
      await serviceGroupApi.linkServiceToGroup(serviceId!, groupId);
      showSuccess("Service linked to group");
      await loadLinkedGroups();
    } catch (err: any) {
      if (err?.response?.status === 409) {
        showError("Already linked to this group");
      } else {
        showError("Failed to link service");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = (groupId: string, groupName?: string) => {
    Alert.alert(
      "Unlink Service",
      `Remove this service from ${groupName || "group"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unlink",
          style: "destructive",
          onPress: async () => {
            try {
              await serviceGroupApi.unlinkServiceFromGroup(
                serviceId!,
                groupId
              );
              showSuccess("Service unlinked");
              await loadLinkedGroups();
            } catch {
              showError("Failed to unlink");
            }
          },
        },
      ]
    );
  };

  const startEditRewards = (link: ServiceGroupLink) => {
    setEditingGroup(link.groupId);
    setEditRewardPct(String(link.tokenRewardPercentage));
    setEditMultiplier(String(link.bonusMultiplier));
  };

  const saveRewards = async () => {
    if (!editingGroup) return;
    setSaving(true);
    try {
      await serviceGroupApi.updateServiceGroupRewards(
        serviceId!,
        editingGroup,
        parseInt(editRewardPct) || 100,
        parseFloat(editMultiplier) || 1.0
      );
      showSuccess("Rewards updated");
      setEditingGroup(null);
      await loadLinkedGroups();
    } catch {
      showError("Failed to update rewards");
    } finally {
      setSaving(false);
    }
  };

  const isDataLoading = loading || groupsLoading;

  return (
    <View className="flex-1 bg-zinc-950">
      {/* Header */}
      <View className="pt-14 px-4 pb-3 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-9 h-9 rounded-full bg-[#1a1a1a] items-center justify-center"
        >
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View className="flex-1 mx-3 items-center">
          <Text className="text-white text-lg font-bold" numberOfLines={1}>
            Group Rewards
          </Text>
          {serviceName && (
            <Text className="text-gray-500 text-xs" numberOfLines={1}>
              {serviceName}
            </Text>
          )}
        </View>
        <View className="w-9" />
      </View>

      {isDataLoading && !refreshing ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FFCC00" />
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-4"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 30 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#FFCC00"
              colors={["#FFCC00"]}
            />
          }
        >
          {/* Linked Groups */}
          {linkedGroups.length > 0 && (
            <>
              <Text className="text-white font-semibold text-base mb-3">
                Linked Groups
              </Text>
              {linkedGroups.map((link) => {
                const isEditing = editingGroup === link.groupId;
                return (
                  <View
                    key={link.groupId}
                    className="bg-[#1a1a1a] rounded-xl p-4 mb-3 border-l-4 border-purple-500"
                  >
                    <View className="flex-row items-start justify-between">
                      <View className="flex-1 mr-3">
                        <Text className="text-white font-semibold">
                          {link.groupName || "Group"}
                        </Text>
                        {link.customTokenSymbol && (
                          <Text className="text-purple-400 text-xs mt-0.5">
                            Token: {link.customTokenSymbol}
                          </Text>
                        )}
                      </View>
                      <View className="flex-row gap-2">
                        <TouchableOpacity
                          onPress={() =>
                            isEditing
                              ? setEditingGroup(null)
                              : startEditRewards(link)
                          }
                          className="w-8 h-8 rounded-full bg-purple-500/10 items-center justify-center"
                        >
                          <Ionicons
                            name={isEditing ? "close" : "pencil"}
                            size={14}
                            color="#a855f7"
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() =>
                            handleUnlink(link.groupId, link.groupName)
                          }
                          className="w-8 h-8 rounded-full bg-red-500/10 items-center justify-center"
                        >
                          <Ionicons
                            name="trash-outline"
                            size={14}
                            color="#ef4444"
                          />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Current values */}
                    {!isEditing && (
                      <View className="flex-row mt-3 gap-4">
                        <View className="bg-purple-500/10 px-3 py-1.5 rounded-lg">
                          <Text className="text-purple-400 text-xs">
                            Reward: {link.tokenRewardPercentage}%
                          </Text>
                        </View>
                        <View className="bg-purple-500/10 px-3 py-1.5 rounded-lg">
                          <Text className="text-purple-400 text-xs">
                            Multiplier: {link.bonusMultiplier}x
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Edit mode */}
                    {isEditing && (
                      <View className="mt-3 border-t border-zinc-800 pt-3">
                        <View className="flex-row gap-3 mb-3">
                          <View className="flex-1">
                            <Text className="text-gray-400 text-xs mb-1">
                              Reward %
                            </Text>
                            <TextInput
                              className="bg-[#2a2a2c] rounded-lg px-3 h-10 text-white text-sm text-center"
                              value={editRewardPct}
                              onChangeText={setEditRewardPct}
                              keyboardType="number-pad"
                              placeholder="100"
                              placeholderTextColor="#666"
                            />
                            <Text className="text-gray-600 text-xs mt-0.5">
                              0-500%
                            </Text>
                          </View>
                          <View className="flex-1">
                            <Text className="text-gray-400 text-xs mb-1">
                              Multiplier
                            </Text>
                            <TextInput
                              className="bg-[#2a2a2c] rounded-lg px-3 h-10 text-white text-sm text-center"
                              value={editMultiplier}
                              onChangeText={setEditMultiplier}
                              keyboardType="decimal-pad"
                              placeholder="1.0"
                              placeholderTextColor="#666"
                            />
                            <Text className="text-gray-600 text-xs mt-0.5">
                              0-10x
                            </Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          onPress={saveRewards}
                          disabled={saving}
                          className="bg-purple-500 rounded-xl py-3 items-center"
                        >
                          {saving ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text className="text-white font-bold text-sm">
                              Save Rewards
                            </Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </>
          )}

          {/* Available Groups to Link */}
          <Text className="text-white font-semibold text-base mb-3 mt-2">
            Available Groups
          </Text>
          {myGroups.length === 0 ? (
            <View className="bg-[#1a1a1a] rounded-xl p-6 items-center">
              <Ionicons name="people-outline" size={40} color="#333" />
              <Text className="text-gray-500 mt-3 text-sm">
                No affiliate groups found
              </Text>
              <Text className="text-gray-600 text-xs mt-1">
                Join or create a group first
              </Text>
            </View>
          ) : (
            myGroups
              .filter((g) => !isLinked(g.groupId))
              .map((group) => (
                <View
                  key={group.groupId}
                  className="bg-[#1a1a1a] rounded-xl p-4 mb-3 flex-row items-center justify-between"
                >
                  <View className="flex-1 mr-3">
                    <Text className="text-white font-medium">
                      {group.groupName}
                    </Text>
                    {group.customTokenSymbol && (
                      <Text className="text-gray-500 text-xs mt-0.5">
                        Token: {group.customTokenSymbol}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => handleLink(group.groupId)}
                    disabled={saving}
                    className="bg-purple-500 px-4 py-2 rounded-lg"
                  >
                    <Text className="text-white font-semibold text-sm">
                      Link
                    </Text>
                  </TouchableOpacity>
                </View>
              ))
          )}

          {myGroups.length > 0 &&
            myGroups.filter((g) => !isLinked(g.groupId)).length === 0 &&
            linkedGroups.length > 0 && (
              <View className="bg-[#1a1a1a] rounded-xl p-4 items-center">
                <Text className="text-gray-500 text-sm">
                  All groups are linked
                </Text>
              </View>
            )}
        </ScrollView>
      )}
    </View>
  );
}
