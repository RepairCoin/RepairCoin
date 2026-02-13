// backend/src/services/NoShowPolicyService.ts
import { getSharedPool } from '../utils/database-pool';
import { Pool } from 'pg';
import { logger } from '../utils/logger';

export type NoShowTier = 'normal' | 'warning' | 'caution' | 'deposit_required' | 'suspended';

export interface NoShowPolicy {
  shopId: string;
  enabled: boolean;
  gracePeriodMinutes: number;
  minimumCancellationHours: number;
  autoDetectionEnabled: boolean;
  autoDetectionDelayHours: number;

  // Penalty Tiers
  cautionThreshold: number;
  cautionAdvanceBookingHours: number;
  depositThreshold: number;
  depositAmount: number;
  depositAdvanceBookingHours: number;
  depositResetAfterSuccessful: number;
  maxRcnRedemptionPercent: number;
  suspensionThreshold: number;
  suspensionDurationDays: number;

  // Notifications
  sendEmailTier1: boolean;
  sendEmailTier2: boolean;
  sendEmailTier3: boolean;
  sendEmailTier4: boolean;
  sendSmsTier2: boolean;
  sendSmsTier3: boolean;
  sendSmsTier4: boolean;
  sendPushNotifications: boolean;

  // Disputes
  allowDisputes: boolean;
  disputeWindowDays: number;
  autoApproveFirstOffense: boolean;
  requireShopReview: boolean;
}

export interface CustomerNoShowStatus {
  customerAddress: string;
  noShowCount: number;
  tier: NoShowTier;
  depositRequired: boolean;
  lastNoShowAt?: Date;
  bookingSuspendedUntil?: Date;
  successfulAppointmentsSinceTier3: number;
  canBook: boolean;
  requiresDeposit: boolean;
  minimumAdvanceHours: number;
  restrictions: string[];
}

export interface NoShowHistoryEntry {
  id: string;
  customerAddress: string;
  orderId: string;
  serviceId: string;
  shopId: string;
  scheduledTime: Date;
  markedNoShowAt: Date;
  markedBy?: string;
  notes?: string;
  gracePeriodMinutes: number;
  customerTierAtTime?: string;
  disputed: boolean;
  disputeStatus?: 'pending' | 'approved' | 'rejected';
  disputeReason?: string;
  disputeSubmittedAt?: Date;
  disputeResolvedAt?: Date;
  createdAt: Date;
}

export class NoShowPolicyService {
  private pool: Pool;

  constructor() {
    this.pool = getSharedPool();
  }

  /**
   * Get shop's no-show policy (with defaults if not found)
   */
  async getShopPolicy(shopId: string): Promise<NoShowPolicy> {
    const query = `
      SELECT
        shop_id as "shopId",
        enabled,
        grace_period_minutes as "gracePeriodMinutes",
        minimum_cancellation_hours as "minimumCancellationHours",
        auto_detection_enabled as "autoDetectionEnabled",
        auto_detection_delay_hours as "autoDetectionDelayHours",
        caution_threshold as "cautionThreshold",
        caution_advance_booking_hours as "cautionAdvanceBookingHours",
        deposit_threshold as "depositThreshold",
        deposit_amount as "depositAmount",
        deposit_advance_booking_hours as "depositAdvanceBookingHours",
        deposit_reset_after_successful as "depositResetAfterSuccessful",
        max_rcn_redemption_percent as "maxRcnRedemptionPercent",
        suspension_threshold as "suspensionThreshold",
        suspension_duration_days as "suspensionDurationDays",
        send_email_tier1 as "sendEmailTier1",
        send_email_tier2 as "sendEmailTier2",
        send_email_tier3 as "sendEmailTier3",
        send_email_tier4 as "sendEmailTier4",
        send_sms_tier2 as "sendSmsTier2",
        send_sms_tier3 as "sendSmsTier3",
        send_sms_tier4 as "sendSmsTier4",
        send_push_notifications as "sendPushNotifications",
        allow_disputes as "allowDisputes",
        dispute_window_days as "disputeWindowDays",
        auto_approve_first_offense as "autoApproveFirstOffense",
        require_shop_review as "requireShopReview"
      FROM shop_no_show_policy
      WHERE shop_id = $1
    `;

    const result = await this.pool.query(query, [shopId]);

    if (result.rows.length === 0) {
      // Return default policy
      return this.getDefaultPolicy(shopId);
    }

    return result.rows[0];
  }

