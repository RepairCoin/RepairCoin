// backend/src/routes/security.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { refreshTokenRepository } from '../repositories';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Get current user's active sessions
 * GET /api/security/sessions
 * Requires authentication
 */
router.get('/sessions', authMiddleware, async (req, res) => {
  try {
    if (!req.user || !req.user.address) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const sessions = await refreshTokenRepository.getActiveTokens(req.user.address);

    // Map sessions to a more frontend-friendly format
    const formattedSessions = sessions.map(session => ({
      id: session.tokenId,
      device: parseUserAgent(session.userAgent),
      browser: parseBrowser(session.userAgent),
      os: parseOS(session.userAgent),
      ipAddress: session.ipAddress || 'Unknown',
      location: session.location || (session.ipAddress ? 'Unknown location' : 'Unknown'),
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
      expiresAt: session.expiresAt,
      isCurrentSession: req.user.tokenId === session.tokenId, // Compare with current token
      isMobile: isMobileDevice(session.userAgent)
    }));

    // Sort: current session first, then by last used
    formattedSessions.sort((a, b) => {
      if (a.isCurrentSession) return -1;
      if (b.isCurrentSession) return 1;
      return new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime();
    });

    return res.json({
      success: true,
      data: {
        sessions: formattedSessions,
        total: formattedSessions.length
      }
    });

  } catch (error) {
    logger.error('Error fetching user sessions:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch sessions'
    });
  }
});

/**
 * Revoke a specific session
 * DELETE /api/security/sessions/:tokenId
 * Requires authentication
 */
router.delete('/sessions/:tokenId', authMiddleware, async (req, res) => {
  try {
    if (!req.user || !req.user.address) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const { tokenId } = req.params;

    // Get the session to verify ownership
    const sessions = await refreshTokenRepository.getActiveTokens(req.user.address);
    const session = sessions.find(s => s.tokenId === tokenId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or already revoked'
      });
    }

    // Revoke the session
    await refreshTokenRepository.revokeToken(tokenId, 'User revoked session');

    logger.info('Session revoked by user', {
      userAddress: req.user.address,
      tokenId,
      isCurrentSession: req.user.tokenId === tokenId
    });

    return res.json({
      success: true,
      message: 'Session revoked successfully'
    });

  } catch (error) {
    logger.error('Error revoking session:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to revoke session'
    });
  }
});

/**
 * Revoke all sessions except current
 * POST /api/security/sessions/revoke-all
 * Requires authentication
 */
router.post('/sessions/revoke-all', authMiddleware, async (req, res) => {
  try {
    if (!req.user || !req.user.address) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    // Get all active sessions
    const sessions = await refreshTokenRepository.getActiveTokens(req.user.address);

    // Revoke all except the current session
    let revokedCount = 0;
    for (const session of sessions) {
      if (session.tokenId !== req.user.tokenId) {
        await refreshTokenRepository.revokeToken(
          session.tokenId,
          'User logged out of all other devices'
        );
        revokedCount++;
      }
    }

    logger.info('All other sessions revoked by user', {
      userAddress: req.user.address,
      revokedCount,
      currentTokenId: req.user.tokenId
    });

    return res.json({
      success: true,
      message: `${revokedCount} session(s) revoked successfully`,
      data: {
        revokedCount
      }
    });

  } catch (error) {
    logger.error('Error revoking all sessions:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to revoke sessions'
    });
  }
});

/**
 * Get security activity log for current user
 * GET /api/security/activity
 * Requires authentication
 */
