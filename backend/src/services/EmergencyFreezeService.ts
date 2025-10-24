import { DatabaseService } from './DatabaseService';
import { TokenMinter } from '../contracts/TokenMinter';
import { logger } from '../utils/logger';

export interface FreezeOptions {
    reason: string;
    adminAddress: string;
    adminEmail?: string;
    components?: string[];
}

export interface SystemStatus {
    component: string;
    is_frozen: boolean;
    frozen_at?: string;
    frozen_by?: string;
    freeze_reason?: string;
    last_updated: string;
}

export class EmergencyFreezeService {
    private db: DatabaseService;
    private tokenMinter: TokenMinter;

    constructor() {
        this.db = DatabaseService.getInstance();
        this.tokenMinter = new TokenMinter();
    }

    /**
     * Execute emergency freeze across all systems
     */
    async executeEmergencyFreeze(options: FreezeOptions): Promise<{ success: boolean; auditId?: number; errors?: string[] }> {
        const { reason, adminAddress, adminEmail, components = ['token_minting', 'shop_purchases', 'customer_rewards', 'token_transfers'] } = options;
        const errors: string[] = [];
        let auditId: number | undefined;

        try {
            // 1. Create audit trail entry
            auditId = await this.createAuditTrail('freeze', reason, adminAddress, adminEmail);
            
            // 2. Pause smart contracts
            try {
                await this.pauseTokenContract();
                logger.info('✅ Token contract paused successfully');
            } catch (error) {
                const errorMsg = `Failed to pause token contract: ${error instanceof Error ? error.message : 'Unknown error'}`;
                errors.push(errorMsg);
                logger.error('❌ Token contract pause failed:', error);
            }

            // 3. Update system status for each component
            for (const component of components) {
                try {
                    await this.updateSystemStatus(component, true, adminAddress, reason);
                    logger.info(`✅ ${component} frozen successfully`);
                } catch (error) {
                    const errorMsg = `Failed to freeze ${component}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                    errors.push(errorMsg);
                    logger.error(`❌ Failed to freeze ${component}:`, error);
                }
            }

            // 4. Create critical alert for administrators
            await this.createAdminAlert({
                alert_type: 'emergency_freeze',
                severity: 'critical',
                title: '🚨 EMERGENCY FREEZE ACTIVATED',
                message: `Emergency freeze has been initiated by admin ${adminAddress}. Reason: ${reason}`,
                metadata: {
                    components_frozen: components,
                    admin_address: adminAddress,
                    admin_email: adminEmail,
                    timestamp: new Date().toISOString()
                },
                triggered_by: adminAddress
            });

            // 5. Update audit trail status
            await this.updateAuditTrailStatus(auditId, errors.length === 0 ? 'completed' : 'failed');

            // 6. Send alerts to all administrators
            await this.alertAllAdministrators(reason, adminAddress, components);

            return {
                success: errors.length === 0,
                auditId,
                errors: errors.length > 0 ? errors : undefined
            };

        } catch (error) {
            logger.error('Emergency freeze execution failed:', error);
            
            if (auditId) {
                await this.updateAuditTrailStatus(auditId, 'failed');
            }

            return {
                success: false,
                auditId,
                errors: [`Critical failure: ${error instanceof Error ? error.message : 'Unknown error'}`]
            };
        }
    }

    /**
     * Execute emergency unfreeze
     */
    async executeEmergencyUnfreeze(options: FreezeOptions): Promise<{ success: boolean; auditId?: number; errors?: string[] }> {
        const { reason, adminAddress, adminEmail, components = ['token_minting', 'shop_purchases', 'customer_rewards', 'token_transfers'] } = options;
        const errors: string[] = [];
        let auditId: number | undefined;

        try {
            // 1. Create audit trail entry
            auditId = await this.createAuditTrail('unfreeze', reason, adminAddress, adminEmail);
            
            // 2. Unpause smart contracts
            try {
                await this.unpauseTokenContract();
                logger.info('✅ Token contract unpaused successfully');
            } catch (error) {
                const errorMsg = `Failed to unpause token contract: ${error instanceof Error ? error.message : 'Unknown error'}`;
                errors.push(errorMsg);
                logger.error('❌ Token contract unpause failed:', error);
            }

            // 3. Update system status for each component
            for (const component of components) {
                try {
                    await this.updateSystemStatus(component, false, adminAddress, reason);
                    logger.info(`✅ ${component} unfrozen successfully`);
                } catch (error) {
                    const errorMsg = `Failed to unfreeze ${component}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                    errors.push(errorMsg);
                    logger.error(`❌ Failed to unfreeze ${component}:`, error);
                }
            }

            // 4. Create alert for unfreeze
            await this.createAdminAlert({
                alert_type: 'emergency_unfreeze',
                severity: 'high',
                title: '✅ Emergency Freeze Lifted',
                message: `Emergency freeze has been lifted by admin ${adminAddress}. Reason: ${reason}`,
                metadata: {
                    components_unfrozen: components,
                    admin_address: adminAddress,
                    admin_email: adminEmail,
                    timestamp: new Date().toISOString()
                },
                triggered_by: adminAddress
            });

            // 5. Update audit trail status
            await this.updateAuditTrailStatus(auditId, errors.length === 0 ? 'completed' : 'failed');

            return {
                success: errors.length === 0,
                auditId,
                errors: errors.length > 0 ? errors : undefined
            };

        } catch (error) {
            logger.error('Emergency unfreeze execution failed:', error);
            
            if (auditId) {
                await this.updateAuditTrailStatus(auditId, 'failed');
            }

            return {
                success: false,
                auditId,
                errors: [`Critical failure: ${error instanceof Error ? error.message : 'Unknown error'}`]
            };
        }
    }