  /**
   * Get default policy (used when shop hasn't configured yet)
   */
  private getDefaultPolicy(shopId: string): NoShowPolicy {
    return {
      shopId,
      enabled: true,
      gracePeriodMinutes: 15,
      minimumCancellationHours: 4,
      autoDetectionEnabled: false,
      autoDetectionDelayHours: 2,
      cautionThreshold: 2,
      cautionAdvanceBookingHours: 24,
      depositThreshold: 3,
      depositAmount: 25.00,
      depositAdvanceBookingHours: 48,
      depositResetAfterSuccessful: 3,
      maxRcnRedemptionPercent: 80,
      suspensionThreshold: 5,
      suspensionDurationDays: 30,
      sendEmailTier1: true,
      sendEmailTier2: true,
      sendEmailTier3: true,
      sendEmailTier4: true,
      sendSmsTier2: false,
      sendSmsTier3: true,
      sendSmsTier4: true,
      sendPushNotifications: true,
      allowDisputes: true,
      disputeWindowDays: 7,
      autoApproveFirstOffense: true,
      requireShopReview: true
    };
  }

  /**
   * Get customer's current no-show status
   */
  async getCustomerStatus(customerAddress: string, shopId: string): Promise<CustomerNoShowStatus> {
    const query = `
      SELECT
        address as "customerAddress",
        no_show_count as "noShowCount",
        no_show_tier as "tier",
        deposit_required as "depositRequired",
        last_no_show_at as "lastNoShowAt",
        booking_suspended_until as "bookingSuspendedUntil",
        successful_appointments_since_tier3 as "successfulAppointmentsSinceTier3"
      FROM customers
      WHERE address = $1
    `;

    const result = await this.pool.query(query, [customerAddress.toLowerCase()]);

    if (result.rows.length === 0) {
      throw new Error('Customer not found');
    }

    const customer = result.rows[0];
    const policy = await this.getShopPolicy(shopId);

    // Determine booking restrictions
    const now = new Date();
    const isSuspended = customer.bookingSuspendedUntil && new Date(customer.bookingSuspendedUntil) > now;
    const canBook = !isSuspended;

    const restrictions: string[] = [];
    let minimumAdvanceHours = 0;

    if (customer.tier === 'caution') {
      minimumAdvanceHours = policy.cautionAdvanceBookingHours;
      restrictions.push(`Must book at least ${policy.cautionAdvanceBookingHours} hours in advance`);
    } else if (customer.tier === 'deposit_required') {
      minimumAdvanceHours = policy.depositAdvanceBookingHours;
      restrictions.push(`Must book at least ${policy.depositAdvanceBookingHours} hours in advance`);
      restrictions.push(`$${policy.depositAmount} refundable deposit required`);
      restrictions.push(`Maximum ${policy.maxRcnRedemptionPercent}% RCN redemption`);
    } else if (customer.tier === 'suspended') {
      restrictions.push(`Booking suspended until ${customer.bookingSuspendedUntil ? new Date(customer.bookingSuspendedUntil).toLocaleDateString() : 'unknown'}`);
    }

    return {
      customerAddress: customer.customerAddress,
      noShowCount: customer.noShowCount || 0,
      tier: customer.tier || 'normal',
      depositRequired: customer.depositRequired || false,
      lastNoShowAt: customer.lastNoShowAt ? new Date(customer.lastNoShowAt) : undefined,
      bookingSuspendedUntil: customer.bookingSuspendedUntil ? new Date(customer.bookingSuspendedUntil) : undefined,
      successfulAppointmentsSinceTier3: customer.successfulAppointmentsSinceTier3 || 0,
      canBook,
      requiresDeposit: customer.depositRequired || false,
      minimumAdvanceHours,
      restrictions
    };
  }

