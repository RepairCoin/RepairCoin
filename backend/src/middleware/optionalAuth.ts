// backend/src/middleware/optionalAuth.ts
import { Request, Response, NextFunction } from 'express';
import { authMiddleware } from './auth';

/**
 * Optional authentication middleware
 *
 * Attempts to authenticate the request if credentials are present (cookie or header),
 * but does NOT fail if authentication is missing. This allows routes to be accessible
 * to both authenticated and unauthenticated users, with different behavior based on auth status.
 *
 * Usage:
 * - Use this for routes that should work for everyone but provide extra data/features for authenticated users
 * - The route handler can check `req.user` to determine if user is authenticated
 * - Example: Public group listing that shows membership status if user is logged in
 */
export const optionalAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Check if any authentication credentials are present
  const hasAuthCookie = !!req.cookies?.auth_token;
  const hasAuthHeader = !!req.headers.authorization;

  if (hasAuthCookie || hasAuthHeader) {
    // Credentials present - try to authenticate
    // Use authMiddleware but catch any errors and continue anyway
    authMiddleware(req, res, (error?: any) => {
      if (error) {
        // Authentication failed but that's OK for optional auth
        // Continue without setting req.user
        next();
      } else {
        // Authentication succeeded
        next();
      }
    });
  } else {
    // No credentials present - continue without authentication
    next();
  }
};