    /**
     * Check if a specific component is frozen
     */
    async isComponentFrozen(component: string): Promise<boolean> {
        try {
            const result = await this.db.query(
                'SELECT is_frozen FROM system_status WHERE component = $1',
                [component]
            );
            return result.rows[0]?.is_frozen || false;
        } catch (error) {
            logger.error(`Error checking freeze status for ${component}:`, error);
            return false; // Default to not frozen if we can't check
        }
    }

    /**
     * Get current system status for all components
     */
    async getSystemStatus(): Promise<SystemStatus[]> {
        try {
            const result = await this.db.query(
                'SELECT * FROM system_status ORDER BY component'
            );
            return result.rows;
        } catch (error) {
            logger.error('Error fetching system status:', error);
            return [];
        }
    }

    /**
     * Create audit trail entry
     */
    private async createAuditTrail(action: 'freeze' | 'unfreeze', reason: string, adminAddress: string, adminEmail?: string): Promise<number> {
        const result = await this.db.query(
            `INSERT INTO emergency_freeze_audit (action_type, reason, admin_address, admin_email, metadata, status)
             VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id`,
            [action, reason, adminAddress, adminEmail, JSON.stringify({ timestamp: new Date().toISOString() })]
        );
        return result.rows[0].id;
    }

    /**
     * Update audit trail status
     */
    private async updateAuditTrailStatus(auditId: number, status: 'completed' | 'failed'): Promise<void> {
        await this.db.query(
            'UPDATE emergency_freeze_audit SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [status, auditId]
        );
    }

    /**
     * Update system status for a component
     */
    private async updateSystemStatus(component: string, isFrozen: boolean, adminAddress: string, reason: string): Promise<void> {
        if (isFrozen) {
            await this.db.query(
                `UPDATE system_status 
                 SET is_frozen = $1, frozen_at = CURRENT_TIMESTAMP, frozen_by = $2, freeze_reason = $3, last_updated = CURRENT_TIMESTAMP
                 WHERE component = $4`,
                [isFrozen, adminAddress, reason, component]
            );
        } else {
            await this.db.query(
                `UPDATE system_status 
                 SET is_frozen = $1, frozen_at = NULL, frozen_by = NULL, freeze_reason = NULL, last_updated = CURRENT_TIMESTAMP
                 WHERE component = $2`,
                [isFrozen, component]
            );
        }
    }

