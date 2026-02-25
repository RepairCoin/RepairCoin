import { BaseRepository } from './BaseRepository';
import { logger } from '../utils/logger';

export interface GeneralNotificationPreferences {
  id: string;
  userAddress: string;
  userType: 'customer' | 'shop' | 'admin';

  // Platform & System Updates
  platformUpdates: boolean;
  maintenanceAlerts: boolean;
  newFeatures: boolean;

  // Account & Security
  securityAlerts: boolean;
  loginNotifications: boolean;
  passwordChanges: boolean;

  // Tokens & Rewards (Customer only)
  tokenReceived: boolean;
  tokenRedeemed: boolean;
  rewardsEarned: boolean;

  // Orders & Services (Customer only)
  orderUpdates: boolean;
  serviceApproved: boolean;
  reviewRequests: boolean;

  // Shop Operations (Shop only)
  newOrders: boolean;
  customerMessages: boolean;
  lowTokenBalance: boolean;
  subscriptionReminders: boolean;

  // Admin Alerts (Admin only)
  systemAlerts: boolean;
  userReports: boolean;
  treasuryChanges: boolean;

  // Marketing & Promotions (All users)
  promotions: boolean;
  newsletter: boolean;
  surveys: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export interface UpdatePreferencesParams {
  // Platform & System Updates
  platformUpdates?: boolean;
  maintenanceAlerts?: boolean;
  newFeatures?: boolean;

  // Account & Security
  securityAlerts?: boolean;
  loginNotifications?: boolean;
  passwordChanges?: boolean;

  // Tokens & Rewards (Customer only)
  tokenReceived?: boolean;
  tokenRedeemed?: boolean;
  rewardsEarned?: boolean;

  // Orders & Services (Customer only)
  orderUpdates?: boolean;
  serviceApproved?: boolean;
  reviewRequests?: boolean;

  // Shop Operations (Shop only)
  newOrders?: boolean;
  customerMessages?: boolean;
  lowTokenBalance?: boolean;
  subscriptionReminders?: boolean;

  // Admin Alerts (Admin only)
  systemAlerts?: boolean;
  userReports?: boolean;
  treasuryChanges?: boolean;

  // Marketing & Promotions (All users)
  promotions?: boolean;
  newsletter?: boolean;
  surveys?: boolean;
}

export class GeneralNotificationPreferencesRepository extends BaseRepository {
  /**
   * Get general notification preferences for a user
   */
  async getPreferences(
    userAddress: string,
    userType: 'customer' | 'shop' | 'admin'
  ): Promise<GeneralNotificationPreferences | null> {
    try {
      const query = `
        SELECT
          id,
          user_address as "userAddress",
          user_type as "userType",
          platform_updates as "platformUpdates",
          maintenance_alerts as "maintenanceAlerts",
          new_features as "newFeatures",
          security_alerts as "securityAlerts",
          login_notifications as "loginNotifications",
          password_changes as "passwordChanges",
          token_received as "tokenReceived",
          token_redeemed as "tokenRedeemed",
          rewards_earned as "rewardsEarned",
          order_updates as "orderUpdates",
          service_approved as "serviceApproved",
          review_requests as "reviewRequests",
          new_orders as "newOrders",
          customer_messages as "customerMessages",
          low_token_balance as "lowTokenBalance",
          subscription_reminders as "subscriptionReminders",
          system_alerts as "systemAlerts",
          user_reports as "userReports",
          treasury_changes as "treasuryChanges",
          promotions,
          newsletter,
          surveys,
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM general_notification_preferences
        WHERE user_address = $1 AND user_type = $2
      `;

      const result = await this.pool.query(query, [userAddress.toLowerCase(), userType]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Error fetching general notification preferences:', error);
      throw error;
    }
  }

  /**
   * Create default preferences for a new user
   */
  async createDefaultPreferences(
    userAddress: string,
    userType: 'customer' | 'shop' | 'admin'
  ): Promise<GeneralNotificationPreferences> {
    try {
      const query = `
        INSERT INTO general_notification_preferences (
          user_address,
          user_type
        ) VALUES ($1, $2)
        ON CONFLICT (user_address, user_type) DO NOTHING
        RETURNING
          id,
          user_address as "userAddress",
          user_type as "userType",
          platform_updates as "platformUpdates",
          maintenance_alerts as "maintenanceAlerts",
          new_features as "newFeatures",
          security_alerts as "securityAlerts",
          login_notifications as "loginNotifications",
          password_changes as "passwordChanges",
          token_received as "tokenReceived",
          token_redeemed as "tokenRedeemed",
          rewards_earned as "rewardsEarned",
          order_updates as "orderUpdates",
          service_approved as "serviceApproved",
          review_requests as "reviewRequests",
          new_orders as "newOrders",
          customer_messages as "customerMessages",
          low_token_balance as "lowTokenBalance",
          subscription_reminders as "subscriptionReminders",
          system_alerts as "systemAlerts",
          user_reports as "userReports",
          treasury_changes as "treasuryChanges",
          promotions,
          newsletter,
          surveys,
          created_at as "createdAt",
          updated_at as "updatedAt"
      `;

      const result = await this.pool.query(query, [userAddress.toLowerCase(), userType]);

      if (result.rows.length === 0) {
        // Already exists, fetch it
        const existing = await this.getPreferences(userAddress, userType);
        if (!existing) {
          throw new Error('Failed to create or fetch general notification preferences');
        }
        return existing;
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Error creating default general notification preferences:', error);
      throw error;
    }
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(
    userAddress: string,
    userType: 'customer' | 'shop' | 'admin',
    updates: UpdatePreferencesParams
  ): Promise<GeneralNotificationPreferences> {
    try {
      // Build dynamic SET clause
      const setFields: string[] = [];
      const values: any[] = [userAddress.toLowerCase(), userType];
      let paramIndex = 3;

      // Map camelCase to snake_case
      const fieldMapping: Record<string, string> = {
        platformUpdates: 'platform_updates',
        maintenanceAlerts: 'maintenance_alerts',
        newFeatures: 'new_features',
        securityAlerts: 'security_alerts',
        loginNotifications: 'login_notifications',
        passwordChanges: 'password_changes',
        tokenReceived: 'token_received',
        tokenRedeemed: 'token_redeemed',
        rewardsEarned: 'rewards_earned',
        orderUpdates: 'order_updates',
        serviceApproved: 'service_approved',
        reviewRequests: 'review_requests',
        newOrders: 'new_orders',
        customerMessages: 'customer_messages',
        lowTokenBalance: 'low_token_balance',
        subscriptionReminders: 'subscription_reminders',
        systemAlerts: 'system_alerts',
        userReports: 'user_reports',
        treasuryChanges: 'treasury_changes',
        promotions: 'promotions',
        newsletter: 'newsletter',
        surveys: 'surveys',
      };

      for (const [camelKey, snakeKey] of Object.entries(fieldMapping)) {
        if (updates[camelKey as keyof UpdatePreferencesParams] !== undefined) {
          setFields.push(`${snakeKey} = $${paramIndex}`);
          values.push(updates[camelKey as keyof UpdatePreferencesParams]);
          paramIndex++;
        }
      }

      if (setFields.length === 0) {
        // No updates, just return current preferences
        const current = await this.getPreferences(userAddress, userType);
        if (!current) {
          return this.createDefaultPreferences(userAddress, userType);
        }
        return current;
      }

      const query = `
        UPDATE general_notification_preferences
        SET ${setFields.join(', ')}
        WHERE user_address = $1 AND user_type = $2
        RETURNING
          id,
          user_address as "userAddress",
          user_type as "userType",
          platform_updates as "platformUpdates",
          maintenance_alerts as "maintenanceAlerts",
          new_features as "newFeatures",
          security_alerts as "securityAlerts",
          login_notifications as "loginNotifications",
          password_changes as "passwordChanges",
          token_received as "tokenReceived",
          token_redeemed as "tokenRedeemed",
          rewards_earned as "rewardsEarned",
          order_updates as "orderUpdates",
          service_approved as "serviceApproved",
          review_requests as "reviewRequests",
          new_orders as "newOrders",
          customer_messages as "customerMessages",
          low_token_balance as "lowTokenBalance",
          subscription_reminders as "subscriptionReminders",
          system_alerts as "systemAlerts",
          user_reports as "userReports",
          treasury_changes as "treasuryChanges",
          promotions,
          newsletter,
          surveys,
          created_at as "createdAt",
          updated_at as "updatedAt"
      `;

      const result = await this.pool.query(query, values);

      if (result.rows.length === 0) {
        // Preferences don't exist, create them
        return this.createDefaultPreferences(userAddress, userType);
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Error updating general notification preferences:', error);
      throw error;
    }
  }

  /**
   * Get or create preferences (convenience method)
   */
  async getOrCreatePreferences(
    userAddress: string,
    userType: 'customer' | 'shop' | 'admin'
  ): Promise<GeneralNotificationPreferences> {
    try {
      const existing = await this.getPreferences(userAddress, userType);
      if (existing) {
        return existing;
      }

      return this.createDefaultPreferences(userAddress, userType);
    } catch (error) {
      logger.error('Error getting or creating general notification preferences:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const generalNotificationPreferencesRepository = new GeneralNotificationPreferencesRepository();
