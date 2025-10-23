import { apiClient } from '@/utilities/axios';

interface CheckUserResponse {
  exists: boolean;
  type?: 'customer' | 'shop' | 'admin';
  user?: {
    id: string;
    address: string;
    walletAddress: string;
    name?: string;
    email?: string;
    tier?: string;
    active?: boolean;
    createdAt?: string;
  };
  error?: string;
  message?: string;
}

export const checkUserByWalletAddress = async (address: string): Promise<CheckUserResponse> => {
  try {
    return await apiClient.post<CheckUserResponse>('/auth/check-user', { address });
  } catch (error) {
    console.error('Failed to check user:', error);
    throw error;
  }
}