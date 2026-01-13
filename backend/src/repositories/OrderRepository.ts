// backend/src/repositories/OrderRepository.ts
import { BaseRepository, PaginatedResult } from './BaseRepository';
import { logger } from '../utils/logger';

export type OrderStatus = 'pending' | 'paid' | 'completed' | 'cancelled' | 'refunded' | 'no_show';

export interface ServiceOrder {
  orderId: string;
  serviceId: string;
  customerAddress: string;
  shopId: string;
  stripePaymentIntentId?: string;
  status: OrderStatus;
  totalAmount: number;
  rcnRedeemed?: number;
  rcnDiscountUsd?: number;
  finalAmountUsd?: number;
  bookingDate?: Date;
  bookingTime?: string;
  completedAt?: Date;
  notes?: string;
  // Approval fields
  shopApproved: boolean;
  approvedAt?: Date;
  approvedBy?: string;
  // Reschedule fields
  originalBookingDate?: Date;
  originalBookingTimeSlot?: string;
  rescheduledAt?: Date;
  rescheduledBy?: string;
  rescheduleReason?: string;
  rescheduleCount: number;
  noShow?: boolean;
  markedNoShowAt?: Date;
  noShowNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceOrderWithDetails extends ServiceOrder {
  serviceName?: string;
  serviceDescription?: string;
  serviceImageUrl?: string;
  serviceDuration?: number;
  serviceCategory?: string;
  shopName?: string;
  shopAddress?: string;
  shopCity?: string;
  shopPhone?: string;
  customerName?: string;
  customerTier?: string;
  customerPhone?: string;
  rcnEarned?: number; // RCN tokens earned when order completed
  promoRcn?: number; // RCN from promo codes
}

export interface CreateOrderParams {
  orderId: string;
  serviceId: string;
  customerAddress: string;
  shopId: string;
  totalAmount: number;
  rcnRedeemed?: number;
  rcnDiscountUsd?: number;
  finalAmountUsd?: number;
  bookingDate?: Date;
  bookingTimeSlot?: string;
  bookingEndTime?: string;
  notes?: string;
  stripePaymentIntentId?: string;
  status?: OrderStatus;
  // Auto-approval fields
  shopApproved?: boolean;
  approvedAt?: Date;
}

export interface OrderFilters {
  status?: OrderStatus;
  startDate?: Date;
  endDate?: Date;
}

export class OrderRepository extends BaseRepository {
  /**
   * Create a new order
   * @param params Order parameters including optional status (defaults to 'paid' - no pending status)
   */
  async createOrder(params: CreateOrderParams): Promise<ServiceOrder> {
    try {
      const status = params.status || 'paid'; // Default to 'paid' - orders are created after payment succeeds

      const query = `
        INSERT INTO service_orders (
          order_id, service_id, customer_address, shop_id, total_amount,
          rcn_redeemed, rcn_discount_usd, final_amount_usd,
          booking_date, booking_time_slot, booking_end_time, notes,
          stripe_payment_intent_id, status, shop_approved, approved_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
      `;

      const values = [
        params.orderId,
        params.serviceId,
        params.customerAddress.toLowerCase(),
        params.shopId,
        params.totalAmount,
        params.rcnRedeemed || 0,
        params.rcnDiscountUsd || 0,
        params.finalAmountUsd || params.totalAmount,
        params.bookingDate || null,
        params.bookingTimeSlot || null,
        params.bookingEndTime || null,
        params.notes || null,
        params.stripePaymentIntentId || null,
        status,
        params.shopApproved || false,
        params.approvedAt || null
      ];

      const result = await this.pool.query(query, values);
      logger.info('Order created', {
        orderId: params.orderId,
        serviceId: params.serviceId,
        status,
        rcnRedeemed: params.rcnRedeemed || 0,
        discountUsd: params.rcnDiscountUsd || 0,
        bookingDate: params.bookingDate,
        bookingTimeSlot: params.bookingTimeSlot
      });
      return this.mapOrderRow(result.rows[0]);
    } catch (error) {
      logger.error('Error creating order:', error);
      throw error;
    }
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string): Promise<ServiceOrder | null> {
    try {
      const query = 'SELECT * FROM service_orders WHERE order_id = $1';
      const result = await this.pool.query(query, [orderId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapOrderRow(result.rows[0]);
    } catch (error) {
      logger.error('Error fetching order:', error);
      throw error;
    }
  }

  /**
   * Get order with full details (service and shop info)
   */
  async getOrderWithDetails(orderId: string): Promise<ServiceOrderWithDetails | null> {
    try {
      const query = `
        SELECT
          o.*,
          s.service_name,
          s.description as service_description,
          s.image_url as service_image_url,
          s.duration_minutes as service_duration,
          s.category as service_category,
          sh.name as shop_name,
          sh.address as shop_address,
          sh.phone as shop_phone,
          c.name as customer_name,
          COALESCE(t.amount, 0) as rcn_earned
        FROM service_orders o
        INNER JOIN shop_services s ON o.service_id = s.service_id
        INNER JOIN shops sh ON o.shop_id = sh.shop_id
        LEFT JOIN customers c ON o.customer_address = c.address
        LEFT JOIN transactions t ON t.metadata->>'orderId' = o.order_id AND t.type = 'mint'
        WHERE o.order_id = $1
      `;
      const result = await this.pool.query(query, [orderId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapOrderWithDetailsRow(result.rows[0]);
    } catch (error) {
      logger.error('Error fetching order with details:', error);
      throw error;
    }
  }

  /**
   * Get order by Stripe Payment Intent ID
   */
  async getOrderByPaymentIntent(paymentIntentId: string): Promise<ServiceOrder | null> {
    try {
      const query = 'SELECT * FROM service_orders WHERE stripe_payment_intent_id = $1';
      const result = await this.pool.query(query, [paymentIntentId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapOrderRow(result.rows[0]);
    } catch (error) {
      logger.error('Error fetching order by payment intent:', error);
      throw error;
    }
  }

  /**
   * Get all orders for a customer
   */
  async getOrdersByCustomer(
    customerAddress: string,
    filters: OrderFilters = {},
    options: {
      page?: number;
      limit?: number;
    } = {}
  ): Promise<PaginatedResult<ServiceOrderWithDetails>> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 20;
      const offset = (page - 1) * limit;

      const whereClauses: string[] = ['o.customer_address = $1'];
      const params: unknown[] = [customerAddress.toLowerCase()];
      let paramCount = 1;

      if (filters.status) {
        paramCount++;
        whereClauses.push(`o.status = $${paramCount}`);
        params.push(filters.status);
      }

      if (filters.startDate) {
        paramCount++;
        whereClauses.push(`o.created_at >= $${paramCount}`);
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        paramCount++;
        whereClauses.push(`o.created_at <= $${paramCount}`);
        params.push(filters.endDate);
      }

      const whereClause = `WHERE ${whereClauses.join(' AND ')}`;

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM service_orders o
        ${whereClause}
      `;
      const countResult = await this.pool.query(countQuery, params);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated results with details
      const query = `
        SELECT
          o.*,
          s.service_name,
          s.description as service_description,
          s.image_url as service_image_url,
          s.duration_minutes as service_duration,
          s.category as service_category,
          sh.name as shop_name,
          sh.address as shop_address,
          sh.phone as shop_phone,
          COALESCE(t.amount, 0) as rcn_earned
        FROM service_orders o
        INNER JOIN shop_services s ON o.service_id = s.service_id
        INNER JOIN shops sh ON o.shop_id = sh.shop_id
        LEFT JOIN transactions t ON t.metadata->>'orderId' = o.order_id AND t.type = 'mint'
        ${whereClause}
        ORDER BY o.created_at DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;
      params.push(limit, offset);

      const result = await this.pool.query(query, params);
      const items = result.rows.map(row => this.mapOrderWithDetailsRow(row));

      return {
        items,
        pagination: {
          page,
          limit,
          totalItems: total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total
        }
      };
    } catch (error) {
      logger.error('Error fetching customer orders:', error);
      throw error;
    }
  }

  /**
   * Get all orders for a shop
   */
  async getOrdersByShop(
    shopId: string,
    filters: OrderFilters = {},
    options: {
      page?: number;
      limit?: number;
    } = {}
  ): Promise<PaginatedResult<ServiceOrderWithDetails>> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 20;
      const offset = (page - 1) * limit;

      const whereClauses: string[] = ['o.shop_id = $1'];
      const params: unknown[] = [shopId];
      let paramCount = 1;

      if (filters.status) {
        paramCount++;
        whereClauses.push(`o.status = $${paramCount}`);
        params.push(filters.status);
      }

      if (filters.startDate) {
        paramCount++;
        whereClauses.push(`o.created_at >= $${paramCount}`);
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        paramCount++;
        whereClauses.push(`o.created_at <= $${paramCount}`);
        params.push(filters.endDate);
      }

      const whereClause = `WHERE ${whereClauses.join(' AND ')}`;

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM service_orders o
        ${whereClause}
      `;
      const countResult = await this.pool.query(countQuery, params);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated results with details
      const query = `
        SELECT
          o.*,
          s.service_name,
          s.description as service_description,
          s.image_url as service_image_url,
          s.duration_minutes as service_duration,
          s.category as service_category,
          c.name as customer_name,
          c.tier as customer_tier,
          c.phone as customer_phone
        FROM service_orders o
        INNER JOIN shop_services s ON o.service_id = s.service_id
        LEFT JOIN customers c ON o.customer_address = c.address
        ${whereClause}
        ORDER BY o.created_at DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;
      params.push(limit, offset);

      const result = await this.pool.query(query, params);
      const items = result.rows.map(row => this.mapOrderWithDetailsRow(row));

      return {
        items,
        pagination: {
          page,
          limit,
          totalItems: total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total
        }
      };
    } catch (error) {
      logger.error('Error fetching shop orders:', error);
      throw error;
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<ServiceOrder> {
    try {
      let query: string;
      let values: unknown[];

      // If marking as completed, set completed_at timestamp
      if (status === 'completed') {
        query = `
          UPDATE service_orders
          SET status = $1, completed_at = NOW(), updated_at = NOW()
          WHERE order_id = $2
          RETURNING *
        `;
        values = [status, orderId];
      } else {
        query = `
          UPDATE service_orders
          SET status = $1, updated_at = NOW()
          WHERE order_id = $2
          RETURNING *
        `;
        values = [status, orderId];
      }

      const result = await this.pool.query(query, values);

      if (result.rows.length === 0) {
        throw new Error('Order not found');
      }

      logger.info('Order status updated', { orderId, status });
      return this.mapOrderRow(result.rows[0]);
    } catch (error) {
      logger.error('Error updating order status:', error);
      throw error;
    }
  }

  /**
   * Update Stripe Payment Intent ID
   */
  async updatePaymentIntent(orderId: string, paymentIntentId: string): Promise<ServiceOrder> {
    try {
      const query = `
        UPDATE service_orders
        SET stripe_payment_intent_id = $1, updated_at = NOW()
        WHERE order_id = $2
        RETURNING *
      `;

      const result = await this.pool.query(query, [paymentIntentId, orderId]);

      if (result.rows.length === 0) {
        throw new Error('Order not found');
      }

      logger.info('Payment intent updated', { orderId, paymentIntentId });
      return this.mapOrderRow(result.rows[0]);
    } catch (error) {
      logger.error('Error updating payment intent:', error);
      throw error;
    }
  }

  /**
   * Update order notes
   */
  async updateOrderNotes(orderId: string, notes: string): Promise<ServiceOrder> {
    try {
      const query = `
        UPDATE service_orders
        SET notes = $1, updated_at = NOW()
        WHERE order_id = $2
        RETURNING *
      `;

      const result = await this.pool.query(query, [notes, orderId]);

      if (result.rows.length === 0) {
        throw new Error('Order not found');
      }

      logger.info('Order notes updated', { orderId });
      return this.mapOrderRow(result.rows[0]);
    } catch (error) {
      logger.error('Error updating order notes:', error);
      throw error;
    }
  }

  /**
   * Update order with cancellation details
   */
  async updateCancellationData(
    orderId: string,
    cancellationReason: string,
    cancellationNotes?: string
  ): Promise<ServiceOrder> {
    try {
      const query = `
        UPDATE service_orders
        SET
          status = 'cancelled',
          cancelled_at = NOW(),
          cancellation_reason = $1,
          cancellation_notes = $2,
          updated_at = NOW()
        WHERE order_id = $3
        RETURNING *
      `;

      const result = await this.pool.query(query, [cancellationReason, cancellationNotes || null, orderId]);

      if (result.rows.length === 0) {
        throw new Error('Order not found');
      }

      logger.info('Order cancelled with details', { orderId, cancellationReason });
      return this.mapOrderRow(result.rows[0]);
    } catch (error) {
      logger.error('Error updating cancellation data:', error);
      throw error;
    }
  }

  /**
   * Mark order as no-show
   */
  async markAsNoShow(orderId: string, notes?: string): Promise<ServiceOrder> {
    try {
      const query = `
        UPDATE service_orders
        SET
          status = 'no_show',
          no_show = TRUE,
          marked_no_show_at = NOW(),
          no_show_notes = $1,
          updated_at = NOW()
        WHERE order_id = $2
        RETURNING *
      `;

      const result = await this.pool.query(query, [notes || null, orderId]);

      if (result.rows.length === 0) {
        throw new Error('Order not found');
      }

      logger.info('Order marked as no-show', { orderId });
      return this.mapOrderRow(result.rows[0]);
    } catch (error) {
      logger.error('Error marking order as no-show:', error);
      throw error;
    }
  }

  /**
   * Map database row to ServiceOrder
   */
  private mapOrderRow(row: any): ServiceOrder {
    return {
      orderId: row.order_id,
      serviceId: row.service_id,
      customerAddress: row.customer_address,
      shopId: row.shop_id,
      stripePaymentIntentId: row.stripe_payment_intent_id,
      status: row.status,
      totalAmount: parseFloat(row.total_amount),
      rcnRedeemed: row.rcn_redeemed ? parseFloat(row.rcn_redeemed) : 0,
      rcnDiscountUsd: row.rcn_discount_usd ? parseFloat(row.rcn_discount_usd) : 0,
      finalAmountUsd: row.final_amount_usd ? parseFloat(row.final_amount_usd) : parseFloat(row.total_amount),
      bookingDate: row.booking_date,
      bookingTime: row.booking_time || row.booking_time_slot,
      completedAt: row.completed_at,
      notes: row.notes,
      // Approval fields
      shopApproved: row.shop_approved || false,
      approvedAt: row.approved_at,
      approvedBy: row.approved_by,
      // Reschedule fields
      originalBookingDate: row.original_booking_date,
      originalBookingTimeSlot: row.original_booking_time_slot,
      rescheduledAt: row.rescheduled_at,
      rescheduledBy: row.rescheduled_by,
      rescheduleReason: row.reschedule_reason,
      rescheduleCount: row.reschedule_count || 0,
      noShow: row.no_show || false,
      markedNoShowAt: row.marked_no_show_at,
      noShowNotes: row.no_show_notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Map database row to ServiceOrderWithDetails
   */
  private mapOrderWithDetailsRow(row: any): ServiceOrderWithDetails {
    return {
      ...this.mapOrderRow(row),
      serviceName: row.service_name,
      serviceDescription: row.service_description,
      serviceImageUrl: row.service_image_url,
      serviceDuration: row.service_duration,
      serviceCategory: row.service_category,
      shopName: row.shop_name,
      shopAddress: row.shop_address,
      shopCity: row.shop_city,
      shopPhone: row.shop_phone,
      customerName: row.customer_name,
      customerTier: row.customer_tier,
      customerPhone: row.customer_phone,
      rcnEarned: row.rcn_earned ? parseFloat(row.rcn_earned) : 0,
      promoRcn: row.promo_rcn ? parseFloat(row.promo_rcn) : 0
    };
  }

  /**
   * Approve a booking (Shop only)
   */
  async approveBooking(orderId: string, approvedBy: string): Promise<ServiceOrder> {
    try {
      const query = `
        UPDATE service_orders
        SET
          shop_approved = TRUE,
          approved_at = NOW(),
          approved_by = $1,
          updated_at = NOW()
        WHERE order_id = $2
        RETURNING *
      `;

      const result = await this.pool.query(query, [approvedBy.toLowerCase(), orderId]);

      if (result.rows.length === 0) {
        throw new Error('Order not found');
      }

      logger.info('Booking approved', { orderId, approvedBy });
      return this.mapOrderRow(result.rows[0]);
    } catch (error) {
      logger.error('Error approving booking:', error);
      throw error;
    }
  }

  /**
   * Reschedule a booking
   */
  async rescheduleBooking(
    orderId: string,
    newBookingDate: Date,
    newBookingTime: string,
    rescheduledBy: 'shop' | 'customer',
    reason?: string
  ): Promise<ServiceOrder> {
    try {
      // First get the current booking to save original date if this is the first reschedule
      const currentOrder = await this.getOrderById(orderId);
      if (!currentOrder) {
        throw new Error('Order not found');
      }

      const isFirstReschedule = currentOrder.rescheduleCount === 0;

      const query = `
        UPDATE service_orders
        SET
          ${isFirstReschedule ? `
            original_booking_date = booking_date,
            original_booking_time_slot = booking_time_slot,
          ` : ''}
          booking_date = $1,
          booking_time_slot = $2,
          rescheduled_at = NOW(),
          rescheduled_by = $3,
          reschedule_reason = $4,
          reschedule_count = reschedule_count + 1,
          updated_at = NOW()
        WHERE order_id = $5
        RETURNING *
      `;

      const result = await this.pool.query(query, [
        newBookingDate,
        newBookingTime,
        rescheduledBy,
        reason || null,
        orderId
      ]);

      if (result.rows.length === 0) {
        throw new Error('Order not found');
      }

      logger.info('Booking rescheduled', {
        orderId,
        newBookingDate,
        newBookingTime,
        rescheduledBy,
        rescheduleCount: result.rows[0].reschedule_count
      });
      return this.mapOrderRow(result.rows[0]);
    } catch (error) {
      logger.error('Error rescheduling booking:', error);
      throw error;
    }
  }

  /**
   * Get pending approval bookings for a shop
   */
  async getPendingApprovalBookings(shopId: string): Promise<ServiceOrderWithDetails[]> {
    try {
      const query = `
        SELECT
          o.*,
          s.service_name,
          s.description as service_description,
          s.image_url as service_image_url,
          s.duration_minutes as service_duration,
          s.category as service_category,
          c.name as customer_name,
          c.tier as customer_tier,
          c.phone as customer_phone
        FROM service_orders o
        INNER JOIN shop_services s ON o.service_id = s.service_id
        LEFT JOIN customers c ON o.customer_address = c.address
        WHERE o.shop_id = $1
          AND o.status = 'paid'
          AND (o.shop_approved = FALSE OR o.shop_approved IS NULL)
        ORDER BY o.created_at ASC
      `;

      const result = await this.pool.query(query, [shopId]);
      return result.rows.map(row => this.mapOrderWithDetailsRow(row));
    } catch (error) {
      logger.error('Error fetching pending approval bookings:', error);
      throw error;
    }
  }
}
