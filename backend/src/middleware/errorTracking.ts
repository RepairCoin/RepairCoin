// backend/src/middleware/errorTracking.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface ErrorMetrics {
  endpoint: string;
  method: string;
  statusCode: number;
  errorType: string;
  userAgent?: string;
  ip?: string;
  auth?: boolean;
  timestamp: Date;
}

// In-memory storage for error tracking (in production, use Redis or similar)
const errorMetrics: ErrorMetrics[] = [];
const MAX_ERROR_ENTRIES = 1000;

// Middleware to track all response errors
export const errorTrackingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Store original res.json to intercept responses
  const originalJson = res.json;
  
  res.json = function(data: any) {
    // Track error responses
    if (res.statusCode >= 400) {
      const errorMetric: ErrorMetrics = {
        endpoint: req.path,
        method: req.method,
        statusCode: res.statusCode,
        errorType: getErrorType(res.statusCode),
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        auth: !!req.headers.authorization,
        timestamp: new Date()
      };
      
      // Add to metrics array (circular buffer)
      errorMetrics.push(errorMetric);
      if (errorMetrics.length > MAX_ERROR_ENTRIES) {
        errorMetrics.shift();
      }
      
      // Log detailed error information
      logger.warn('API Error Response', {
        ...errorMetric,
        requestId: req.requestId,
        query: req.query,
        body: req.method === 'POST' || req.method === 'PUT' ? req.body : undefined,
        errorResponse: data
      });
    }
    
    return originalJson.call(this, data);
  };
  
  next();
};

// Get human-readable error type
function getErrorType(statusCode: number): string {
  const errorTypes: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    408: 'Request Timeout',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable'
  };
  
  return errorTypes[statusCode] || `HTTP ${statusCode}`;
}

// Get error summary endpoint
export const getErrorSummary = (req: Request, res: Response) => {
  const summary = {
    totalErrors: errorMetrics.length,
    timeRange: {
      from: errorMetrics[0]?.timestamp || new Date(),
      to: errorMetrics[errorMetrics.length - 1]?.timestamp || new Date()
    },
    errorsByEndpoint: {} as Record<string, number>,
    errorsByType: {} as Record<string, number>,
    errorsByStatusCode: {} as Record<number, number>,
    recentErrors: errorMetrics.slice(-20).reverse(),
    topFailingEndpoints: [] as Array<{ endpoint: string; count: number; methods: string[] }>
  };
  
  // Aggregate errors
  errorMetrics.forEach(error => {
    // By endpoint
    const endpointKey = `${error.method} ${error.endpoint}`;
    summary.errorsByEndpoint[endpointKey] = (summary.errorsByEndpoint[endpointKey] || 0) + 1;
    
    // By type
    summary.errorsByType[error.errorType] = (summary.errorsByType[error.errorType] || 0) + 1;
    
    // By status code
    summary.errorsByStatusCode[error.statusCode] = (summary.errorsByStatusCode[error.statusCode] || 0) + 1;
  });
  
  // Get top failing endpoints
  const endpointCounts = new Map<string, { count: number; methods: Set<string> }>();
  
  errorMetrics.forEach(error => {
    const existing = endpointCounts.get(error.endpoint) || { count: 0, methods: new Set() };
    existing.count++;
    existing.methods.add(error.method);
    endpointCounts.set(error.endpoint, existing);
  });
  
  summary.topFailingEndpoints = Array.from(endpointCounts.entries())
    .map(([endpoint, data]) => ({
      endpoint,
      count: data.count,
      methods: Array.from(data.methods)
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  res.json({
    success: true,
    data: summary
  });
};

// Clear error metrics endpoint
export const clearErrorMetrics = (req: Request, res: Response) => {
  const previousCount = errorMetrics.length;
  errorMetrics.length = 0;
  
  logger.info('Error metrics cleared', {
    previousCount,
    clearedBy: req.user?.address || 'unknown'
  });
  
  res.json({
    success: true,
    message: `Cleared ${previousCount} error entries`
  });
};

// Real-time error monitoring
export const monitorErrors = () => {
  setInterval(() => {
    const recentErrors = errorMetrics.filter(
      error => new Date().getTime() - error.timestamp.getTime() < 60000 // Last minute
    );
    
    if (recentErrors.length > 50) {
      logger.error('High error rate detected', {
        errorsInLastMinute: recentErrors.length,
        errorBreakdown: recentErrors.reduce((acc, error) => {
          acc[error.statusCode] = (acc[error.statusCode] || 0) + 1;
          return acc;
        }, {} as Record<number, number>)
      });
    }
  }, 60000); // Check every minute
};