import React from 'react';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import { useCustomer, useCustomerWithBalance } from '../hooks/useCustomerQueries';
import { useShops, useShop } from '../hooks/useShopQueries';
import { useAuth, useLogin, useLogout } from '../hooks/useAuthQueries';

// Example 1: Simple customer data fetching
export const CustomerProfile = ({ walletAddress }: { walletAddress: string }) => {
  const { data: customer, isLoading, error, refetch } = useCustomer(walletAddress);

  if (isLoading) return <ActivityIndicator size="large" />;
  if (error) return <Text>Error loading customer data</Text>;

  return (
    <View>
      <Text>Name: {customer?.data?.customer?.name}</Text>
      <Text>Tier: {customer?.data?.customer?.tier}</Text>
      <Text>Lifetime Earnings: {customer?.data?.customer?.lifetimeEarnings}</Text>
      <Pressable onPress={() => refetch()}>
        <Text>Refresh Data</Text>
      </Pressable>
    </View>
  );
};

// Example 2: Customer with balance (combined data)
export const CustomerWallet = ({ walletAddress }: { walletAddress: string }) => {
  const { 
    data: { customer, balance }, 
    isLoading, 
    error, 
    refetch 
  } = useCustomerWithBalance(walletAddress);

  if (isLoading) return <ActivityIndicator size="large" />;
  if (error) return <Text>Error loading wallet data</Text>;

  return (
    <View>
      <Text>Balance: {balance?.balance || 0} RCN</Text>
      <Text>Customer: {customer?.data?.customer?.name}</Text>
      <Pressable onPress={() => refetch()}>
        <Text>Refresh Wallet</Text>
      </Pressable>
    </View>
  );
};

// Example 3: Shops list with loading states
export const ShopsList = () => {
  const { data: shops, isLoading, error } = useShops();

  if (isLoading) return <ActivityIndicator size="large" />;
  if (error) return <Text>Error loading shops</Text>;

  return (
    <View>
      <Text>Available Shops:</Text>
      {shops?.data?.shops?.map((shop: any) => (
        <View key={shop.id}>
          <Text>{shop.name}</Text>
          <Text>{shop.address}</Text>
        </View>
      ))}
    </View>
  );
};

// Example 4: Individual shop details
export const ShopDetails = ({ shopId }: { shopId: string }) => {
  const { data: shop, isLoading, error } = useShop(shopId);

  if (isLoading) return <ActivityIndicator size="large" />;
  if (error) return <Text>Shop not found</Text>;

  return (
    <View>
      <Text>Shop: {shop?.data?.shop?.name}</Text>
      <Text>Status: {shop?.data?.shop?.status}</Text>
      <Text>Tier: {shop?.data?.shop?.tier}</Text>
    </View>
  );
};

// Example 5: Authentication with React Query
export const AuthExample = () => {
  const { data: user, isLoading: authLoading } = useAuth();
  const loginMutation = useLogin();
  const logoutMutation = useLogout();

  const handleLogin = () => {
    loginMutation.mutate({
      walletAddress: '0x123...',
      userType: 'customer',
    });
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  if (authLoading) return <ActivityIndicator size="large" />;

  return (
    <View>
      {user ? (
        <View>
          <Text>Logged in as: {user.address}</Text>
          <Text>User type: {user.userType}</Text>
          <Pressable 
            onPress={handleLogout}
            disabled={logoutMutation.isPending}
          >
            <Text>
              {logoutMutation.isPending ? 'Logging out...' : 'Logout'}
            </Text>
          </Pressable>
        </View>
      ) : (
        <Pressable 
          onPress={handleLogin}
          disabled={loginMutation.isPending}
        >
          <Text>
            {loginMutation.isPending ? 'Logging in...' : 'Login'}
          </Text>
        </Pressable>
      )}
    </View>
  );
};

// Example 6: Error handling and retry
export const ErrorHandlingExample = ({ walletAddress }: { walletAddress: string }) => {
  const { 
    data: customer, 
    isLoading, 
    error, 
    refetch, 
    isRefetching 
  } = useCustomer(walletAddress);

  if (isLoading && !isRefetching) {
    return <ActivityIndicator size="large" />;
  }

  if (error) {
    return (
      <View>
        <Text>Something went wrong:</Text>
        <Text>{error.message}</Text>
        <Pressable onPress={() => refetch()}>
          <Text>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View>
      <Text>Customer: {customer?.data?.customer?.name}</Text>
      {isRefetching && <ActivityIndicator size="small" />}
      <Pressable onPress={() => refetch()}>
        <Text>Refresh</Text>
      </Pressable>
    </View>
  );
};

// Example 7: Optimistic updates with mutations
export const OptimisticUpdateExample = ({ walletAddress }: { walletAddress: string }) => {
  const { useCalculateTier } = require('../hooks/useCustomerQueries');
  const calculateTierMutation = useCalculateTier();

  const handleCalculateTier = () => {
    calculateTierMutation.mutate({
      address: walletAddress,
      repairAmount: 100,
    });
  };

  return (
    <View>
      <Pressable 
        onPress={handleCalculateTier}
        disabled={calculateTierMutation.isPending}
      >
        <Text>
          {calculateTierMutation.isPending ? 'Calculating...' : 'Calculate Tier'}
        </Text>
      </Pressable>
      
      {calculateTierMutation.error && (
        <Text>Error: {calculateTierMutation.error.message}</Text>
      )}
      
      {calculateTierMutation.data && (
        <Text>New tier calculated successfully!</Text>
      )}
    </View>
  );
};