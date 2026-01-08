/**
 * Request Timing Middleware
 * Logs detailed timing information for slow requests
 */
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Threshold in ms to log slow requests
const SLOW_REQUEST_THRESHOLD = 1000;

export const timingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;

  // Store start time on request object for use in route handlers
  (req as any).startTime = startTime;

  // Intercept response finish
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    // Log all requests with their timing
    const logData = {
      requestId,
      method: req.method,
      path: req.path,
      duration: `${duration}ms`,
      status: res.statusCode,
      slow: duration > SLOW_REQUEST_THRESHOLD
    };

    if (duration > SLOW_REQUEST_THRESHOLD) {
      logger.warn('SLOW REQUEST', logData);
    } else {
      logger.info('Request completed', logData);
    }
  });

  next();
};

/**
 * Helper to log timing within a route handler
 * Usage: const timer = createTimer(req); timer.mark('step1'); timer.end();
 */
export const createTimer = (req: Request) => {
  const startTime = (req as any).startTime || Date.now();
  const marks: { name: string; time: number }[] = [];

  return {
    mark: (name: string) => {
      const elapsed = Date.now() - startTime;
      marks.push({ name, time: elapsed });
      logger.debug(`Timer mark: ${name} at ${elapsed}ms`);
    },
    end: () => {
      const total = Date.now() - startTime;
      logger.info('Request timing breakdown', {
        total: `${total}ms`,
        marks: marks.map(m => `${m.name}: ${m.time}ms`)
      });
      return { total, marks };
    }
  };
};
