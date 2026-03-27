// frontend/src/services/api/calendar.ts
import apiClient from './client';

export const calendarApi = {
  // Get connection status
  getConnectionStatus: async () => {
    const response = await apiClient.get('/shops/calendar/status');
    return response.data;
  },

  // Get OAuth authorization URL
  connectGoogle: async () => {
    const response = await apiClient.get('/shops/calendar/connect/google');
    return response.data;
  },

  // Handle OAuth callback
  handleCallback: async (code: string, state: string) => {
    const response = await apiClient.post('/shops/calendar/callback/google', {
      code,
      state
    });
    return response.data;
  },

  // Disconnect calendar
  disconnect: async (provider: string) => {
    const response = await apiClient.delete(`/shops/calendar/disconnect/${provider}`);
    return response.data;
  },

  // Test sync (for debugging)
  testSync: async () => {
    const response = await apiClient.post('/shops/calendar/test-sync');
    return response.data;
  }
};
