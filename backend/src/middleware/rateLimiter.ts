// backend/src/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { logger } from '../utils/logger';

/**
 * Rate limiter for general API endpoints
 * 100 requests per 15 minutes per IP
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
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
 * 5 attempts per 15 minutes per IP
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login/register attempts per windowMs
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
 * 5 requests per minute per IP
 */
export const paymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Limit each IP to 5 payment operations per minute
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
 * 100 requests per minute per IP (external services)
 */
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Allow high volume from webhook providers
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
