import { BaseRepository } from './BaseRepository';
import { logger } from '../utils/logger';

export interface NotificationPreferences {
  id: string;
  customerAddress: string;

  // Channel preferences
  emailEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;

  // Reminder timing preferences
  reminder24hEnabled: boolean;
  reminder2hEnabled: boolean;
  reminder30mEnabled: boolean;

  // Quiet hours
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;  // "HH:MM" format
  quietHoursEnd: string | null;    // "HH:MM" format

  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPreferencesInput {
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  inAppEnabled?: boolean;
  reminder24hEnabled?: boolean;
  reminder2hEnabled?: boolean;
  reminder30mEnabled?: boolean;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
}

// Default preferences for new customers
const DEFAULT_PREFERENCES: NotificationPreferencesInput = {
  emailEnabled: true,
  smsEnabled: false,
  inAppEnabled: true,
  reminder24hEnabled: true,
  reminder2hEnabled: true,
  reminder30mEnabled: false,
  quietHoursEnabled: false,
  quietHoursStart: null,
  quietHoursEnd: null
};

export class NotificationPreferencesRepository extends BaseRepository {

  /**
   * Get notification preferences for a customer
   * Returns default preferences if none exist
   */
  async getByCustomerAddress(customerAddress: string): Promise<NotificationPreferences> {
    try {
      const query = `
        SELECT
          id,
          customer_address,
          email_enabled,
          sms_enabled,
          in_app_enabled,
          reminder_24h_enabled,
          reminder_2h_enabled,
          reminder_30m_enabled,
          quiet_hours_enabled,
          quiet_hours_start,
          quiet_hours_end,
          created_at,
          updated_at
        FROM customer_notification_preferences
        WHERE customer_address = $1
      `;

      const result = await this.pool.query(query, [customerAddress.toLowerCase()]);

      if (result.rows.length === 0) {
        // Return default preferences if none exist
        return this.createDefaultPreferences(customerAddress);
      }

      return this.mapRowToPreferences(result.rows[0]);
    } catch (error) {
      logger.error('Error getting notification preferences:', error);
      throw error;
    }
  }

  /**
   * Create or update notification preferences
   * Uses upsert to handle both create and update
   */
  async upsert(
    customerAddress: string,
    preferences: NotificationPreferencesInput
  ): Promise<NotificationPreferences> {
    try {
      const query = `
        INSERT INTO customer_notification_preferences (
          customer_address,
          email_enabled,
          sms_enabled,
          in_app_enabled,
          reminder_24h_enabled,
          reminder_2h_enabled,
          reminder_30m_enabled,
          quiet_hours_enabled,
          quiet_hours_start,
          quiet_hours_end
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (customer_address) DO UPDATE SET
          email_enabled = COALESCE(EXCLUDED.email_enabled, customer_notification_preferences.email_enabled),
          sms_enabled = COALESCE(EXCLUDED.sms_enabled, customer_notification_preferences.sms_enabled),
          in_app_enabled = COALESCE(EXCLUDED.in_app_enabled, customer_notification_preferences.in_app_enabled),
          reminder_24h_enabled = COALESCE(EXCLUDED.reminder_24h_enabled, customer_notification_preferences.reminder_24h_enabled),
          reminder_2h_enabled = COALESCE(EXCLUDED.reminder_2h_enabled, customer_notification_preferences.reminder_2h_enabled),
          reminder_30m_enabled = COALESCE(EXCLUDED.reminder_30m_enabled, customer_notification_preferences.reminder_30m_enabled),
          quiet_hours_enabled = COALESCE(EXCLUDED.quiet_hours_enabled, customer_notification_preferences.quiet_hours_enabled),
          quiet_hours_start = EXCLUDED.quiet_hours_start,
          quiet_hours_end = EXCLUDED.quiet_hours_end,
          updated_at = NOW()
        RETURNING
          id,
          customer_address,
          email_enabled,
          sms_enabled,
          in_app_enabled,
          reminder_24h_enabled,
          reminder_2h_enabled,
          reminder_30m_enabled,
          quiet_hours_enabled,
          quiet_hours_start,
          quiet_hours_end,
          created_at,
          updated_at
      `;

      const values = [
        customerAddress.toLowerCase(),
        preferences.emailEnabled ?? DEFAULT_PREFERENCES.emailEnabled,
        preferences.smsEnabled ?? DEFAULT_PREFERENCES.smsEnabled,
        preferences.inAppEnabled ?? DEFAULT_PREFERENCES.inAppEnabled,
        preferences.reminder24hEnabled ?? DEFAULT_PREFERENCES.reminder24hEnabled,
        preferences.reminder2hEnabled ?? DEFAULT_PREFERENCES.reminder2hEnabled,
        preferences.reminder30mEnabled ?? DEFAULT_PREFERENCES.reminder30mEnabled,
        preferences.quietHoursEnabled ?? DEFAULT_PREFERENCES.quietHoursEnabled,
        preferences.quietHoursStart ?? null,
        preferences.quietHoursEnd ?? null
      ];

      const result = await this.pool.query(query, values);

      logger.info('Notification preferences saved:', {
        customerAddress: customerAddress.toLowerCase(),
        preferences
      });

      return this.mapRowToPreferences(result.rows[0]);
    } catch (error) {
      logger.error('Error saving notification preferences:', error);
      throw error;
    }
  }

