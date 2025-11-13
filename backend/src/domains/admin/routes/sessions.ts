// backend/src/domains/admin/routes/sessions.ts
import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../../middleware/errorHandler';
import { refreshTokenRepository } from '../../../repositories';
import { logger } from '../../../utils/logger';

const router = Router();

/**
 * GET /api/admin/sessions
 * Get all sessions with filtering and pagination
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const role = req.query.role as 'admin' | 'shop' | 'customer' | undefined;
  const status = req.query.status as 'active' | 'expired' | 'revoked' | 'all' | undefined;

  logger.info('Admin fetching sessions', {
    adminAddress: req.user?.address,
    page,
    limit,
    role,
    status
  });

  const result = await refreshTokenRepository.getAllSessions({
    page,
    limit,
    role,
    status: status === 'all' ? undefined : status
  });

  res.json({
    success: true,
    ...result
  });
}));

/**
 * DELETE /api/admin/sessions/:tokenId
 * Revoke a specific session by token ID
 */
router.delete('/:tokenId', asyncHandler(async (req: Request, res: Response) => {
  const { tokenId } = req.params;
  const { reason } = req.body;

  logger.security('Admin revoking session', {
    adminAddress: req.user?.address,
    tokenId,
    reason
  });

  await refreshTokenRepository.revokeToken(
    tokenId,
    reason || `Revoked by admin ${req.user?.address}`,
    true // revokedByAdmin flag
  );

  res.json({
    success: true,
    message: 'Session revoked successfully'
  });
}));

/**
 * DELETE /api/admin/sessions/user/:userAddress
 * Revoke all sessions for a specific user
 */
router.delete('/user/:userAddress', asyncHandler(async (req: Request, res: Response) => {
  const { userAddress } = req.params;
  const { reason } = req.body;

  logger.security('Admin revoking all user sessions', {
    adminAddress: req.user?.address,
    userAddress,
    reason
  });

  const count = await refreshTokenRepository.revokeAllUserTokens(
    userAddress,
    reason || `All sessions revoked by admin ${req.user?.address}`,
    true // revokedByAdmin flag
  );

  res.json({
    success: true,
    message: `Revoked ${count} session(s) for user ${userAddress}`,
    count
  });
}));

/**
 * GET /api/admin/sessions/stats
 * Get session statistics
 */
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  const stats = await refreshTokenRepository.getTokenStats();

  res.json({
    success: true,
    stats
  });
}));

export default router;
