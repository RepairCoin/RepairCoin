// frontend/src/services/api/gmail.ts
import apiClient from './client';

export const gmailApi = {
  // Get connection status
  getConnectionStatus: async () => {
    return await apiClient.get('/shops/gmail/status');
  },

  // Get OAuth authorization URL
  connect: async () => {
    return await apiClient.get('/shops/gmail/connect');
  },

  // Handle OAuth callback
  handleCallback: async (code: string, state: string) => {
    return await apiClient.post('/shops/gmail/callback', {
      code,
      state
    });
  },

  // Disconnect Gmail
  disconnect: async () => {
    return await apiClient.delete('/shops/gmail/disconnect');
  },

  // Send test email
  sendTestEmail: async (toEmail: string) => {
    return await apiClient.post('/shops/gmail/send-test', {
      toEmail
    });
  },

  // Get email statistics
  getStats: async () => {
    return await apiClient.get('/shops/gmail/stats');
  }
};
