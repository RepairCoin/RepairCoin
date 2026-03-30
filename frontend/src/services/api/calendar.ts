// frontend/src/services/api/calendar.ts
import apiClient from './client';

export const calendarApi = {
  // Get connection status
  getConnectionStatus: async () => {
    // Note: apiClient interceptor already returns response.data, so no need to access .data again
    const data = await apiClient.get('/shops/calendar/status');
    return data;
  },

  // Get OAuth authorization URL
  connectGoogle: async () => {
    console.log('[CalendarAPI] 🔄 Making GET request to /shops/calendar/connect/google');
    try {
      // Note: apiClient interceptor already returns response.data, so 'data' is the actual response body
      const data = await apiClient.get('/shops/calendar/connect/google');
      console.log('[CalendarAPI] 📦 Response data (after interceptor):', {
        data,
        hasSuccess: 'success' in data,
        successValue: data.success,
        hasData: 'data' in data,
        dataValue: data.data
      });
      console.log('[CalendarAPI] ✅ Returning data:', data);
      return data;
    } catch (error: any) {
      console.error('[CalendarAPI] ❌ Request failed:', {
        error,
        message: error.message,
        response: error.response ? {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        } : 'No response',
        request: error.request ? 'Request made but no response' : 'Request not made'
      });
      throw error;
    }
  },

  // Handle OAuth callback
  handleCallback: async (code: string, state: string) => {
    // Note: apiClient interceptor already returns response.data, so no need to access .data again
    const data = await apiClient.post('/shops/calendar/callback/google', {
      code,
      state
    });
    return data;
  },

  // Disconnect calendar
  disconnect: async (provider: string) => {
    // Note: apiClient interceptor already returns response.data, so no need to access .data again
    const data = await apiClient.delete(`/shops/calendar/disconnect/${provider}`);
    return data;
  },

  // Test sync (for debugging)
  testSync: async () => {
    // Note: apiClient interceptor already returns response.data, so no need to access .data again
    const data = await apiClient.post('/shops/calendar/test-sync');
    return data;
  }
};