router.get('/activity', authMiddleware, async (req, res) => {
  try {
    if (!req.user || !req.user.address) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    // Get all sessions (including revoked) for activity history
    const result = await refreshTokenRepository.getAllSessions({
      page,
      limit,
      status: 'all'
    });

    // Filter for current user only
    const userSessions = result.sessions.filter(
      s => s.userAddress.toLowerCase() === req.user!.address.toLowerCase()
    );

    // Map to activity log format
    const activities = userSessions.map(session => {
      const activities: any[] = [];

      // Login activity
      activities.push({
        id: `login-${session.id}`,
        type: 'login',
        description: `Logged in from ${parseDevice(session.userAgent)}`,
        device: parseUserAgent(session.userAgent),
        browser: parseBrowser(session.userAgent),
        ipAddress: session.ipAddress,
        timestamp: session.createdAt,
        success: true
      });

      // Logout activity (if revoked by user)
      if (session.revoked && !session.revokedReason?.includes('admin')) {
        activities.push({
          id: `logout-${session.id}`,
          type: 'logout',
          description: session.revokedReason || 'Logged out',
          device: parseUserAgent(session.userAgent),
          ipAddress: session.ipAddress,
          timestamp: session.revokedAt,
          success: true
        });
      }

      return activities;
    }).flat();

    // Sort by timestamp descending
    activities.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const paginatedActivities = activities.slice(startIndex, startIndex + limit);

    return res.json({
      success: true,
      data: {
        activities: paginatedActivities,
        pagination: {
          page,
          limit,
          total: activities.length,
          pages: Math.ceil(activities.length / limit)
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching security activity:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch security activity'
    });
  }
});

/**
 * Get security statistics for current user
 * GET /api/security/stats
 * Requires authentication
 */
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    if (!req.user || !req.user.address) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const sessions = await refreshTokenRepository.getActiveTokens(req.user.address);

    // Calculate stats
    const now = new Date();
    const stats = {
      activeSessions: sessions.length,
      lastLoginAt: sessions.length > 0
        ? sessions.reduce((latest, s) => {
            const sessionDate = new Date(s.createdAt);
            return sessionDate > latest ? sessionDate : latest;
          }, new Date(0))
        : null,
      lastLoginLocation: sessions.length > 0 ? sessions[0].ipAddress || 'Unknown' : null,
      deviceTypes: {
        mobile: sessions.filter(s => isMobileDevice(s.userAgent)).length,
        desktop: sessions.filter(s => !isMobileDevice(s.userAgent)).length
      },
      securityScore: calculateSecurityScore(req.user.role, sessions.length)
    };

    return res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Error fetching security stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch security statistics'
    });
  }
});

// Helper functions

function parseUserAgent(userAgent?: string): string {
  if (!userAgent) return 'Unknown Device';

  if (userAgent.includes('Mobile') || userAgent.includes('Android')) {
    return 'Mobile Device';
  } else if (userAgent.includes('iPad') || userAgent.includes('Tablet')) {
    return 'Tablet';
  } else {
    return 'Desktop Computer';
  }
}

function parseBrowser(userAgent?: string): string {
  if (!userAgent) return 'Unknown Browser';

  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) return 'Chrome';
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Edg')) return 'Edge';
  if (userAgent.includes('Opera') || userAgent.includes('OPR')) return 'Opera';

  return 'Unknown Browser';
}

function parseOS(userAgent?: string): string {
  if (!userAgent) return 'Unknown OS';

  if (userAgent.includes('Windows')) return 'Windows';
  if (userAgent.includes('Mac OS X') || userAgent.includes('Macintosh')) return 'macOS';
  if (userAgent.includes('Linux')) return 'Linux';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';

  return 'Unknown OS';
}

function isMobileDevice(userAgent?: string): boolean {
  if (!userAgent) return false;
  return /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
}

function parseDevice(userAgent?: string): string {
  const browser = parseBrowser(userAgent);
  const os = parseOS(userAgent);
  const deviceType = parseUserAgent(userAgent);

  return `${deviceType} (${browser} on ${os})`;
}

function calculateSecurityScore(role: string, activeSessions: number): number {
  let score = 100;

  // Deduct points for too many active sessions (possible security risk)
  if (activeSessions > 5) {
    score -= (activeSessions - 5) * 5;
  }

  // Bonus for admins (stricter security requirements)
  if (role === 'admin' && activeSessions <= 2) {
    score += 10;
  }

  return Math.max(0, Math.min(100, score));
}

export default router;
