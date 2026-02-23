// backend/src/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { logger } from '../utils/logger';

/**
 * Rate limiter for general API endpoints
 * Development: 10000 requests per 15 minutes (very lenient for hot-reload)
 * Production: 500 requests per 15 minutes per IP
 *
 * Based on traffic analysis:
 * - Page loads trigger 15-25 API calls (admin dashboard)
 * - Payment polling adds ~48 calls over 2 minutes
 * - Normal browsing session: ~100-200 calls in 15 minutes
 * - 500 provides 2x headroom for legitimate use while blocking abuse
 */
const isDevelopment = process.env.NODE_ENV === 'development';

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 10000 : 500, // 500/15min in prod (prev: 100 was too restrictive)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again after 15 minutes'
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    res.status(429).json({
      success: false,
      error: 'Too many requests from this IP, please try again after 15 minutes'
    });
  }
});

/**
 * Stricter rate limiter for authentication endpoints
 * Development: 1000 requests per 15 minutes
 * Production: 10 failed attempts per 15 minutes per IP
 *
 * Wallet-based auth is less brute-force-prone than passwords,
 * but still worth protecting against credential stuffing.
 * skipSuccessfulRequests ensures only failed attempts count.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 1000 : 10, // 10 failed attempts/15min (prev: 20)
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  message: {
    success: false,
    error: 'Too many authentication attempts from this IP, please try again after 15 minutes'
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userAgent: req.headers['user-agent']
    });
    res.status(429).json({
      success: false,
      error: 'Too many authentication attempts from this IP, please try again after 15 minutes'
    });
  }
});

/**
 * Rate limiter for token operations
 * 10 requests per minute per IP
 */
export const tokenLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 token operations per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many token requests, please try again after a minute'
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Token rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    res.status(429).json({
      success: false,
      error: 'Too many token requests, please try again after a minute'
    });
  }
});

/**
 * Rate limiter for payment operations
 * 10 requests per minute per IP
 *
 * Increased from 5 to allow for payment retries on failure.
 * A failed payment + retry + new attempt can burn through 5 quickly.
 */
export const paymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10/min allows retries on failure (prev: 5)
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many payment requests, please try again after a minute'
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Payment rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    res.status(429).json({
      success: false,
      error: 'Too many payment requests, please try again after a minute'
    });
  }
});

/**
 * Rate limiter for order creation
 * 10 orders per hour per IP
 */
export const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 orders per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many orders from this IP, please try again after an hour'
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Order rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    res.status(429).json({
      success: false,
      error: 'Too many orders from this IP, please try again after an hour'
    });
  }
});

/**
 * Rate limiter for webhook endpoints
 * 200 requests per minute per IP (external services)
 *
 * Stripe can send event bursts during subscription lifecycle changes.
 * Real webhook protection comes from signature verification, not rate limiting.
 */
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // 200/min for webhook bursts (prev: 100)
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Webhook rate limit exceeded'
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Webhook rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    res.status(429).json({
      success: false,
      error: 'Webhook rate limit exceeded'
    });
  }
});
