// Export all React Query hooks for easy importing
export * from './useCustomerQueries';
export * from './useShopQueries';
export * from './useAuthQueries';

// Re-export React Query utilities
export { useQueryClient } from '@tanstack/react-query';
export { queryKeys } from '../config/queryClient';