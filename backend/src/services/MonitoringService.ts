import { logger } from '../utils/logger';
import { healthRepository, treasuryRepository, customerRepository, shopRepository } from '../repositories';
import { getTokenMinter } from '../contracts/TokenMinter';
import { contractMonitoringService } from './ContractMonitoringService';

export class MonitoringService {
  private intervalId: NodeJS.Timeout | null = null;
  
  startMonitoring(intervalMinutes: number = 30) {
    // Run initial checks
    this.runChecks();
    
    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this.runChecks();
    }, intervalMinutes * 60 * 1000);
    
    // Start contract monitoring (every minute)
    contractMonitoringService.start(60000);
    
    logger.info(`Monitoring service started, running checks every ${intervalMinutes} minutes`);
  }
  
  stopMonitoring() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    // Stop contract monitoring
    contractMonitoringService.stop();
    
    logger.info('Monitoring service stopped');
  }
  
  async runChecks() {
    logger.info('Running monitoring checks...');
    
    try {
      const checks = await Promise.allSettled([
        this.checkDatabaseHealth(),
        this.checkLowTreasuryBalance(),
        this.checkPendingApplications(),
        this.checkUnusualActivity(),
        this.checkBlockchainHealth()
      ]);

      // Log results
      const results = checks.map((check, index) => {
        const checkNames = ['Database', 'Treasury', 'Applications', 'Activity', 'Blockchain'];
        if (check.status === 'fulfilled') {
          return `${checkNames[index]}: ${check.value.status}`;
        } else {
          return `${checkNames[index]}: Error - ${check.reason}`;
        }
      });

      logger.info('Monitoring checks completed:', { results });
    } catch (error) {
      logger.error('Error running monitoring checks:', error);
    }
  }

  private async checkDatabaseHealth() {
    try {
      const health = await healthRepository.healthCheck();
      const tableHealth = await healthRepository.checkTableHealth();
      
      if (health.status === 'unhealthy' || tableHealth.status === 'unhealthy') {
        logger.warn('Database health check failed', { health, tableHealth });
        return { status: 'unhealthy', details: { health, tableHealth } };
      }
      
      return { status: 'healthy', details: { health, tableHealth } };
    } catch (error) {
      logger.error('Database health check error:', error);
      return { status: 'error', error: error.message };
    }
  }

  private async checkLowTreasuryBalance() {
    try {
      // Check admin wallet balance
      const tokenMinter = getTokenMinter();
      const adminAddress = '0x761E5E59485ec6feb263320f5d636042bD9EBc8c'; // From env
      const adminBalance = await tokenMinter.getCustomerBalance(adminAddress) || 0;
      
      const LOW_BALANCE_THRESHOLD = 1000;
      
      if (adminBalance < LOW_BALANCE_THRESHOLD) {
        logger.warn('Low admin treasury balance detected', { 
          adminAddress, 
          balance: adminBalance, 
          threshold: LOW_BALANCE_THRESHOLD 
        });
        return { status: 'warning', balance: adminBalance, threshold: LOW_BALANCE_THRESHOLD };
      }
      
      return { status: 'healthy', balance: adminBalance };
    } catch (error) {
      logger.error('Treasury balance check error:', error);
      return { status: 'error', error: error.message };
    }
  }

  private async checkPendingApplications() {
    try {
      // Check for shops pending verification
      const pendingShops = await treasuryRepository.query(`
        SELECT COUNT(*) as pending_count
        FROM shops 
        WHERE verified = false AND created_at > NOW() - INTERVAL '30 days'
      `);
      
      const pendingCount = parseInt(pendingShops.rows[0]?.pending_count || '0');
      const HIGH_PENDING_THRESHOLD = 10;
      
      if (pendingCount > HIGH_PENDING_THRESHOLD) {
        logger.warn('High number of pending shop applications', { 
          pendingCount, 
          threshold: HIGH_PENDING_THRESHOLD 
        });
        return { status: 'warning', pendingCount, threshold: HIGH_PENDING_THRESHOLD };
      }
      
      return { status: 'healthy', pendingCount };
    } catch (error) {
      logger.error('Pending applications check error:', error);
      return { status: 'error', error: error.message };
    }
  }

  private async checkUnusualActivity() {
    try {
      // Check for unusual transaction patterns in last hour
      const recentTransactions = await treasuryRepository.query(`
        SELECT 
          COUNT(*) as transaction_count,
          COUNT(DISTINCT customer_address) as unique_customers,
          AVG(amount) as avg_amount,
          MAX(amount) as max_amount
        FROM transactions 
        WHERE created_at > NOW() - INTERVAL '1 hour'
      `);

      const stats = recentTransactions.rows[0];
      const transactionCount = parseInt(stats.transaction_count || '0');
      const uniqueCustomers = parseInt(stats.unique_customers || '0');
      const maxAmount = parseFloat(stats.max_amount || '0');

      const HIGH_TRANSACTION_THRESHOLD = 100;
      const HIGH_AMOUNT_THRESHOLD = 1000;

      const warnings = [];
      if (transactionCount > HIGH_TRANSACTION_THRESHOLD) {
        warnings.push(`High transaction volume: ${transactionCount}`);
      }
      if (maxAmount > HIGH_AMOUNT_THRESHOLD) {
        warnings.push(`Large transaction detected: ${maxAmount} RCN`);
      }

      if (warnings.length > 0) {
        logger.warn('Unusual activity detected', { warnings, stats });
        return { status: 'warning', warnings, stats };
      }

      return { status: 'healthy', stats };
    } catch (error) {
      logger.error('Unusual activity check error:', error);
      return { status: 'error', error: error.message };
    }
  }

  private async checkBlockchainHealth() {
    try {
      const tokenMinter = getTokenMinter();
      
      // Check if contract is accessible
      const contractStats = await tokenMinter.getContractStats();
      
      if (!contractStats) {
        logger.warn('Cannot access blockchain contract');
        return { status: 'warning', error: 'Contract inaccessible' };
      }

      // Check if contract is paused
      try {
        const isPaused = await tokenMinter.isContractPaused();
        if (isPaused) {
          logger.warn('Contract is paused');
          return { status: 'warning', error: 'Contract paused' };
        }
      } catch (error) {
        // Method might not exist, continue
      }

      return { status: 'healthy', contractStats };
    } catch (error) {
      logger.error('Blockchain health check error:', error);
      return { status: 'error', error: error.message };
    }
  }
}

export const monitoringService = new MonitoringService();