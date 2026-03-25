// frontend/src/services/api/gmail.ts
import apiClient from './client';

export const gmailApi = {
  // Get connection status
  getConnectionStatus: async () => {
    const response = await apiClient.get('/shops/gmail/status');
    return response.data;
  },

  // Get OAuth authorization URL
  connect: async () => {
    const response = await apiClient.get('/shops/gmail/connect');
    return response.data;
  },

  // Handle OAuth callback
  handleCallback: async (code: string, state: string) => {
    const response = await apiClient.post('/shops/gmail/callback', {
      code,
      state
    });
    return response.data;
  },

  // Disconnect Gmail
  disconnect: async () => {
    const response = await apiClient.delete('/shops/gmail/disconnect');
    return response.data;
  },

  // Send test email
  sendTestEmail: async (toEmail: string) => {
    const response = await apiClient.post('/shops/gmail/send-test', {
      toEmail
    });
    return response.data;
  },

  // Get email statistics
  getStats: async () => {
    const response = await apiClient.get('/shops/gmail/stats');
    return response.data;
  }
};
