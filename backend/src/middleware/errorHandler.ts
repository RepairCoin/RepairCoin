// backend/src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { randomUUID } from 'crypto';

// Extend Express Request interface for requestId only
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

// Request ID middleware to generate unique request IDs
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  req.requestId = req.headers['x-request-id'] as string || randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
};

// Custom error classes
export class RepairCoinError extends Error {
  public statusCode: number;
  public code: string;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'RepairCoinError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends RepairCoinError {
  constructor(message: string, field?: string) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends RepairCoinError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends RepairCoinError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends RepairCoinError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class BlockchainError extends RepairCoinError {
  constructor(message: string, transactionHash?: string) {
    super(message, 502, 'BLOCKCHAIN_ERROR');
    this.name = 'BlockchainError';
  }
}

export class DatabaseError extends RepairCoinError {
  constructor(message: string) {
    super(message, 503, 'DATABASE_ERROR');
    this.name = 'DatabaseError';
  }
}

export class RateLimitError extends RepairCoinError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
  }
}

// Error response interface
interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  requestId?: string;
  details?: any;
  stack?: string;
}

// Main error handling middleware
export const errorHandler = (
  error: Error | RepairCoinError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Internal server error';
  let details: any = undefined;

  // Handle known error types
  if (error instanceof RepairCoinError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = error.message;
  } else if (error.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = 'Invalid ID format';
  } else if (error.name === 'MongoError' || error.name === 'MongoServerError') {
    statusCode = 503;
    code = 'DATABASE_ERROR';
    message = 'Database operation failed';
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Invalid authentication token';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Authentication token expired';
  } else if (error.message.includes('insufficient funds')) {
    statusCode = 502;
    code = 'INSUFFICIENT_FUNDS';
    message = 'Insufficient funds for blockchain transaction';
  } else if (error.message.includes('nonce')) {
    statusCode = 502;
    code = 'NONCE_ERROR';
    message = 'Blockchain nonce error - transaction may need retry';
  } else if (error.message.includes('gas')) {
    statusCode = 502;
    code = 'GAS_ERROR';
    message = 'Blockchain gas estimation failed';
  }

  // Create error response
  const errorResponse: ErrorResponse = {
    success: false,
    error: message,
    code,
    statusCode,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    requestId: req.requestId || 'unknown',
  };

  // Add details in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.details = {
      originalMessage: error.message,
      name: error.name
    };
    errorResponse.stack = error.stack;
  }

  // Log error with appropriate level
  const logMetadata = {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    request: {
      method: req.method,
      path: req.path,
      query: req.query,
      body: req.body,
      headers: {
        'user-agent': req.get('User-Agent'),
        'content-type': req.get('Content-Type'),
        'authorization': req.get('Authorization') ? 'Bearer [REDACTED]' : undefined
      },
      ip: req.ip,
      requestId: req.requestId || 'unknown'
    },
    user: req.user
  };

  // Log based on severity
  if (statusCode >= 500) {
    logger.error(`Server Error: ${message}`, logMetadata);
  } else if (statusCode >= 400) {
    logger.warn(`Client Error: ${message}`, logMetadata);
  } else {
    logger.info(`Error handled: ${message}`, logMetadata);
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

// Async error wrapper for route handlers
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new NotFoundError(`Route ${req.method} ${req.path}`);
  next(error);
};

// Validation middleware
export const validateRequired = (fields: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const missing: string[] = [];
    
    for (const field of fields) {
      const value = req.body[field];
      if (value === undefined || value === null || value === '') {
        missing.push(field);
      }
    }
    
    if (missing.length > 0) {
      const error = new ValidationError(`Missing required fields: ${missing.join(', ')}`);
      return next(error);
    }
    
    next();
  };
};

// Ethereum address validation
export const validateEthereumAddress = (field: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const address = req.body[field] || req.params[field];
    
    if (!address) {
      return next(new ValidationError(`${field} is required`));
    }
    
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return next(new ValidationError(`${field} must be a valid Ethereum address`));
    }
    
    // Normalize address to lowercase
    if (req.body[field]) {
      req.body[field] = address.toLowerCase();
    }
    if (req.params[field]) {
      req.params[field] = address.toLowerCase();
    }
    
    next();
  };
};

// Numeric validation
export const validateNumeric = (field: string, min?: number, max?: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.body[field];
    
    if (value !== undefined) {
      const numValue = parseFloat(value);
      
      if (isNaN(numValue)) {
        return next(new ValidationError(`${field} must be a number`));
      }
      
      if (min !== undefined && numValue < min) {
        return next(new ValidationError(`${field} must be at least ${min}`));
      }
      
      if (max !== undefined && numValue > max) {
        return next(new ValidationError(`${field} must be at most ${max}`));
      }
      
      req.body[field] = numValue;
    }
    
    next();
  };
};

