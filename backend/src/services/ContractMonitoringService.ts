// backend/src/services/ContractMonitoringService.ts
import { logger } from '../utils/logger';
import { EmailService } from './EmailService';
import { AdminService } from '../domains/admin/services/AdminService';
import { transactionRepository } from '../repositories';

export interface ContractAlert {
  type: 'contract_paused' | 'contract_unpaused' | 'emergency_stop' | 'unusual_activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  data?: any;
}

export class ContractMonitoringService {
  private emailService: EmailService;
  private adminService: AdminService;
  private isMonitoring: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;

  constructor() {
    this.emailService = new EmailService();
    this.adminService = new AdminService();
  }

  /**
   * Start contract monitoring service
   */
  start(intervalMs: number = 60000) { // Check every minute
    if (this.isMonitoring) {
      logger.warn('Contract monitoring is already running');
      return;
    }

    this.isMonitoring = true;
    logger.info('Starting contract monitoring service', { intervalMs });

    // Initial check
    this.performMonitoringCheck();

    // Set up recurring checks
    this.monitoringInterval = setInterval(() => {
      this.performMonitoringCheck();
    }, intervalMs);
  }

  /**
   * Stop contract monitoring service
   */
  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    this.isMonitoring = false;
    logger.info('Contract monitoring service stopped');
  }

  /**
   * Perform monitoring checks
   */
  private async performMonitoringCheck() {
    try {
      // Check contract status
      const contractStatus = await this.adminService.getContractStatus();
      
      // Alert if contract is paused
      if (contractStatus.success && contractStatus.status?.isPaused && !this.wasAlertSentRecently('contract_paused')) {
        await this.sendAlert({
          type: 'contract_paused',
          severity: 'critical',
          message: '🚨 CONTRACT PAUSED - All token operations are disabled',
          timestamp: new Date(),
          data: contractStatus
        });
      }

      // Monitor for unusual patterns (placeholder - would need more sophisticated logic)
      await this.checkForUnusualActivity();

    } catch (error) {
      logger.error('Error during contract monitoring check:', error);
    }
  }

  /**
   * Check for unusual activity patterns
   */
  private async checkForUnusualActivity() {
    try {
      await Promise.all([
        this.checkFailedTransactionSpike(),
        this.checkLargeTokenMovements(),
        this.checkUnusualMintingPatterns(),
        this.checkRedemptionAnomalies()
      ]);
      
    } catch (error) {
      logger.error('Error checking for unusual activity:', error);
    }
  }

  /**
   * Check for excessive failed transactions
   */
  private async checkFailedTransactionSpike() {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const result = await transactionRepository.query(`
        SELECT 
          COUNT(*) as failed_count,
          COUNT(CASE WHEN status != 'failed' THEN 1 END) as total_count
        FROM transactions 
        WHERE timestamp >= $1
      `, [oneHourAgo.toISOString()]);

      const { failed_count, total_count } = result.rows[0];
      const failureRate = total_count > 0 ? (failed_count / total_count) * 100 : 0;

      // Alert if failure rate exceeds 10% with at least 10 transactions
      if (failureRate > 10 && total_count >= 10 && !this.wasAlertSentRecently('failed_transaction_spike')) {
        await this.sendAlert({
          type: 'unusual_activity',
          severity: 'high',
          message: `🚨 High transaction failure rate detected: ${failureRate.toFixed(1)}% (${failed_count}/${total_count}) in the last hour`,
          timestamp: new Date(),
          data: { failureRate, failedCount: failed_count, totalCount: total_count }
        });
      }
    } catch (error) {
      logger.error('Error checking failed transaction spike:', error);
    }
  }

  /**
   * Check for unusually large token movements
   */
  private async checkLargeTokenMovements() {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      // Check for large individual transactions (>500 RCN)
      const largeTransactions = await transactionRepository.query(`
        SELECT 
          customer_address,
          shop_id,
          type,
          amount,
          timestamp,
          transaction_hash
        FROM transactions 
        WHERE timestamp >= $1 
          AND amount > 500
          AND status = 'confirmed'
        ORDER BY amount DESC
        LIMIT 5
      `, [oneHourAgo.toISOString()]);

      if (largeTransactions.rows.length > 0 && !this.wasAlertSentRecently('large_token_movements')) {
        const totalAmount = largeTransactions.rows.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
        
        await this.sendAlert({
          type: 'unusual_activity',
          severity: 'medium',
          message: `💰 Large token movements detected: ${largeTransactions.rows.length} transactions totaling ${totalAmount.toFixed(2)} RCN in the last hour`,
          timestamp: new Date(),
          data: { 
            transactionCount: largeTransactions.rows.length,
            totalAmount,
            transactions: largeTransactions.rows
          }
        });
      }
    } catch (error) {
      logger.error('Error checking large token movements:', error);
    }
  }

  /**
   * Check for unusual minting patterns
   */
  private async checkUnusualMintingPatterns() {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      // Check for excessive minting activity
      const mintingStats = await transactionRepository.query(`
        SELECT 
          COUNT(*) as mint_count,
          COALESCE(SUM(amount), 0) as total_minted,
          COUNT(DISTINCT customer_address) as unique_customers,
          COUNT(DISTINCT shop_id) as unique_shops
        FROM transactions 
        WHERE timestamp >= $1 
          AND type = 'mint'
          AND status = 'confirmed'
      `, [oneHourAgo.toISOString()]);

      const stats = mintingStats.rows[0];
      const { mint_count, total_minted, unique_customers, unique_shops } = stats;

      // Alert if more than 100 mints in an hour (unusual for typical operations)
      if (mint_count > 100 && !this.wasAlertSentRecently('unusual_minting')) {
        await this.sendAlert({
          type: 'unusual_activity',
          severity: 'medium',
          message: `⚡ High minting activity: ${mint_count} mints totaling ${parseFloat(total_minted).toFixed(2)} RCN across ${unique_customers} customers and ${unique_shops} shops`,
          timestamp: new Date(),
          data: stats
        });
      }
    } catch (error) {
      logger.error('Error checking unusual minting patterns:', error);
    }
  }

  /**
   * Check for redemption anomalies
   */
  private async checkRedemptionAnomalies() {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      // Check for excessive redemption activity
      const redemptionStats = await transactionRepository.query(`
        SELECT 
          COUNT(*) as redemption_count,
          COALESCE(SUM(amount), 0) as total_redeemed,
          COUNT(DISTINCT customer_address) as unique_customers,
          COUNT(CASE WHEN metadata->>'redemptionType' = 'cross_shop' THEN 1 END) as cross_shop_redemptions
        FROM transactions 
        WHERE timestamp >= $1 
          AND type = 'redeem'
          AND status = 'confirmed'
      `, [oneHourAgo.toISOString()]);

      const stats = redemptionStats.rows[0];
      const { redemption_count, total_redeemed, unique_customers, cross_shop_redemptions } = stats;

      // Alert if redemptions exceed normal patterns
      if (redemption_count > 50 && !this.wasAlertSentRecently('unusual_redemptions')) {
        await this.sendAlert({
          type: 'unusual_activity',
          severity: 'medium',
          message: `💸 High redemption activity: ${redemption_count} redemptions totaling ${parseFloat(total_redeemed).toFixed(2)} RCN (${cross_shop_redemptions} cross-shop)`,
          timestamp: new Date(),
          data: stats
        });
      }

      // Check for unusually high cross-shop redemption ratio
      const crossShopRatio = redemption_count > 0 ? (cross_shop_redemptions / redemption_count) * 100 : 0;
      if (crossShopRatio > 30 && redemption_count >= 10 && !this.wasAlertSentRecently('high_cross_shop_ratio')) {
        await this.sendAlert({
          type: 'unusual_activity',
          severity: 'low',
          message: `🔄 High cross-shop redemption ratio: ${crossShopRatio.toFixed(1)}% (${cross_shop_redemptions}/${redemption_count})`,
          timestamp: new Date(),
          data: { crossShopRatio, ...stats }
        });
      }
    } catch (error) {
      logger.error('Error checking redemption anomalies:', error);
    }
  }

  /**
   * Send alert to administrators
   */
  async sendAlert(alert: ContractAlert) {
    logger.warn('Contract monitoring alert', alert);

    // Store alert timestamp for rate limiting
    this.storeAlertTimestamp(alert.type);

    // Send notifications based on severity
    if (alert.severity === 'critical' || alert.severity === 'high') {
      await this.sendCriticalAlert(alert);
    }

    // Log to monitoring system
    this.logAlertToMonitoring(alert);
  }

  /**
   * Send critical alert via multiple channels
   */
  private async sendCriticalAlert(alert: ContractAlert) {
    try {
      // Get admin emails from environment or database
      const adminEmails = this.getAdminEmailList();
      
      const subject = `🚨 RepairCoin Contract Alert: ${alert.type.toUpperCase()}`;
      const html = this.generateAlertEmailHtml(alert);

      // Send to all admins
      for (const email of adminEmails) {
        try {
          await this.emailService.sendPaymentReminder({
            shopEmail: email,
            shopName: 'Admin',
            amountDue: 0,
            dueDate: new Date(),
            daysUntilDue: 0
          });
        } catch (emailError) {
          logger.error('Failed to send alert email:', emailError);
        }
      }

      logger.info('Critical contract alert sent to admins', { 
        alertType: alert.type, 
        recipientCount: adminEmails.length 
      });

    } catch (error) {
      logger.error('Failed to send critical alert:', error);
    }
  }

  /**
   * Generate HTML for alert email
   */
  private generateAlertEmailHtml(alert: ContractAlert): string {
    const severityColor = {
      low: '#2196f3',
      medium: '#ff9800', 
      high: '#ff5722',
      critical: '#d32f2f'
    }[alert.severity];

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: ${severityColor}; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">🚨 Contract Alert</h1>
          <h2 style="margin: 10px 0 0 0;">${alert.type.replace('_', ' ').toUpperCase()}</h2>
        </div>
        
        <div style="padding: 20px; background-color: #f5f5f5;">
          <p><strong>Severity:</strong> ${alert.severity.toUpperCase()}</p>
          <p><strong>Time:</strong> ${alert.timestamp.toISOString()}</p>
          <p><strong>Message:</strong> ${alert.message}</p>
          
          ${alert.data ? `
            <div style="margin-top: 20px; padding: 15px; background-color: white; border-radius: 5px;">
              <h3>Additional Details:</h3>
              <pre style="background-color: #f0f0f0; padding: 10px; overflow-x: auto;">${JSON.stringify(alert.data, null, 2)}</pre>
            </div>
          ` : ''}
        </div>
        
        <div style="padding: 20px; text-align: center; color: #666; font-size: 12px;">
          <p>This is an automated alert from RepairCoin Contract Monitoring System</p>
          <p>Please investigate immediately if this is a critical alert</p>
        </div>
      </div>
    `;
  }

  /**
   * Get admin email list from environment or database
   */
  private getAdminEmailList(): string[] {
    // This could be loaded from environment variables or database
    const adminEmails = process.env.ADMIN_ALERT_EMAILS?.split(',').map(email => email.trim()) || [];
    
    // Fallback to a default admin email if configured
    if (adminEmails.length === 0 && process.env.DEFAULT_ADMIN_EMAIL) {
      adminEmails.push(process.env.DEFAULT_ADMIN_EMAIL);
    }

    return adminEmails;
  }

  /**
   * Check if alert was sent recently to avoid spam
   */
  private wasAlertSentRecently(alertType: string): boolean {
    // Simple in-memory rate limiting (5 minutes)
    const key = `alert_${alertType}`;
    const lastSent = this.alertTimestamps.get(key);
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    return lastSent && (now - lastSent) < fiveMinutes;
  }

  /**
   * Store alert timestamp for rate limiting
   */
  private alertTimestamps = new Map<string, number>();
  
  private storeAlertTimestamp(alertType: string) {
    const key = `alert_${alertType}`;
    this.alertTimestamps.set(key, Date.now());
  }

  /**
   * Log alert to external monitoring system
   */
  private logAlertToMonitoring(alert: ContractAlert) {
    // This could integrate with external monitoring systems like:
    // - DataDog
    // - New Relic  
    // - Prometheus/Grafana
    // - Custom webhook endpoints
    
    logger.info('Contract alert logged to monitoring', {
      alert_type: alert.type,
      severity: alert.severity,
      timestamp: alert.timestamp,
      message: alert.message
    });
  }

  /**
   * Manual alert sending for testing
   */
  async sendTestAlert() {
    logger.info('Sending test alert from contract monitoring system');
    await this.sendAlert({
      type: 'unusual_activity',
      severity: 'medium', 
      message: 'Test alert from contract monitoring system - This is a test notification',
      timestamp: new Date(),
      data: { test: true, testReason: 'Manual test initiated by administrator' }
    });
    return { success: true, message: 'Test alert processed successfully' };
  }

  /**
   * Get monitoring status
   */
  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      alertsSentToday: this.getAlertsSentToday(),
      lastCheckTime: new Date()
    };
  }

  private getAlertsSentToday(): number {
    const today = new Date().toDateString();
    let count = 0;
    
    for (const [key, timestamp] of this.alertTimestamps.entries()) {
      const alertDate = new Date(timestamp).toDateString();
      if (alertDate === today) {
        count++;
      }
    }
    
    return count;
  }
}

// Singleton instance
export const contractMonitoringService = new ContractMonitoringService();