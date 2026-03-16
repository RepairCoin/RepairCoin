import apiClient from './client';

export interface UserSession {
  id: string;
  device: string;
  browser: string;
  os: string;
  ipAddress: string;
  location: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  isCurrentSession: boolean;
  isMobile: boolean;
}

export interface SecurityActivity {
  id: string;
  type: 'login' | 'logout' | 'password_change' | 'session_revoked';
  description: string;
  device: string;
  browser?: string;
  ipAddress?: string;
  timestamp: string;
  success: boolean;
}

export interface SecurityStats {
  activeSessions: number;
  lastLoginAt: string | null;
  lastLoginLocation: string | null;
  deviceTypes: {
    mobile: number;
    desktop: number;
  };
  securityScore: number;
}

// Get all active sessions for the current user
export async function getActiveSessions(): Promise<UserSession[]> {
  const response = await apiClient.get('/security/sessions');
  return response.data.sessions;
}

// Revoke a specific session
export async function revokeSession(sessionId: string): Promise<void> {
  await apiClient.delete(`/security/sessions/${sessionId}`);
}

// Revoke all sessions except the current one
export async function revokeAllSessions(): Promise<{ revokedCount: number }> {
  const response = await apiClient.post('/security/sessions/revoke-all');
  return response.data;
}

// Get security activity log
export async function getSecurityActivity(
  page = 1,
  limit = 20
): Promise<{
  activities: SecurityActivity[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}> {
  const response = await apiClient.get('/security/activity', {
    params: { page, limit },
  });
  return response.data;
}

// Get security statistics
export async function getSecurityStats(): Promise<SecurityStats> {
  const response = await apiClient.get('/security/stats');
  return response.data;
}
