import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { groupsApi } from "../services";
import { CreateGroupData, MembershipStatus } from "../types";

// Query keys
export const groupsKeys = {
  all: ["groups"] as const,
  myGroups: () => [...groupsKeys.all, "my-groups"] as const,
  allGroups: () => [...groupsKeys.all, "all-groups"] as const,
  group: (groupId: string) => [...groupsKeys.all, "group", groupId] as const,
  members: (groupId: string, status?: MembershipStatus) =>
    [...groupsKeys.all, "members", groupId, status] as const,
  customers: (groupId: string) =>
    [...groupsKeys.all, "customers", groupId] as const,
  transactions: (groupId: string) =>
    [...groupsKeys.all, "transactions", groupId] as const,
  analytics: (groupId: string) =>
    [...groupsKeys.all, "analytics", groupId] as const,
  rcnAllocation: (groupId: string) =>
    [...groupsKeys.all, "rcn-allocation", groupId] as const,
};

// ============= Query Hooks =============

export function useMyGroups() {
  return useQuery({
    queryKey: groupsKeys.myGroups(),
    queryFn: () => groupsApi.getMyGroups(),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useAllGroups() {
  return useQuery({
    queryKey: groupsKeys.allGroups(),
    queryFn: () => groupsApi.getAllGroups(),
    staleTime: 1000 * 60 * 2,
  });
}

export function useGroup(groupId: string) {
  return useQuery({
    queryKey: groupsKeys.group(groupId),
    queryFn: () => groupsApi.getGroup(groupId),
    enabled: !!groupId,
  });
}

export function useGroupMembers(groupId: string, status?: MembershipStatus) {
  return useQuery({
    queryKey: groupsKeys.members(groupId, status),
    queryFn: () => groupsApi.getGroupMembers(groupId, status),
    enabled: !!groupId,
  });
}

export function useGroupAnalytics(groupId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: groupsKeys.analytics(groupId),
    queryFn: () => groupsApi.getGroupAnalytics(groupId),
    enabled: !!groupId && enabled,
  });
}

export function useGroupRcnAllocation(groupId: string) {
  return useQuery({
    queryKey: groupsKeys.rcnAllocation(groupId),
    queryFn: () => groupsApi.getGroupRcnAllocation(groupId),
    enabled: !!groupId,
  });
}

// ============= Mutation Hooks =============

export function useCreateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateGroupData) => groupsApi.createGroup(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupsKeys.myGroups() });
      queryClient.invalidateQueries({ queryKey: groupsKeys.allGroups() });
    },
  });
}

export function useJoinGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      groupId,
      requestMessage,
    }: {
      groupId: string;
      requestMessage?: string;
    }) => groupsApi.requestToJoinGroup(groupId, requestMessage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupsKeys.myGroups() });
      queryClient.invalidateQueries({ queryKey: groupsKeys.allGroups() });
    },
  });
}

export function useJoinByInviteCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      inviteCode,
      requestMessage,
    }: {
      inviteCode: string;
      requestMessage?: string;
    }) => groupsApi.joinByInviteCode(inviteCode, requestMessage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupsKeys.myGroups() });
      queryClient.invalidateQueries({ queryKey: groupsKeys.allGroups() });
    },
  });
}

export function useApproveMember(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (shopId: string) => groupsApi.approveMember(groupId, shopId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupsKeys.members(groupId) });
      queryClient.invalidateQueries({ queryKey: groupsKeys.group(groupId) });
    },
  });
}

export function useRejectMember(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (shopId: string) => groupsApi.rejectMember(groupId, shopId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupsKeys.members(groupId) });
    },
  });
}

export function useRemoveMember(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (shopId: string) => groupsApi.removeMember(groupId, shopId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupsKeys.members(groupId) });
      queryClient.invalidateQueries({ queryKey: groupsKeys.group(groupId) });
    },
  });
}
