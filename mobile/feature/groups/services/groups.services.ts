import apiClient from "@/shared/utilities/axios";
import {
  AffiliateShopGroup,
  AffiliateShopGroupMember,
  CreateGroupData,
  UpdateGroupData,
  EarnTokensData,
  RedeemTokensData,
  CustomerAffiliateGroupBalance,
  AffiliateGroupTokenTransaction,
  GroupAnalytics,
  MemberActivityStat,
  TransactionTrend,
  ShopGroupRcnAllocation,
  PaginationInfo,
  MembershipStatus,
} from "../types";

// Helper to map backend groupType to frontend isPrivate
const mapGroup = (group: any): AffiliateShopGroup => ({
  ...group,
  isPrivate: group.groupType === "private",
  customTokenName: group.customTokenName || null,
  customTokenSymbol: group.customTokenSymbol || null,
  inviteCode: group.inviteCode || null,
});

class GroupsApi {
  // ============= Group Management =============

  async createGroup(data: CreateGroupData): Promise<AffiliateShopGroup> {
    try {
      const response = await apiClient.post<AffiliateShopGroup>(
        "/affiliate-shop-groups",
        data
      );
      return mapGroup(response);
    } catch (error) {
      console.error("[GroupsApi] Failed to create group:", error);
      throw error;
    }
  }

