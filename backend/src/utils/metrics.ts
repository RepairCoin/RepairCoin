// backend/src/utils/metrics.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

interface MetricData {
  route: string;
  method: string;
  statusCode: number;
  responseTime: number;
  timestamp: Date;
}

class MetricsCollector {
  private metrics: MetricData[] = [];
  private readonly maxMetrics = 10000;

  recordMetric(metric: MetricData): void {
    this.metrics.push(metric);
    
    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  getMetrics(timeRangeMs: number = 3600000): {
    totalRequests: number;
    averageResponseTime: number;
    successRate: number;
    routeBreakdown: { [route: string]: number };
    errorsByStatus: { [status: string]: number };
  } {
    const cutoff = new Date(Date.now() - timeRangeMs);
    const recentMetrics = this.metrics.filter(m => m.timestamp > cutoff);

    const totalRequests = recentMetrics.length;
    const averageResponseTime = recentMetrics.length > 0 
      ? recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length 
      : 0;

    const successCount = recentMetrics.filter(m => m.statusCode < 400).length;
    const successRate = totalRequests > 0 ? (successCount / totalRequests) * 100 : 0;

    const routeBreakdown = recentMetrics.reduce((acc, m) => {
      const key = `${m.method} ${m.route}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as { [route: string]: number });

    const errorsByStatus = recentMetrics
      .filter(m => m.statusCode >= 400)
      .reduce((acc, m) => {
        const key = m.statusCode.toString();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as { [status: string]: number });

    return {
      totalRequests,
      averageResponseTime,
      successRate,
      routeBreakdown,
      errorsByStatus
    };
  }

  // Alert on high error rates
  checkAlerts(): void {
    const metrics = this.getMetrics(300000); // Last 5 minutes
    
    if (metrics.successRate < 95 && metrics.totalRequests > 10) {
      logger.error('High error rate detected', {
        successRate: metrics.successRate,
        totalRequests: metrics.totalRequests,
        errorsByStatus: metrics.errorsByStatus
      });
    }

    if (metrics.averageResponseTime > 5000) {
      logger.warn('High response time detected', {
        averageResponseTime: metrics.averageResponseTime
      });
    }
  }
}

export const metricsCollector = new MetricsCollector();

// Middleware to collect metrics
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    
    metricsCollector.recordMetric({
      route: req.route?.path || req.path,
      method: req.method,
      statusCode: res.statusCode,
      responseTime,
      timestamp: new Date()
    });

    // Log slow requests
    if (responseTime > 2000) {
      logger.warn('Slow request detected', {
        method: req.method,
        path: req.path,
        responseTime,
        statusCode: res.statusCode
      });
    }
  });

  next();
};

// Schedule alert checks
setInterval(() => {
  metricsCollector.checkAlerts();
}, 60000); // Check every minute

