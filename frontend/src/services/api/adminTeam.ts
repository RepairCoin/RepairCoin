import apiClient from './client';
import type { TeamMember, UpdateMemberInput } from './team';

export const getShopTeam = async (shopId: string): Promise<TeamMember[]> => {
  const res = await apiClient.get<{ success: boolean; data: TeamMember[] }>(
    `/admin/shops/${shopId}/team`
  );
  return res.data || [];
};

export const updateShopTeamMember = async (
  shopId: string,
  memberId: string,
  input: UpdateMemberInput
): Promise<TeamMember> => {
  const res = await apiClient.put<{ success: boolean; data: TeamMember }>(
    `/admin/shops/${shopId}/team/${memberId}`,
    input
  );
  return res.data;
};

export const suspendShopTeamMember = async (
  shopId: string,
  memberId: string
): Promise<TeamMember> => {
  const res = await apiClient.post<{ success: boolean; data: TeamMember }>(
    `/admin/shops/${shopId}/team/${memberId}/suspend`
  );
  return res.data;
};

export const reactivateShopTeamMember = async (
  shopId: string,
  memberId: string
): Promise<TeamMember> => {
  const res = await apiClient.post<{ success: boolean; data: TeamMember }>(
    `/admin/shops/${shopId}/team/${memberId}/reactivate`
  );
  return res.data;
};

export const removeShopTeamMember = async (
  shopId: string,
  memberId: string
): Promise<void> => {
  await apiClient.delete(`/admin/shops/${shopId}/team/${memberId}`);
};
