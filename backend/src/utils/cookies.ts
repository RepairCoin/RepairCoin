// backend/src/utils/cookies.ts
import { Request } from 'express';

/**
 * Determine the cookie Domain attribute based on the request's Host header.
 *
 * In production the same backend may be reached via multiple registrable
 * domains during the fixflow.ai migration window:
 *   - api.repaircoin.ai (legacy)
 *   - api.fixflow.ai   (new)
 *
 * Cookies must be scoped to the matching parent domain so they are first-party
 * for the frontend that initiated the request — otherwise the browser refuses
 * the Set-Cookie (because a response from api.fixflow.ai cannot legally set a
 * cookie scoped to .repaircoin.ai, and vice versa).
 *
 * In development we always return 'localhost' so cookies work across the
 * local frontend (3001) and backend (4000) ports.
 *
 * Returns undefined when no domain match applies and no env fallback is set —
 * lets the browser default to a host-only cookie rather than ever rejecting
 * the Set-Cookie outright.
 */
export const getCookieDomain = (req: Request): string | undefined => {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    return 'localhost';
  }

  const host = (req.get('host') || '').toLowerCase().split(':')[0];

  if (host === 'fixflow.ai' || host.endsWith('.fixflow.ai')) {
    return '.fixflow.ai';
  }
  if (host === 'repaircoin.ai' || host.endsWith('.repaircoin.ai')) {
    return '.repaircoin.ai';
  }

  return process.env.COOKIE_DOMAIN || undefined;
};
