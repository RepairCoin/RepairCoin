/**
 * Import Rate Limiting Middleware
 * Prevents abuse of import endpoints
 */

import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Rate limiter for import endpoints
 * Limits: 5 imports per hour per shop
 */
export const importRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per hour
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many import requests. You can only import 5 times per hour. Please try again later.',
    retryAfter: null // Will be set dynamically
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers

  // Generate key based on shop ID (not IP address)
  keyGenerator: (req: Request) => {
    // Use shop ID from authenticated user
    if (req.user && (req.user as any).shopId) {
      return `shop:${(req.user as any).shopId}`;
    }
    // Fallback to IP if no shop ID (shouldn't happen with auth middleware)
    return req.ip || 'unknown';
  },

  // Skip rate limiting for admins
  skip: (req: Request) => {
    return req.user && (req.user as any).role === 'admin';
  },

  // Handler when rate limit is exceeded
  handler: (req: Request, res: Response) => {
    const retryAfter = res.getHeader('Retry-After');

    res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many import requests. You can only import 5 times per hour.',
      details: {
        limit: 5,
        window: '1 hour',
        retryAfter: retryAfter ? `${retryAfter} seconds` : 'soon'
      },
      suggestion: 'Please wait for the rate limit to reset, or contact support if you need a higher limit.'
    });
  }
});

/**
 * Stricter rate limiter for dry run operations (allows more frequent checks)
 * Limits: 20 dry runs per hour per shop
 */
export const dryRunRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 requests per hour
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many validation requests. Please try again later.'
  },
  keyGenerator: (req: Request) => {
    if (req.user && (req.user as any).shopId) {
      return `shop:dryrun:${(req.user as any).shopId}`;
    }
    return req.ip || 'unknown';
  },
  skip: (req: Request) => {
    // Skip for admins or if not a dry run
    if (req.user && (req.user as any).role === 'admin') {
      return true;
    }
    // Check if this is a dry run request
    return req.body?.dryRun !== true && req.body?.dryRun !== 'true';
  }
});

/**
 * Rate limiter for export endpoints (more lenient)
 * Limits: 30 exports per hour per shop
 */
export const exportRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // 30 requests per hour
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many export requests. Please try again later.'
  },
  keyGenerator: (req: Request) => {
    if (req.user && (req.user as any).shopId) {
      return `shop:export:${(req.user as any).shopId}`;
    }
    return req.ip || 'unknown';
  },
  skip: (req: Request) => {
    return req.user && (req.user as any).role === 'admin';
  }
});