  /**
   * Get customer's overall no-show status (shop-agnostic)
   * This returns the customer's global tier status without requiring a specific shopId
   * Uses default policy values for restrictions display
   */
  async getOverallCustomerStatus(customerAddress: string): Promise<CustomerNoShowStatus> {
    const query = `
      SELECT
        address as "customerAddress",
        no_show_count as "noShowCount",
        no_show_tier as "tier",
        deposit_required as "depositRequired",
        last_no_show_at as "lastNoShowAt",
        booking_suspended_until as "bookingSuspendedUntil",
        successful_appointments_since_tier3 as "successfulAppointmentsSinceTier3"
      FROM customers
      WHERE address = $1
    `;

    const result = await this.pool.query(query, [customerAddress.toLowerCase()]);

    if (result.rows.length === 0) {
      throw new Error('Customer not found');
    }

    const customer = result.rows[0];

    // Use default policy for restrictions (since no specific shop context)
    const defaultPolicy = this.getDefaultPolicy('default');

    // Determine booking restrictions
    const now = new Date();
    const isSuspended = customer.bookingSuspendedUntil && new Date(customer.bookingSuspendedUntil) > now;
    const canBook = !isSuspended;

    const restrictions: string[] = [];
    let minimumAdvanceHours = 0;

    if (customer.tier === 'caution') {
      minimumAdvanceHours = defaultPolicy.cautionAdvanceBookingHours;
      restrictions.push(`Must book at least ${defaultPolicy.cautionAdvanceBookingHours} hours in advance`);
      restrictions.push(`Limited to ${defaultPolicy.maxRcnRedemptionPercent}% RCN redemption per booking`);
    } else if (customer.tier === 'deposit_required') {
      minimumAdvanceHours = defaultPolicy.depositAdvanceBookingHours;
      restrictions.push(`$${defaultPolicy.depositAmount} refundable deposit required for all bookings`);
      restrictions.push(`Must book at least ${defaultPolicy.depositAdvanceBookingHours} hours in advance`);
      restrictions.push(`Limited to ${defaultPolicy.maxRcnRedemptionPercent}% RCN redemption per booking`);
    } else if (customer.tier === 'suspended') {
      const suspensionDate = customer.bookingSuspendedUntil
        ? new Date(customer.bookingSuspendedUntil).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        : 'unknown date';
      restrictions.push(`Booking privileges suspended until ${suspensionDate}`);
      restrictions.push(`After suspension: $${defaultPolicy.depositAmount} deposit required for all bookings`);
      restrictions.push(`After suspension: Must book at least ${defaultPolicy.depositAdvanceBookingHours} hours in advance`);
    }

    return {
      customerAddress: customer.customerAddress,
      noShowCount: customer.noShowCount || 0,
      tier: customer.tier || 'normal',
      depositRequired: customer.depositRequired || false,
      lastNoShowAt: customer.lastNoShowAt ? new Date(customer.lastNoShowAt) : undefined,
      bookingSuspendedUntil: customer.bookingSuspendedUntil ? new Date(customer.bookingSuspendedUntil) : undefined,
      successfulAppointmentsSinceTier3: customer.successfulAppointmentsSinceTier3 || 0,
      canBook,
      requiresDeposit: customer.depositRequired || false,
      minimumAdvanceHours,
      restrictions
    };
  }

  /**
   * Record no-show in history table
   */
  async recordNoShowHistory(params: {
    customerAddress: string;
    orderId: string;
    serviceId: string;
    shopId: string;
    scheduledTime: Date;
    markedBy: string;
    notes?: string;
  }): Promise<NoShowHistoryEntry> {
    const policy = await this.getShopPolicy(params.shopId);
    const customerStatus = await this.getCustomerStatus(params.customerAddress, params.shopId);

    const query = `
      INSERT INTO no_show_history (
        customer_address,
        order_id,
        service_id,
        shop_id,
        scheduled_time,
        marked_by,
        notes,
        grace_period_minutes,
        customer_tier_at_time
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING
        id,
        customer_address as "customerAddress",
        order_id as "orderId",
        service_id as "serviceId",
        shop_id as "shopId",
        scheduled_time as "scheduledTime",
        marked_no_show_at as "markedNoShowAt",
        marked_by as "markedBy",
        notes,
        grace_period_minutes as "gracePeriodMinutes",
        customer_tier_at_time as "customerTierAtTime",
        disputed,
        dispute_status as "disputeStatus",
        created_at as "createdAt"
    `;

    const result = await this.pool.query(query, [
      params.customerAddress.toLowerCase(),
      params.orderId,
      params.serviceId,
      params.shopId,
      params.scheduledTime,
      params.markedBy.toLowerCase(),
      params.notes,
      policy.gracePeriodMinutes,
      customerStatus.tier
    ]);

    // Increment customer no-show count
    await this.incrementCustomerNoShowCount(params.customerAddress);

    return result.rows[0];
  }

  /**
   * Increment customer's no-show count (trigger will auto-update tier)
   */
  private async incrementCustomerNoShowCount(customerAddress: string): Promise<void> {
    const query = `
      UPDATE customers
      SET no_show_count = no_show_count + 1
      WHERE address = $1
    `;

    await this.pool.query(query, [customerAddress.toLowerCase()]);
  }

  /**
   * Record successful appointment (for tier 3 reset tracking)
   */
  async recordSuccessfulAppointment(customerAddress: string): Promise<void> {
    const query = `
      UPDATE customers
      SET successful_appointments_since_tier3 = successful_appointments_since_tier3 + 1
      WHERE address = $1
        AND no_show_tier = 'deposit_required'
    `;

    const result = await this.pool.query(query, [customerAddress.toLowerCase()]);

    // Check if customer should be restored to lower tier
    if (result.rowCount && result.rowCount > 0) {
      await this.checkTierReset(customerAddress);
    }
  }

