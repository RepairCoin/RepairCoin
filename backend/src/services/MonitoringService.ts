import { databaseService } from './DatabaseService';
import { logger } from '../utils/logger';

export class MonitoringService {
  private intervalId: NodeJS.Timeout | null = null;
  
  startMonitoring(intervalMinutes: number = 30) {
    // Run initial checks
    this.runChecks();
    
    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this.runChecks();
    }, intervalMinutes * 60 * 1000);
    
    logger.info(`Monitoring service started, running checks every ${intervalMinutes} minutes`);
  }
  
  stopMonitoring() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Monitoring service stopped');
    }
  }
  
  async runChecks() {
    logger.info('Running monitoring checks...');
    
    try {
      await Promise.all([
        databaseService.checkLowTreasuryBalance(),
        databaseService.checkPendingApplications(),
        databaseService.checkUnusualActivity()
      ]);
      
      logger.info('Monitoring checks completed');
    } catch (error) {
      logger.error('Error running monitoring checks:', error);
    }
  }
}

export const monitoringService = new MonitoringService();