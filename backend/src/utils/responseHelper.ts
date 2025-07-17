// backend/src/utils/responseHelper.ts
import { Response } from 'express';
import { logger } from './logger';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: string;
  timestamp: string;
}

export class ResponseHelper {
  /**
   * Send successful response
   */
  static success<T>(res: Response, data?: T, message?: string, statusCode: number = 200): void {
    const response: ApiResponse<T> = {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString()
    };

    res.status(statusCode).json(response);
  }

  /**
   * Send error response
   */
  static error(
    res: Response, 
    message: string, 
    statusCode: number = 500, 
    code?: string,
    details?: any
  ): void {
    const response: ApiResponse = {
      success: false,
      error: message,
      code,
      timestamp: new Date().toISOString()
    };

    // Add details in development mode
    if (process.env.NODE_ENV === 'development' && details) {
      (response as any).details = details;
    }

    // Log error for internal tracking
    if (statusCode >= 500) {
      logger.error('Server error response:', { message, statusCode, code, details });
    } else if (statusCode >= 400) {
      logger.warn('Client error response:', { message, statusCode, code });
    }

    res.status(statusCode).json(response);
  }

  /**
   * Send created response (201)
   */
  static created<T>(res: Response, data?: T, message?: string): void {
    ResponseHelper.success(res, data, message, 201);
  }

  /**
   * Send accepted response (202)
   */
  static accepted<T>(res: Response, data?: T, message?: string): void {
    ResponseHelper.success(res, data, message, 202);
  }

  /**
   * Send no content response (204)
   */
  static noContent(res: Response): void {
    res.status(204).send();
  }

  /**
   * Send bad request error (400)
   */
  static badRequest(res: Response, message: string = 'Bad Request', code?: string): void {
    ResponseHelper.error(res, message, 400, code);
  }

  /**
   * Send unauthorized error (401)
   */
  static unauthorized(res: Response, message: string = 'Unauthorized', code?: string): void {
    ResponseHelper.error(res, message, 401, code);
  }

  /**
   * Send forbidden error (403)
   */
  static forbidden(res: Response, message: string = 'Forbidden', code?: string): void {
    ResponseHelper.error(res, message, 403, code);
  }

  /**
   * Send not found error (404)
   */
  static notFound(res: Response, message: string = 'Not Found', code?: string): void {
    ResponseHelper.error(res, message, 404, code);
  }

  /**
   * Send conflict error (409)
   */
  static conflict(res: Response, message: string = 'Conflict', code?: string): void {
    ResponseHelper.error(res, message, 409, code);
  }

  /**
   * Send unprocessable entity error (422)
   */
  static unprocessableEntity(res: Response, message: string = 'Unprocessable Entity', code?: string): void {
    ResponseHelper.error(res, message, 422, code);
  }

  /**
   * Send too many requests error (429)
   */
  static tooManyRequests(res: Response, message: string = 'Too Many Requests', retryAfter?: number): void {
    if (retryAfter) {
      res.setHeader('Retry-After', retryAfter);
    }
    ResponseHelper.error(res, message, 429, 'RATE_LIMIT_EXCEEDED');
  }

  /**
   * Send internal server error (500)
   */
  static internalServerError(res: Response, message: string = 'Internal Server Error', code?: string): void {
    ResponseHelper.error(res, message, 500, code);
  }

  /**
   * Send service unavailable error (503)
   */
  static serviceUnavailable(res: Response, message: string = 'Service Unavailable', code?: string): void {
    ResponseHelper.error(res, message, 503, code);
  }

  /**
   * Send validation error response
   */
  static validationError(res: Response, errors: string[] | string, code: string = 'VALIDATION_ERROR'): void {
    const message = Array.isArray(errors) ? errors.join(', ') : errors;
    ResponseHelper.error(res, `Validation failed: ${message}`, 400, code);
  }

  /**
   * Send paginated response
   */
  static paginated<T>(
    res: Response,
    data: T[],
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      hasNext: boolean;
      hasPrev: boolean;
      limit: number;
    },
    message?: string
  ): void {
    ResponseHelper.success(res, {
      items: data,
      pagination
    }, message);
  }

  /**
   * Send async operation accepted response
   */
  static asyncAccepted(res: Response, jobId: string, message: string = 'Request accepted for processing'): void {
    ResponseHelper.accepted(res, { jobId }, message);
  }

  /**
   * Send health check response
   */
  static healthCheck(
    res: Response, 
    status: 'healthy' | 'degraded' | 'unhealthy',
    services?: { [key: string]: any },
    uptime?: number
  ): void {
    const statusCode = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;
    
    ResponseHelper.success(res, {
      status,
      services,
      uptime,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    }, undefined, statusCode);
  }
}