  /**
   * Check if customer should be reset to lower tier after successful appointments
   */
  private async checkTierReset(customerAddress: string): Promise<void> {
    const query = `
      UPDATE customers
      SET
        no_show_tier = 'caution',
        deposit_required = FALSE,
        successful_appointments_since_tier3 = 0
      WHERE address = $1
        AND no_show_tier = 'deposit_required'
        AND successful_appointments_since_tier3 >= (
          SELECT deposit_reset_after_successful
          FROM shop_no_show_policy
          LIMIT 1  -- Using default policy for now
        )
    `;

    await this.pool.query(query, [customerAddress.toLowerCase()]);
  }

  /**
   * Get customer's no-show history
   */
  async getCustomerHistory(customerAddress: string, limit: number = 10): Promise<NoShowHistoryEntry[]> {
    const query = `
      SELECT
        id,
        customer_address as "customerAddress",
        order_id as "orderId",
        service_id as "serviceId",
        shop_id as "shopId",
        scheduled_time as "scheduledTime",
        marked_no_show_at as "markedNoShowAt",
        marked_by as "markedBy",
        notes,
        grace_period_minutes as "gracePeriodMinutes",
        customer_tier_at_time as "customerTierAtTime",
        disputed,
        dispute_status as "disputeStatus",
        dispute_reason as "disputeReason",
        dispute_submitted_at as "disputeSubmittedAt",
        dispute_resolved_at as "disputeResolvedAt",
        created_at as "createdAt"
      FROM no_show_history
      WHERE customer_address = $1
      ORDER BY marked_no_show_at DESC
      LIMIT $2
    `;

    const result = await this.pool.query(query, [customerAddress.toLowerCase(), limit]);
    return result.rows;
  }

  /**
   * Get shop's no-show analytics
   */
  async getShopAnalytics(shopId: string, days: number = 30): Promise<{
    totalNoShows: number;
    noShowRate: number;
    tier1Customers: number;
    tier2Customers: number;
    tier3Customers: number;
    tier4Customers: number;
  }> {
    const query = `
      WITH no_show_stats AS (
        SELECT COUNT(*) as total_no_shows
        FROM no_show_history
        WHERE shop_id = $1
          AND marked_no_show_at >= NOW() - INTERVAL '${days} days'
      ),
      total_appointments AS (
        SELECT COUNT(*) as total
        FROM service_orders
        WHERE shop_id = $1
          AND created_at >= NOW() - INTERVAL '${days} days'
          AND status IN ('paid', 'completed', 'no_show')
      ),
      customer_tiers AS (
        SELECT
          COUNT(*) FILTER (WHERE no_show_tier = 'warning') as tier1,
          COUNT(*) FILTER (WHERE no_show_tier = 'caution') as tier2,
          COUNT(*) FILTER (WHERE no_show_tier = 'deposit_required') as tier3,
          COUNT(*) FILTER (WHERE no_show_tier = 'suspended') as tier4
        FROM customers
        WHERE address IN (
          SELECT DISTINCT customer_address
          FROM service_orders
          WHERE shop_id = $1
        )
      )
      SELECT
        COALESCE(ns.total_no_shows, 0)::int as "totalNoShows",
        CASE
          WHEN ta.total > 0 THEN ROUND((ns.total_no_shows::decimal / ta.total * 100), 2)
          ELSE 0
        END as "noShowRate",
        COALESCE(ct.tier1, 0)::int as "tier1Customers",
        COALESCE(ct.tier2, 0)::int as "tier2Customers",
        COALESCE(ct.tier3, 0)::int as "tier3Customers",
        COALESCE(ct.tier4, 0)::int as "tier4Customers"
      FROM no_show_stats ns
      CROSS JOIN total_appointments ta
      CROSS JOIN customer_tiers ct
    `;

    const result = await this.pool.query(query, [shopId]);
    return result.rows[0] || {
      totalNoShows: 0,
      noShowRate: 0,
      tier1Customers: 0,
      tier2Customers: 0,
      tier3Customers: 0,
      tier4Customers: 0
    };
  }

  /**
   * Update shop's no-show policy
   */
  async updateShopPolicy(shopId: string, policy: Partial<NoShowPolicy>): Promise<NoShowPolicy> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    // Build dynamic UPDATE query
    Object.entries(policy).forEach(([key, value]) => {
      if (key !== 'shopId') {
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        fields.push(`${snakeKey} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    });

    values.push(shopId);

    const query = `
      UPDATE shop_no_show_policy
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE shop_id = $${paramCount}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);

    if (result.rows.length === 0) {
      throw new Error('Shop policy not found');
    }

    return this.getShopPolicy(shopId);
  }
}

export default new NoShowPolicyService();
