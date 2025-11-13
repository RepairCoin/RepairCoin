// backend/src/domains/admin/services/analytics/PlatformAnalyticsService.ts
import { customerRepository, webhookRepository } from '../../../../repositories';
import { logger } from '../../../../utils/logger';

export interface AdminStats {
  totalCustomers: number;
  totalShops: number;
  totalTransactions: number;
  totalTokensIssued: number;
  totalRedemptions: number;
  totalSupply: number;
  totalTokensInCirculation: number;
  recentActivity: {
    newCustomersToday: number;
    transactionsToday: number;
    tokensIssuedToday: number;
  };
}

/**
 * PlatformAnalyticsService
 * Handles real-time monitoring, system health, alerts, and performance metrics
 * Extracted from AdminService for better organization
 */
export class PlatformAnalyticsService {

  /**
   * Check system health status across all components
   */
  async checkSystemHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      database: { status: string; latency?: number };
      timestamp: string;
      uptime: number;
      memory: { used: number; total: number };
    };
  }> {
    try {
      // Check various system components
      const dbHealth = await customerRepository.healthCheck();

      // Could check other services too:
      // - Redis connectivity
      // - External API health
      // - Blockchain connectivity
      // - Token contract status

      const isHealthy = dbHealth.status === 'healthy';

      return {
        status: isHealthy ? 'healthy' : 'degraded',
        details: {
          database: dbHealth,
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
          }
        }
      };
    } catch (error) {
      logger.error('System health check failed:', error);
      return {
        status: 'unhealthy',
        details: {
          database: { status: 'unhealthy' },
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
          }
        }
      };
    }
  }

  /**
   * Get real-time platform statistics with system health
   * NOTE: This method depends on AdminService.getPlatformStatistics()
   * We pass it as a parameter to avoid circular dependency
   */
  async getRealTimePlatformStats(
    getPlatformStats: () => Promise<AdminStats>
  ): Promise<{
    totalCustomers: number;
    totalShops: number;
    totalTransactions: number;
    systemHealth: Awaited<ReturnType<typeof this.checkSystemHealth>>;
    recentEvents: unknown[];
  }> {
    try {
      const [basicStats, systemHealth] = await Promise.all([
        getPlatformStats(),
        this.checkSystemHealth()
      ]);

      return {
        ...basicStats,
        systemHealth,
        recentEvents: [] // Could get from event bus history
      };
    } catch (error) {
      logger.error('Failed to get real-time platform stats:', error);
      throw error;
    }
  }

  /**
   * Get recent system alerts
   */
  async getRecentAlerts(limit: number = 50): Promise<Array<{
    id: number;
    type: string;
    severity: string;
    message: string;
    timestamp: string;
    data: unknown;
  }>> {
    try {
      // In a real system, you'd query an alerts table
      // For now, return recent failed webhooks as alerts
      const failedWebhooks = await webhookRepository.getFailedWebhooks(limit);

      return failedWebhooks.map((webhook, index) => ({
        id: index + 1,
        type: 'webhook_failure',
        severity: 'warning',
        message: `Webhook ${webhook.event} failed`,
        timestamp: webhook.timestamp instanceof Date
          ? webhook.timestamp.toISOString()
          : String(webhook.timestamp),
        data: webhook
      }));
    } catch (error) {
      logger.error('Failed to get recent alerts:', error);
      return [];
    }
  }

  /**
   * Get system performance metrics
   */
  async getPerformanceMetrics(): Promise<{
    averageResponseTime: number;
    errorRate: number;
    throughput: number;
    systemLoad: {
      cpu: NodeJS.CpuUsage;
      memory: NodeJS.MemoryUsage;
      uptime: number;
    };
  }> {
    try {
      // In a real system, you'd get these from monitoring services
      // For now, return mock/basic data

      return {
        averageResponseTime: 245, // ms
        errorRate: 2.1, // percentage
        throughput: 150, // requests per minute
        systemLoad: {
          cpu: process.cpuUsage(),
          memory: process.memoryUsage(),
          uptime: process.uptime()
        }
      };
    } catch (error) {
      logger.error('Failed to get performance metrics:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const platformAnalyticsService = new PlatformAnalyticsService();
