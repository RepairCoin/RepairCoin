// backend/src/services/ContractMonitoringService.ts
import { logger } from '../utils/logger';
import { EmailService } from './EmailService';
import { AdminService } from '../domains/admin/services/AdminService';

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
    // This is a placeholder for more sophisticated monitoring
    // Could include:
    // - Large token movements
    // - Unusual transaction patterns
    // - Failed transaction spikes
    // - Multiple emergency operations
    
    try {
      // Example: Check for excessive failed transactions in the last hour
      // const recentFailures = await this.getRecentFailedTransactions();
      // if (recentFailures > THRESHOLD) {
      //   await this.sendAlert({...});
      // }
      
    } catch (error) {
      logger.error('Error checking for unusual activity:', error);
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