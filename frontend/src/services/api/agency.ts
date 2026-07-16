import apiClient from './client';

export interface AgencyManagerContact {
  name: string | null;
  email: string | null;
  phone: string | null;
}

export interface Agency {
  id: string;
  name: string;
  ownerShopId: string;
  contactEmail: string | null;
  contactPhone: string | null;
  status: 'pending' | 'active' | 'past_due' | 'cancelled';
  clientLimit: number;
  perClientPriceCents: number;
  accountManagerAddress: string | null;
}

export interface AgencyProfile {
  agency: Agency;
  activeClientCount: number;
  clientLimit: number;
  accountManager: AgencyManagerContact | null;
}

export interface AgencyClient {
  shopId: string;
  name: string;
  email: string | null;
  active: boolean;
  city: string | null;
  country: string | null;
  addedAt: string;
}

export interface CreateClientInput {
  shopId: string;
  name: string;
  walletAddress: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface ActivateAgencyInput {
  name?: string;
  billingEmail?: string;
  billingContact?: string;
}

export interface AgencyInvite {
  token: string;
  agencyId: string;
  label: string | null;
  status: 'pending' | 'accepted' | 'revoked';
  createdAt: string;
  url: string;
}

export const agencyApi = {
  getMe: async () => apiClient.get('/agency/me'),

  // Self-serve activation → returns a Stripe checkout URL to redirect to.
  activate: async (data: ActivateAgencyInput = {}) =>
    apiClient.post('/agency/activate', data),

  // Self-serve cancel → schedules cancellation at the end of the billing period.
  cancel: async () => apiClient.post('/agency/cancel', {}),
  getClients: async () => apiClient.get('/agency/clients'),
  createClient: async (data: CreateClientInput) => apiClient.post('/agency/clients', data),
  removeClient: async (shopId: string) => apiClient.delete(`/agency/clients/${shopId}`),

  // Client invites — agency mints a link, client self-signs-up with their own wallet.
  createInvite: async (label?: string) => apiClient.post('/agency/invites', { label }),
  listInvites: async () => apiClient.get('/agency/invites'),
  revokeInvite: async (token: string) => apiClient.delete(`/agency/invites/${token}`),
  getInviteInfo: async (token: string) => apiClient.get(`/agency/invite-info/${token}`),

  // Session act-as controls
  enterClient: async (shopId: string) => apiClient.post('/auth/agency/enter', { shopId }),
  resume: async () => apiClient.post('/auth/agency/resume', {}),
  getContext: async () => apiClient.get('/auth/agency/context'),
} as const;
