import apiClient from './client';
import { GeneralNotificationPreferences, UpdateGeneralNotificationPreferences } from '@/constants/types';

/**
 * Get general notification preferences for the authenticated user
 */
export const getGeneralNotificationPreferences = async (): Promise<GeneralNotificationPreferences> => {
  const response = await apiClient.get('/notifications/preferences/general');
  console.log('API Response:', response);

  // The axios interceptor returns response.data directly, so response = { success: true, data: preferences }
  if (!response || !response.data) {
    console.error('Invalid API response structure:', response);
    throw new Error('Invalid response from notification preferences API');
  }

  return response.data;
};

/**
 * Update general notification preferences
 */
export const updateGeneralNotificationPreferences = async (
  updates: UpdateGeneralNotificationPreferences
): Promise<GeneralNotificationPreferences> => {
  const response = await apiClient.put('/notifications/preferences/general', updates);
  return response.data;
};

/**
 * Reset general notification preferences to defaults
 */
export const resetGeneralNotificationPreferences = async (): Promise<GeneralNotificationPreferences> => {
  const response = await apiClient.post('/notifications/preferences/general/reset');
  return response.data;
};

export const notificationsApi = {
  getGeneralNotificationPreferences,
  updateGeneralNotificationPreferences,
  resetGeneralNotificationPreferences,
};