// Email validation
export const validateEmail = (field: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const email = req.body[field];

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return next(new ValidationError(`${field} must be a valid email address`));
      }
    }

    next();
  };
};

// String length validation
export const validateStringLength = (field: string, maxLength: number = 255) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.body[field];

    if (value && typeof value === 'string' && value.length > maxLength) {
      return next(new ValidationError(`${field} must not exceed ${maxLength} characters`));
    }

    next();
  };
};

// String type validation (rejects non-string values like objects)
export const validateStringType = (field: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.body[field];

    // Skip if not provided (use validateRequired for required fields)
    if (value === undefined || value === null) {
      return next();
    }

    if (typeof value !== 'string') {
      return next(new ValidationError(`${field} must be a string`));
    }

    next();
  };
};

// Phone number validation
export const validatePhoneNumber = (field: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.body[field];

    // Phone is optional - skip if not provided
    if (!value) {
      return next();
    }

    if (typeof value !== 'string') {
      return next(new ValidationError(`${field} must be a string`));
    }

    // Check for malformed formats like double plus
    if (/^\+\+/.test(value)) {
      return next(new ValidationError(`Invalid phone number format`));
    }

    // Check for invalid characters (only allow digits, leading +, spaces, dashes, dots, parentheses)
    const allowedCharsRegex = /^[+]?[\d\s\-().]+$/;
    if (!allowedCharsRegex.test(value)) {
      return next(new ValidationError(`Phone number contains invalid characters`));
    }

    // Remove all non-digits to count the actual digits
    const digitsOnly = value.replace(/\D/g, '');

    // Check minimum length (7 digits per E.164 minimum)
    if (digitsOnly.length < 7) {
      return next(new ValidationError(`Phone number must have at least 7 digits`));
    }

    // Check maximum length (15 digits per E.164 standard)
    if (digitsOnly.length > 15) {
      return next(new ValidationError(`Phone number must not exceed 15 digits`));
    }

    // Sanitize the phone number to digits only
    req.body[field] = digitsOnly;

    next();
  };
};

// Sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // Remove any potentially dangerous HTML/script content
  const sanitizeString = (str: string): string => {
    if (typeof str !== 'string') return str;
    return str
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<[\/\!]*?[^<>]*?>/gi, '')
      .replace(/javascript:/gi, '')
      .trim();
  };
  
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return sanitizeString(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
      return sanitized;
    }
    
    return obj;
  };
  
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  next();
};

// Request timeout middleware
export const requestTimeout = (timeoutMs: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        logger.warn('Request timeout', {
          method: req.method,
          path: req.path,
          timeout: timeoutMs,
          requestId: req.requestId || 'unknown'
        });
        
        res.status(408).json({
          success: false,
          error: 'Request timeout',
          code: 'REQUEST_TIMEOUT',
          timeout: timeoutMs
        });
      }
    }, timeoutMs);
    
    res.on('finish', () => {
      clearTimeout(timeout);
    });
    
    next();
  };
};

// Health check middleware for dependencies
export const healthCheckMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Quick health checks that don't slow down requests
    const startTime = Date.now();
    
    // Check if critical environment variables are set
    const requiredEnvVars = [
      'THIRDWEB_CLIENT_ID',
      'THIRDWEB_SECRET_KEY',
      'REPAIRCOIN_CONTRACT_ADDRESS',
      'JWT_SECRET'
    ];
    
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    if (missingEnvVars.length > 0) {
      logger.error('Missing required environment variables', { missingEnvVars });
      return next(new RepairCoinError('Service configuration error', 503, 'CONFIG_ERROR'));
    }
    
    const healthCheckTime = Date.now() - startTime;
    
    // Log slow health checks
    if (healthCheckTime > 1000) {
      logger.warn('Slow health check', { healthCheckTime });
    }
    
    next();
  } catch (error: any) {
    logger.error('Health check middleware error:', error);
    next(new RepairCoinError('Service health check failed', 503, 'HEALTH_CHECK_ERROR'));
  }
};

// Performance monitoring middleware
export const performanceMonitoring = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    // Log slow requests
    if (duration > 5000) {
      logger.performance('Slow request detected', {
        method: req.method,
        path: req.path,
        duration: `${duration}ms`,
        statusCode: res.statusCode,
        requestId: req.requestId || 'unknown'
      });
    }
    
    // Log all requests in development
    if (process.env.NODE_ENV === 'development') {
      logger.info(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    }
  });
  
  next();
};

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Remove sensitive headers
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  next();
};