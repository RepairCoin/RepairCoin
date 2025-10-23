import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../config/queryClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface AuthUser {
  address: string;
  userType: 'customer' | 'shop';
  isAuthenticated: boolean;
}

interface LoginCredentials {
  walletAddress: string;
  signature?: string;
  userType: 'customer' | 'shop';
}

// Auth API functions
const getCurrentUser = async (): Promise<AuthUser | null> => {
  try {
    const token = await AsyncStorage.getItem('authToken');
    const userType = await AsyncStorage.getItem('userType');
    const walletAddress = await AsyncStorage.getItem('walletAddress');
    
    if (!token || !userType || !walletAddress) {
      return null;
    }
    
    return {
      address: walletAddress,
      userType: userType as 'customer' | 'shop',
      isAuthenticated: true,
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

const loginUser = async (credentials: LoginCredentials): Promise<{ token: string; user: AuthUser }> => {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  });
  
  if (!response.ok) {
    throw new Error('Login failed');
  }
  
  return response.json();
};

const logoutUser = async (): Promise<void> => {
  await Promise.all([
    AsyncStorage.removeItem('authToken'),
    AsyncStorage.removeItem('userType'),
    AsyncStorage.removeItem('walletAddress'),
  ]);
};

// React Query hooks
export const useAuth = () => {
  return useQuery({
    queryKey: queryKeys.authUser(),
    queryFn: getCurrentUser,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });
};

export const useLogin = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: loginUser,
    onSuccess: async (data) => {
      // Store auth data
      await Promise.all([
        AsyncStorage.setItem('authToken', data.token),
        AsyncStorage.setItem('userType', data.user.userType),
        AsyncStorage.setItem('walletAddress', data.user.address),
      ]);
      
      // Update auth query
      queryClient.setQueryData(queryKeys.authUser(), data.user);
      
      // Invalidate related queries based on user type
      if (data.user.userType === 'customer') {
        queryClient.invalidateQueries({
          queryKey: queryKeys.customerProfile(data.user.address),
        });
      } else if (data.user.userType === 'shop') {
        queryClient.invalidateQueries({
          queryKey: queryKeys.shopProfile(data.user.address),
        });
      }
    },
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: logoutUser,
    onSuccess: () => {
      // Clear all cached data
      queryClient.clear();
      
      // Reset auth state
      queryClient.setQueryData(queryKeys.authUser(), null);
    },
  });
};

export const useAuthToken = () => {
  return useQuery({
    queryKey: queryKeys.authSession(),
    queryFn: async () => {
      return await AsyncStorage.getItem('authToken');
    },
    staleTime: Infinity, // Don't refetch automatically
    retry: false,
  });
};

// Helper hook to check if user is authenticated
export const useIsAuthenticated = () => {
  const { data: user, isLoading } = useAuth();
  
  return {
    isAuthenticated: !!user?.isAuthenticated,
    userType: user?.userType,
    walletAddress: user?.address,
    isLoading,
  };
};