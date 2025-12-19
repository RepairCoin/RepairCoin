// frontend/src/services/api/serviceGroups.ts
import apiClient from './client';

export interface ServiceGroupLink {
  id: number;
  serviceId: string;
  groupId: string;
  tokenRewardPercentage: number;
  bonusMultiplier: number;
  active: boolean;
  groupName?: string;
  customTokenName?: string;
  customTokenSymbol?: string;
  icon?: string;
}

/**
 * Link a service to an affiliate group
 */
export async function linkServiceToGroup(
  serviceId: string,
  groupId: string,
  tokenRewardPercentage: number = 100,
  bonusMultiplier: number = 1.0
): Promise<ServiceGroupLink> {
  const response = await apiClient.post(
    `/services/${serviceId}/groups/${groupId}`,
    { tokenRewardPercentage, bonusMultiplier }
  );
  return response.data; // Already unwrapped by interceptor
}

/**
 * Unlink service from group
 */
export async function unlinkServiceFromGroup(
  serviceId: string,
  groupId: string
): Promise<void> {
  await apiClient.delete(`/services/${serviceId}/groups/${groupId}`);
}

/**
 * Get all groups a service is linked to
 */
export async function getServiceGroups(serviceId: string): Promise<ServiceGroupLink[]> {
  const response = await apiClient.get(`/services/${serviceId}/groups`);
  return response.data || []; // Already unwrapped by interceptor
}

/**
 * Update group reward settings
 */
export async function updateServiceGroupRewards(
  serviceId: string,
  groupId: string,
  tokenRewardPercentage?: number,
  bonusMultiplier?: number
): Promise<ServiceGroupLink> {
  const response = await apiClient.put(
    `/services/${serviceId}/groups/${groupId}/rewards`,
    { tokenRewardPercentage, bonusMultiplier }
  );
  return response.data; // Already unwrapped by interceptor
}

export interface GroupService {
  serviceId: string;
  serviceName: string;
  description: string;
  priceUsd: number;
  category: string;
  imageUrl: string;
  shopId: string;
  shopName: string;
  location: string;
  averageRating?: number;
  reviewCount?: number;
}

/**
 * Get all services in a group
 */
export async function getGroupServices(
  groupId: string,
  filters?: {
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    search?: string;
  }
): Promise<GroupService[]> {
  const response = await apiClient.get(`/services/groups/${groupId}/services`, { params: filters });
  return response.data?.services || []; // Already unwrapped by interceptor
}

export const serviceGroupApi = {
  linkServiceToGroup,
  unlinkServiceFromGroup,
  getServiceGroups,
  updateServiceGroupRewards,
  getGroupServices
};