  async getAllGroups(): Promise<AffiliateShopGroup[]> {
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: any[];
      }>("/affiliate-shop-groups");
      const groups = (response as any).data || [];
      return groups.map(mapGroup);
    } catch (error) {
      console.error("[GroupsApi] Failed to get all groups:", error);
      return [];
    }
  }

  async getMyGroups(): Promise<AffiliateShopGroup[]> {
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: any[];
      }>("/affiliate-shop-groups/my-groups");
      const groups = (response as any).data || [];
      return groups.map(mapGroup);
    } catch (error) {
      console.error("[GroupsApi] Failed to get my groups:", error);
      return [];
    }
  }

  async getGroup(groupId: string): Promise<AffiliateShopGroup | null> {
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: any;
      }>(`/affiliate-shop-groups/${groupId}`);
      const data = (response as any).data;
      if (!data) return null;
      return mapGroup(data);
    } catch (error) {
      console.error("[GroupsApi] Failed to get group:", error);
      return null;
    }
  }

  async updateGroup(
    groupId: string,
    data: UpdateGroupData
  ): Promise<AffiliateShopGroup | null> {
    try {
      const response = await apiClient.put<AffiliateShopGroup>(
        `/affiliate-shop-groups/${groupId}`,
        data
      );
      return mapGroup(response);
    } catch (error) {
      console.error("[GroupsApi] Failed to update group:", error);
      throw error;
    }
  }

  // ============= Membership Management =============

  async requestToJoinGroup(
    groupId: string,
    requestMessage?: string
  ): Promise<AffiliateShopGroupMember | null> {
    try {
      const response = await apiClient.post<AffiliateShopGroupMember>(
        `/affiliate-shop-groups/${groupId}/join`,
        { requestMessage }
      );
      return response || null;
    } catch (error) {
      console.error("[GroupsApi] Failed to request to join group:", error);
      throw error;
    }
  }

  async joinByInviteCode(
    inviteCode: string,
    requestMessage?: string
  ): Promise<AffiliateShopGroupMember | null> {
    try {
      const response = await apiClient.post<AffiliateShopGroupMember>(
        "/affiliate-shop-groups/join-by-code",
        { inviteCode, requestMessage }
      );
      return response || null;
    } catch (error) {
      console.error("[GroupsApi] Failed to join by invite code:", error);
      throw error;
    }
  }

  async getGroupMembers(
    groupId: string,
    status?: MembershipStatus
  ): Promise<AffiliateShopGroupMember[]> {
    try {
      const queryString = status ? `?status=${status}` : "";
      const response = await apiClient.get<{
        success: boolean;
        data: AffiliateShopGroupMember[] | { memberCount: number };
      }>(`/affiliate-shop-groups/${groupId}/members${queryString}`);

      const data = (response as any).data;
      if (!Array.isArray(data)) {
        return [];
      }
      return data || [];
    } catch (error) {
      console.error("[GroupsApi] Failed to get group members:", error);
      return [];
    }
  }

  async approveMember(
    groupId: string,
    shopId: string
  ): Promise<AffiliateShopGroupMember | null> {
    try {
      const response = await apiClient.post<AffiliateShopGroupMember>(
        `/affiliate-shop-groups/${groupId}/members/${shopId}/approve`
      );
      return response || null;
    } catch (error) {
      console.error("[GroupsApi] Failed to approve member:", error);
      throw error;
    }
  }

  async rejectMember(groupId: string, shopId: string): Promise<void> {
    try {
      await apiClient.post(
        `/affiliate-shop-groups/${groupId}/members/${shopId}/reject`
      );
    } catch (error) {
      console.error("[GroupsApi] Failed to reject member:", error);
      throw error;
    }
  }

  async removeMember(groupId: string, shopId: string): Promise<void> {
    try {
      await apiClient.delete(
        `/affiliate-shop-groups/${groupId}/members/${shopId}`
      );
    } catch (error) {
      console.error("[GroupsApi] Failed to remove member:", error);
      throw error;
    }
  }

  // ============= Token Operations =============

  async earnGroupTokens(
    groupId: string,
    data: EarnTokensData
  ): Promise<{
    transaction: AffiliateGroupTokenTransaction;
    newBalance: number;
    lifetimeEarned: number;
  } | null> {
    try {
      const response = await apiClient.post<{
        transaction: AffiliateGroupTokenTransaction;
        newBalance: number;
        lifetimeEarned: number;
      }>(`/affiliate-shop-groups/${groupId}/tokens/earn`, data);
      return response || null;
    } catch (error) {
      console.error("[GroupsApi] Failed to earn group tokens:", error);
      throw error;
    }
  }

  async redeemGroupTokens(
    groupId: string,
    data: RedeemTokensData
  ): Promise<{
    transaction: AffiliateGroupTokenTransaction;
    newBalance: number;
    lifetimeRedeemed: number;
  } | null> {
    try {
      const response = await apiClient.post<{
        transaction: AffiliateGroupTokenTransaction;
        newBalance: number;
        lifetimeRedeemed: number;
      }>(`/affiliate-shop-groups/${groupId}/tokens/redeem`, data);
      return response || null;
    } catch (error) {
      console.error("[GroupsApi] Failed to redeem group tokens:", error);
      throw error;
    }
  }

  async getCustomerBalance(
    groupId: string,
    customerAddress: string
  ): Promise<CustomerAffiliateGroupBalance | null> {
    try {
      const response = await apiClient.get<CustomerAffiliateGroupBalance>(
        `/affiliate-shop-groups/${groupId}/balance/${customerAddress}`
      );
      return response || null;
    } catch (error) {
      console.error("[GroupsApi] Failed to get customer balance:", error);
      return null;
    }
  }

  async getGroupCustomers(
    groupId: string,
    params?: { page?: number; limit?: number; search?: string }
  ): Promise<{
    items: CustomerAffiliateGroupBalance[];
    pagination: PaginationInfo;
  }> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append("page", params.page.toString());
      if (params?.limit) queryParams.append("limit", params.limit.toString());
      if (params?.search) queryParams.append("search", params.search);

      const queryString = queryParams.toString();
      const response = await apiClient.get<{
        success: boolean;
        data: CustomerAffiliateGroupBalance[];
        pagination: PaginationInfo;
      }>(
        `/affiliate-shop-groups/${groupId}/customers${queryString ? `?${queryString}` : ""}`
      );

      return {
        items: (response as any).data || [],
        pagination: (response as any).pagination || {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasMore: false,
        },
      };
    } catch (error) {
      console.error("[GroupsApi] Failed to get group customers:", error);
      return {
        items: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasMore: false,
        },
      };
    }
  }

  async getGroupTransactions(
    groupId: string,
    params?: { page?: number; limit?: number; type?: "earn" | "redeem" }
  ): Promise<{
    items: AffiliateGroupTokenTransaction[];
    pagination: PaginationInfo;
  }> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append("page", params.page.toString());
      if (params?.limit) queryParams.append("limit", params.limit.toString());
      if (params?.type) queryParams.append("type", params.type);

      const queryString = queryParams.toString();
      const response = await apiClient.get<any>(
        `/affiliate-shop-groups/${groupId}/transactions${queryString ? `?${queryString}` : ""}`
      );

      if (Array.isArray(response)) {
        return {
          items: response,
          pagination: {
            page: 1,
            limit: response.length,
            total: response.length,
            totalPages: 1,
          },
        };
      } else if (response?.data) {
        return response.data;
      }
      return {
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };
    } catch (error) {
      console.error("[GroupsApi] Failed to get group transactions:", error);
      return {
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };
    }
  }

  // ============= Analytics =============

  async getGroupAnalytics(groupId: string): Promise<GroupAnalytics | null> {
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: GroupAnalytics;
      }>(`/affiliate-shop-groups/${groupId}/analytics`);
      return (response as any).data || null;
    } catch (error) {
      console.error("[GroupsApi] Failed to get group analytics:", error);
      return null;
    }
  }

  async getMemberActivityStats(groupId: string): Promise<MemberActivityStat[]> {
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: MemberActivityStat[];
      }>(`/affiliate-shop-groups/${groupId}/analytics/members`);
      return (response as any).data || [];
    } catch (error) {
      console.error("[GroupsApi] Failed to get member activity stats:", error);
      return [];
    }
  }

  async getTransactionTrends(
    groupId: string,
    days: number = 30
  ): Promise<TransactionTrend[]> {
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: TransactionTrend[];
      }>(`/affiliate-shop-groups/${groupId}/analytics/trends?days=${days}`);
      return (response as any).data || [];
    } catch (error) {
      console.error("[GroupsApi] Failed to get transaction trends:", error);
      return [];
    }
  }

  // ============= RCN Allocation =============

  async allocateRcnToGroup(
    groupId: string,
    amount: number
  ): Promise<{
    allocation: ShopGroupRcnAllocation;
    shopRemainingBalance: number;
  } | null> {
    try {
      const response = await apiClient.post<{
        allocation: ShopGroupRcnAllocation;
        shopRemainingBalance: number;
        message: string;
      }>(`/affiliate-shop-groups/${groupId}/rcn/allocate`, { amount });
      return response || null;
    } catch (error) {
      console.error("[GroupsApi] Failed to allocate RCN:", error);
      throw error;
    }
  }

  async deallocateRcnFromGroup(
    groupId: string,
    amount: number
  ): Promise<{
    allocation: ShopGroupRcnAllocation;
    shopNewBalance: number;
  } | null> {
    try {
      const response = await apiClient.post<{
        allocation: ShopGroupRcnAllocation;
        shopNewBalance: number;
        message: string;
      }>(`/affiliate-shop-groups/${groupId}/rcn/deallocate`, { amount });
      return response || null;
    } catch (error) {
      console.error("[GroupsApi] Failed to deallocate RCN:", error);
      throw error;
    }
  }

  async getGroupRcnAllocation(
    groupId: string
  ): Promise<ShopGroupRcnAllocation | null> {
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: ShopGroupRcnAllocation;
      }>(`/affiliate-shop-groups/${groupId}/rcn/allocation`);
      return (response as any).data || null;
    } catch (error) {
      console.error("[GroupsApi] Failed to get group RCN allocation:", error);
      return null;
    }
  }

  async getAllRcnAllocations(): Promise<ShopGroupRcnAllocation[]> {
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: ShopGroupRcnAllocation[];
      }>("/affiliate-shop-groups/rcn/allocations");
      return (response as any).data || [];
    } catch (error) {
      console.error("[GroupsApi] Failed to get all RCN allocations:", error);
      return [];
    }
  }
}

export const groupsApi = new GroupsApi();
