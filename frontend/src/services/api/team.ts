import apiClient from './client';

export type TeamRole = 'owner' | 'manager' | 'staff' | 'custom';
export type TeamStatus = 'invited' | 'active' | 'suspended' | 'removed';

export interface TeamMember {
  id: string;
  shopId: string;
  email: string;
  name: string | null;
  walletAddress: string | null;
  role: TeamRole;
  permissions: string[];
  status: TeamStatus;
  invitedAt: string | null;
  acceptedAt: string | null;
}

export interface InviteMemberInput {
  email: string;
  name?: string;
  role: Exclude<TeamRole, 'owner'>;
  permissions?: string[];
}

export interface UpdateMemberInput {
  name?: string;
  role?: Exclude<TeamRole, 'owner'>;
  permissions?: string[];
}

// All shop-scoped permission strings (kept in sync with backend shop/permissions.ts).
export const SHOP_PERMISSIONS: { value: string; label: string }[] = [
  { value: 'inventory:view', label: 'View inventory' },
  { value: 'inventory:manage', label: 'Manage inventory' },
  { value: 'pos:view', label: 'View purchase orders' },
  { value: 'pos:manage', label: 'Manage purchase orders' },
  { value: 'services:manage', label: 'Manage services' },
  { value: 'bookings:view', label: 'View bookings' },
  { value: 'bookings:manage', label: 'Manage bookings' },
  { value: 'rewards:issue', label: 'Issue rewards' },
  { value: 'rewards:redeem', label: 'Process redemptions' },
  { value: 'customers:view', label: 'Customer lookup' },
  { value: 'analytics:view', label: 'View analytics' },
  { value: 'billing:manage', label: 'Manage billing' },
  { value: 'team:manage', label: 'Manage team' },
  { value: 'shop:manage', label: 'Manage shop profile & settings' },
  { value: 'marketing:manage', label: 'Manage marketing & ads' },
];

export const getTeamMembers = async (): Promise<TeamMember[]> => {
  const res = await apiClient.get<{ success: boolean; data: TeamMember[] }>('/shops/team');
  return res.data || [];
};

export interface InviteResult {
  member: TeamMember;
  emailSent: boolean;
  acceptUrl: string;
}

export const inviteMember = async (input: InviteMemberInput): Promise<InviteResult> => {
  const res = await apiClient.post<{ success: boolean; data: TeamMember; emailSent: boolean; acceptUrl: string }>(
    '/shops/team/invite',
    input
  );
  return { member: res.data, emailSent: res.emailSent, acceptUrl: res.acceptUrl };
};

export const resendInvite = async (memberId: string): Promise<InviteResult> => {
  const res = await apiClient.post<{ success: boolean; data: TeamMember; emailSent: boolean; acceptUrl: string }>(
    `/shops/team/${memberId}/resend`
  );
  return { member: res.data, emailSent: res.emailSent, acceptUrl: res.acceptUrl };
};

export const updateMember = async (
  memberId: string,
  input: UpdateMemberInput
): Promise<TeamMember> => {
  const res = await apiClient.put<{ success: boolean; data: TeamMember }>(
    `/shops/team/${memberId}`,
    input
  );
  return res.data;
};

export const suspendMember = async (memberId: string): Promise<TeamMember> => {
  const res = await apiClient.post<{ success: boolean; data: TeamMember }>(
    `/shops/team/${memberId}/suspend`
  );
  return res.data;
};

export const removeMember = async (memberId: string): Promise<void> => {
  await apiClient.delete(`/shops/team/${memberId}`);
};

// Public — used by the invite-accept page.
export const acceptInvite = async (
  token: string,
  walletAddress: string
): Promise<{ shopId: string; role: string; email: string }> => {
  const res = await apiClient.post<{ success: boolean; data: { shopId: string; role: string; email: string } }>(
    '/shops/team/accept',
    { token, walletAddress }
  );
  return res.data;
};
