// backend/src/services/EmailPreferencesService.ts
import { getSharedPool } from '../utils/database-pool';
import { Pool } from 'pg';
import { logger } from '../utils/logger';

export interface EmailPreferences {
  shopId: string;

  // Booking & Appointment Notifications
  newBooking: boolean;
  bookingCancellation: boolean;
  bookingReschedule: boolean;
  appointmentReminder: boolean;
  noShowAlert: boolean;

  // Customer Activity
  newCustomer: boolean;
  customerReview: boolean;
  customerMessage: boolean;

  // Financial Notifications
  paymentReceived: boolean;
  refundProcessed: boolean;
  subscriptionRenewal: boolean;
  subscriptionExpiring: boolean;

  // Marketing & Promotions
  marketingUpdates: boolean;
  featureAnnouncements: boolean;
  platformNews: boolean;

  // Digest Settings
  dailyDigest: boolean;
  weeklyReport: boolean;
  monthlyReport: boolean;

  // Frequency Settings
  digestTime: 'morning' | 'afternoon' | 'evening';
  weeklyReportDay: 'monday' | 'friday';
  monthlyReportDay: number; // 1-28

  createdAt?: Date;
  updatedAt?: Date;
}

export class EmailPreferencesService {
  private pool: Pool;

  constructor() {
    this.pool = getSharedPool();
  }

  /**
   * Get shop's email preferences (with defaults if not found)
   */
  async getShopPreferences(shopId: string): Promise<EmailPreferences> {
    console.log('📧 [EmailPreferencesService] getShopPreferences called for shopId:', shopId);

    try {
      const query = `
        SELECT
          shop_id as "shopId",
          new_booking as "newBooking",
          booking_cancellation as "bookingCancellation",
          booking_reschedule as "bookingReschedule",
          appointment_reminder as "appointmentReminder",
          no_show_alert as "noShowAlert",
          new_customer as "newCustomer",
          customer_review as "customerReview",
          customer_message as "customerMessage",
          payment_received as "paymentReceived",
          refund_processed as "refundProcessed",
          subscription_renewal as "subscriptionRenewal",
          subscription_expiring as "subscriptionExpiring",
          marketing_updates as "marketingUpdates",
          feature_announcements as "featureAnnouncements",
          platform_news as "platformNews",
          daily_digest as "dailyDigest",
          weekly_report as "weeklyReport",
          monthly_report as "monthlyReport",
          digest_time as "digestTime",
          weekly_report_day as "weeklyReportDay",
          monthly_report_day as "monthlyReportDay",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM shop_email_preferences
        WHERE shop_id = $1
      `;

      console.log('📧 [EmailPreferencesService] Executing query...');
      const result = await this.pool.query(query, [shopId]);
      console.log('📧 [EmailPreferencesService] Query result rows:', result.rows.length);

      if (result.rows.length === 0) {
        console.log('📧 [EmailPreferencesService] No preferences found, creating defaults');
        // Return default preferences and create entry
        const defaultPrefs = this.getDefaultPreferences(shopId);
        await this.createShopPreferences(shopId);
        return defaultPrefs;
      }

      console.log('✅ [EmailPreferencesService] Preferences found in database');
      return result.rows[0];
    } catch (error) {
      console.error('❌ [EmailPreferencesService] Error in getShopPreferences:', error);
      throw error;
    }
  }

  /**
   * Create default email preferences for a shop
   */
  private async createShopPreferences(shopId: string): Promise<void> {
    const query = `
      INSERT INTO shop_email_preferences (shop_id)
      VALUES ($1)
      ON CONFLICT (shop_id) DO NOTHING
    `;

    await this.pool.query(query, [shopId]);

    logger.info('Default email preferences created for shop', { shopId });
  }

  /**
   * Get default preferences (used when shop hasn't configured yet)
   */
  private getDefaultPreferences(shopId: string): EmailPreferences {
    return {
      shopId,
      // Booking & Appointment Notifications
      newBooking: true,
      bookingCancellation: true,
      bookingReschedule: true,
      appointmentReminder: true,
      noShowAlert: true,
      // Customer Activity
      newCustomer: true,
      customerReview: true,
      customerMessage: true,
      // Financial Notifications
      paymentReceived: true,
      refundProcessed: true,
      subscriptionRenewal: true,
      subscriptionExpiring: true,
      // Marketing & Promotions
      marketingUpdates: false,
      featureAnnouncements: true,
      platformNews: false,
      // Digest Settings
      dailyDigest: false,
      weeklyReport: true,
      monthlyReport: false,
      // Frequency Settings
      digestTime: 'morning',
      weeklyReportDay: 'monday',
      monthlyReportDay: 1
    };
  }

