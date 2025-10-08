// backend/src/repositories/HealthRepository.ts
import { BaseRepository } from './BaseRepository';

export interface DatabaseHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  details: {
    connection_pool: {
      total_connections?: number;
      active_connections?: number;
      idle_connections?: number;
      max_connections?: number;
    };
    database: {
      size?: string;
      tables_count?: number;
      response_time_ms?: number;
    };
  };
}

export class HealthRepository extends BaseRepository {
  async healthCheck(): Promise<DatabaseHealthStatus> {
    const startTime = Date.now();
    
    try {
      // Test basic connectivity with a simple query
      await this.pool.query('SELECT 1 as test');
      
      // Get connection pool stats
      const poolStats = await this.getConnectionPoolStats();
      
      // Get database statistics
      const dbStats = await this.getDatabaseStats();
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: responseTime > 5000 ? 'degraded' : 'healthy',
        details: {
          connection_pool: poolStats,
          database: {
            ...dbStats,
            response_time_ms: responseTime
          }
        }
      };
    } catch (error) {
      console.error('Database health check failed:', error);
      return {
        status: 'unhealthy',
        details: {
          connection_pool: {},
          database: {
            response_time_ms: Date.now() - startTime
          }
        }
      };
    }
  }

  private async getConnectionPoolStats() {
    try {
      // Try to get connection pool information
      const result = await this.pool.query(`
        SELECT 
          max_conn as max_connections,
          used as active_connections,
          res_for_super as reserved_connections
        FROM pg_stat_activity 
        WHERE state = 'active'
        LIMIT 1
      `);
      
      return {
        active_connections: result.rows.length,
        max_connections: 100 // Default pg pool size
      };
    } catch (error) {
      // Fallback to basic connection count
      try {
        const activeResult = await this.pool.query(`
          SELECT count(*) as active_connections 
          FROM pg_stat_activity 
          WHERE state = 'active'
        `);
        
        return {
          active_connections: parseInt(activeResult.rows[0]?.active_connections || '0'),
          max_connections: 100
        };
      } catch (fallbackError) {
        return {
          active_connections: 1,
          max_connections: 100
        };
      }
    }
  }

  private async getDatabaseStats() {
    try {
      // Get database size
      const sizeResult = await this.pool.query(`
        SELECT pg_size_pretty(pg_database_size(current_database())) as db_size
      `);
      
      // Get table count
      const tableResult = await this.pool.query(`
        SELECT count(*) as table_count 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      
      return {
        size: sizeResult.rows[0]?.db_size || 'Unknown',
        tables_count: parseInt(tableResult.rows[0]?.table_count || '0')
      };
    } catch (error) {
      return {
        size: 'Unknown',
        tables_count: 0
      };
    }
  }

  async checkTableHealth() {
    try {
      // Check if core tables exist and have expected structure
      const coreTableChecks = await Promise.allSettled([
        this.pool.query('SELECT count(*) FROM customers LIMIT 1'),
        this.pool.query('SELECT count(*) FROM shops LIMIT 1'),
        this.pool.query('SELECT count(*) FROM transactions LIMIT 1'),
        this.pool.query('SELECT count(*) FROM shop_subscriptions LIMIT 1')
      ]);

      const healthyTables = coreTableChecks.filter(result => result.status === 'fulfilled').length;
      const totalTables = coreTableChecks.length;

      return {
        healthy_tables: healthyTables,
        total_core_tables: totalTables,
        status: healthyTables === totalTables ? 'healthy' : 'degraded'
      };
    } catch (error) {
      return {
        healthy_tables: 0,
        total_core_tables: 4,
        status: 'unhealthy'
      };
    }
  }
}