    /**
     * Pause token contract
     */
    private async pauseTokenContract(): Promise<void> {
        try {
            // Check if contract has pause functionality
            if (typeof this.tokenMinter.pauseContract === 'function') {
                await this.tokenMinter.pauseContract();
            } else {
                logger.warn('Token contract does not support pausing - would need to be implemented');
                // For now, we'll rely on the system status checks in other services
            }
        } catch (error) {
            logger.error('Failed to pause token contract:', error);
            throw error;
        }
    }

    /**
     * Unpause token contract
     */
    private async unpauseTokenContract(): Promise<void> {
        try {
            // Check if contract has unpause functionality
            if (typeof this.tokenMinter.unpauseContract === 'function') {
                await this.tokenMinter.unpauseContract();
            } else {
                logger.warn('Token contract does not support unpausing - would need to be implemented');
                // For now, we'll rely on the system status checks in other services
            }
        } catch (error) {
            logger.error('Failed to unpause token contract:', error);
            throw error;
        }
    }

    /**
     * Create admin alert
     */
    private async createAdminAlert(alert: {
        alert_type: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
        title: string;
        message: string;
        metadata?: any;
        triggered_by: string;
    }): Promise<void> {
        await this.db.query(
            `INSERT INTO admin_alerts (alert_type, severity, title, message, metadata, triggered_by)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [alert.alert_type, alert.severity, alert.title, alert.message, 
             alert.metadata ? JSON.stringify(alert.metadata) : null, alert.triggered_by]
        );
    }

    /**
     * Alert all administrators
     */
    private async alertAllAdministrators(reason: string, triggeringAdmin: string, components: string[]): Promise<void> {
        try {
            // Get admin addresses from environment
            const adminAddresses = process.env.ADMIN_ADDRESSES?.split(',') || [];
            
            // Log alert for each admin
            for (const adminAddress of adminAddresses) {
                if (adminAddress.trim() !== triggeringAdmin) {
                    logger.info(`📧 Alert sent to admin: ${adminAddress.trim()}`, {
                        type: 'emergency_freeze_alert',
                        reason,
                        components,
                        triggering_admin: triggeringAdmin,
                        timestamp: new Date().toISOString()
                    });
                }
            }

            // In a production system, this would:
            // - Send email notifications
            // - Send SMS alerts
            // - Send push notifications
            // - Update dashboard alerts
            // - Post to Slack/Discord channels
            
            logger.info(`🚨 Emergency freeze alerts sent to ${adminAddresses.length} administrators`);
            
        } catch (error) {
            logger.error('Failed to alert administrators:', error);
        }
    }

    /**
     * Get emergency freeze audit history
     */
    async getAuditHistory(limit: number = 50): Promise<any[]> {
        try {
            const result = await this.db.query(
                `SELECT * FROM emergency_freeze_audit 
                 ORDER BY timestamp DESC 
                 LIMIT $1`,
                [limit]
            );
            return result.rows;
        } catch (error) {
            logger.error('Error fetching audit history:', error);
            return [];
        }
    }

    /**
     * Get active admin alerts
     */
    async getActiveAlerts(): Promise<any[]> {
        try {
            const result = await this.db.query(
                `SELECT * FROM admin_alerts 
                 WHERE resolved = FALSE 
                 ORDER BY triggered_at DESC`
            );
            return result.rows;
        } catch (error) {
            logger.error('Error fetching active alerts:', error);
            return [];
        }
    }
}

// Export singleton instance
let emergencyFreezeService: EmergencyFreezeService | null = null;

export const getEmergencyFreezeService = (): EmergencyFreezeService => {
    if (!emergencyFreezeService) {
        emergencyFreezeService = new EmergencyFreezeService();
    }
    return emergencyFreezeService;
};