  /**
   * Update shop's email preferences
   */
  async updateShopPreferences(
    shopId: string,
    preferences: Partial<EmailPreferences>
  ): Promise<EmailPreferences> {
    // Build dynamic UPDATE query based on provided fields
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    // Remove shopId from updates if present (can't update primary key)
    delete preferences.shopId;

    // Map camelCase to snake_case and build SET clause
    const fieldMap: Record<string, string> = {
      newBooking: 'new_booking',
      bookingCancellation: 'booking_cancellation',
      bookingReschedule: 'booking_reschedule',
      appointmentReminder: 'appointment_reminder',
      noShowAlert: 'no_show_alert',
      newCustomer: 'new_customer',
      customerReview: 'customer_review',
      customerMessage: 'customer_message',
      paymentReceived: 'payment_received',
      refundProcessed: 'refund_processed',
      subscriptionRenewal: 'subscription_renewal',
      subscriptionExpiring: 'subscription_expiring',
      marketingUpdates: 'marketing_updates',
      featureAnnouncements: 'feature_announcements',
      platformNews: 'platform_news',
      dailyDigest: 'daily_digest',
      weeklyReport: 'weekly_report',
      monthlyReport: 'monthly_report',
      digestTime: 'digest_time',
      weeklyReportDay: 'weekly_report_day',
      monthlyReportDay: 'monthly_report_day'
    };

    Object.entries(preferences).forEach(([key, value]) => {
      const dbColumn = fieldMap[key];
      if (dbColumn && value !== undefined) {
        updates.push(`${dbColumn} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    if (updates.length === 0) {
      // No updates provided, just return current preferences
      return this.getShopPreferences(shopId);
    }

    // Add shopId as the last parameter
    values.push(shopId);

    const query = `
      UPDATE shop_email_preferences
      SET ${updates.join(', ')}
      WHERE shop_id = $${paramIndex}
      RETURNING
        shop_id as "shopId",
        new_booking as "newBooking",
        booking_cancellation as "bookingCancellation",
        booking_reschedule as "bookingReschedule",
        appointment_reminder as "appointmentReminder",
        no_show_alert as "noShowAlert",
        new_customer as "newCustomer",
        customer_review as "customerReview",
        customer_message as "customerMessage",
        payment_received as "paymentReceived",
        refund_processed as "refundProcessed",
        subscription_renewal as "subscriptionRenewal",
        subscription_expiring as "subscriptionExpiring",
        marketing_updates as "marketingUpdates",
        feature_announcements as "featureAnnouncements",
        platform_news as "platformNews",
        daily_digest as "dailyDigest",
        weekly_report as "weeklyReport",
        monthly_report as "monthlyReport",
        digest_time as "digestTime",
        weekly_report_day as "weeklyReportDay",
        monthly_report_day as "monthlyReportDay",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `;

    const result = await this.pool.query(query, values);

    if (result.rows.length === 0) {
      throw new Error('Failed to update email preferences');
    }

    logger.info('Email preferences updated for shop', {
      shopId,
      updatedFields: Object.keys(preferences)
    });

    return result.rows[0];
  }

  /**
   * Check if a shop should receive a specific notification type
   */
  async shouldSendNotification(
    shopId: string,
    notificationType: keyof Omit<EmailPreferences, 'shopId' | 'digestTime' | 'weeklyReportDay' | 'monthlyReportDay' | 'createdAt' | 'updatedAt'>
  ): Promise<boolean> {
    const preferences = await this.getShopPreferences(shopId);
    return Boolean(preferences[notificationType]);
  }

  /**
   * Get all shops that have a specific notification enabled
   * Useful for batch email sending
   */
  async getShopsWithNotificationEnabled(
    notificationType: string
  ): Promise<string[]> {
    const fieldMap: Record<string, string> = {
      newBooking: 'new_booking',
      bookingCancellation: 'booking_cancellation',
      bookingReschedule: 'booking_reschedule',
      appointmentReminder: 'appointment_reminder',
      noShowAlert: 'no_show_alert',
      newCustomer: 'new_customer',
      customerReview: 'customer_review',
      customerMessage: 'customer_message',
      paymentReceived: 'payment_received',
      refundProcessed: 'refund_processed',
      subscriptionRenewal: 'subscription_renewal',
      subscriptionExpiring: 'subscription_expiring',
      marketingUpdates: 'marketing_updates',
      featureAnnouncements: 'feature_announcements',
      platformNews: 'platform_news',
      dailyDigest: 'daily_digest',
      weeklyReport: 'weekly_report',
      monthlyReport: 'monthly_report'
    };

    const dbColumn = fieldMap[notificationType];
    if (!dbColumn) {
      logger.warn('Invalid notification type provided', { notificationType });
      return [];
    }

    const query = `
      SELECT shop_id
      FROM shop_email_preferences
      WHERE ${dbColumn} = true
    `;

    const result = await this.pool.query(query);
    return result.rows.map(row => row.shop_id);
  }
}