  /**
   * Delete notification preferences for a customer
   */
  async delete(customerAddress: string): Promise<boolean> {
    try {
      const query = `
        DELETE FROM customer_notification_preferences
        WHERE customer_address = $1
      `;

      const result = await this.pool.query(query, [customerAddress.toLowerCase()]);
      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      logger.error('Error deleting notification preferences:', error);
      throw error;
    }
  }

  /**
   * Check if a customer should receive a specific reminder type via a specific channel
   */
  async shouldSendReminder(
    customerAddress: string,
    reminderType: '24h' | '2h' | '30m',
    channel: 'email' | 'sms' | 'in_app'
  ): Promise<boolean> {
    try {
      const prefs = await this.getByCustomerAddress(customerAddress);

      // Check if reminder type is enabled
      const reminderEnabled =
        (reminderType === '24h' && prefs.reminder24hEnabled) ||
        (reminderType === '2h' && prefs.reminder2hEnabled) ||
        (reminderType === '30m' && prefs.reminder30mEnabled);

      if (!reminderEnabled) return false;

      // Check if channel is enabled
      const channelEnabled =
        (channel === 'email' && prefs.emailEnabled) ||
        (channel === 'sms' && prefs.smsEnabled) ||
        (channel === 'in_app' && prefs.inAppEnabled);

      if (!channelEnabled) return false;

      // Check quiet hours
      if (prefs.quietHoursEnabled && prefs.quietHoursStart && prefs.quietHoursEnd) {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        if (this.isInQuietHours(currentTime, prefs.quietHoursStart, prefs.quietHoursEnd)) {
          logger.debug('Notification blocked by quiet hours:', {
            customerAddress,
            currentTime,
            quietHoursStart: prefs.quietHoursStart,
            quietHoursEnd: prefs.quietHoursEnd
          });
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.error('Error checking reminder preferences:', error);
      // Default to sending if there's an error checking preferences
      return true;
    }
  }

  /**
   * Check if current time is within quiet hours
   */
  private isInQuietHours(currentTime: string, start: string, end: string): boolean {
    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (start > end) {
      // Quiet hours span midnight
      return currentTime >= start || currentTime <= end;
    } else {
      // Normal quiet hours (e.g., 14:00 to 16:00)
      return currentTime >= start && currentTime <= end;
    }
  }

  /**
   * Create default preferences object (doesn't save to DB)
   */
  private createDefaultPreferences(customerAddress: string): NotificationPreferences {
    return {
      id: '',
      customerAddress: customerAddress.toLowerCase(),
      emailEnabled: DEFAULT_PREFERENCES.emailEnabled!,
      smsEnabled: DEFAULT_PREFERENCES.smsEnabled!,
      inAppEnabled: DEFAULT_PREFERENCES.inAppEnabled!,
      reminder24hEnabled: DEFAULT_PREFERENCES.reminder24hEnabled!,
      reminder2hEnabled: DEFAULT_PREFERENCES.reminder2hEnabled!,
      reminder30mEnabled: DEFAULT_PREFERENCES.reminder30mEnabled!,
      quietHoursEnabled: DEFAULT_PREFERENCES.quietHoursEnabled!,
      quietHoursStart: DEFAULT_PREFERENCES.quietHoursStart!,
      quietHoursEnd: DEFAULT_PREFERENCES.quietHoursEnd!,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Map database row to NotificationPreferences object
   */
  private mapRowToPreferences(row: any): NotificationPreferences {
    return {
      id: row.id,
      customerAddress: row.customer_address,
      emailEnabled: row.email_enabled,
      smsEnabled: row.sms_enabled,
      inAppEnabled: row.in_app_enabled,
      reminder24hEnabled: row.reminder_24h_enabled,
      reminder2hEnabled: row.reminder_2h_enabled,
      reminder30mEnabled: row.reminder_30m_enabled,
      quietHoursEnabled: row.quiet_hours_enabled,
      quietHoursStart: row.quiet_hours_start ? row.quiet_hours_start.substring(0, 5) : null,
      quietHoursEnd: row.quiet_hours_end ? row.quiet_hours_end.substring(0, 5) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

// Export singleton instance
export const notificationPreferencesRepository = new NotificationPreferencesRepository();
