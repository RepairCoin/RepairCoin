// backend/src/repositories/RescheduleRepository.ts
import { BaseRepository } from './BaseRepository';
import { logger } from '../utils/logger';

export interface RescheduleRequest {
  requestId: string;
  orderId: string;
  shopId: string;
  customerAddress: string;
  originalDate: string;
  originalTimeSlot: string;
  originalEndTime: string | null;
  requestedDate: string;
  requestedTimeSlot: string;
  requestedEndTime: string | null;
  customerReason: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';
  shopResponseReason: string | null;
  respondedAt: string | null;
  respondedBy: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
}

export interface RescheduleRequestWithDetails extends RescheduleRequest {
  customerName: string | null;
  customerEmail: string | null;
  serviceId: string;
  serviceName: string;
  hoursUntilExpiry: number | null;
}

export interface ReschedulePolicy {
  allowReschedule: boolean;
  maxReschedulesPerOrder: number;
  rescheduleMinHours: number;
  rescheduleExpirationHours: number;
  autoApproveReschedule: boolean;
  requireRescheduleReason: boolean;
}

export interface CreateRescheduleRequestInput {
  orderId: string;
  shopId: string;
  customerAddress: string;
  originalDate: string;
  originalTimeSlot: string;
  originalEndTime?: string | null;
  requestedDate: string;
  requestedTimeSlot: string;
  requestedEndTime?: string | null;
  customerReason?: string | null;
  expirationHours?: number;
}

export interface ExpiredRequestInfo {
  requestId: string;
  orderId: string;
  customerAddress: string;
  shopId: string;
  customerName: string;
  shopName: string;
  serviceName: string;
}

export class RescheduleRepository extends BaseRepository {
  // ==================== CREATE ====================

  async createRescheduleRequest(input: CreateRescheduleRequestInput): Promise<RescheduleRequest> {
    try {
      const expirationHours = input.expirationHours ?? 48;

      const query = `
        INSERT INTO appointment_reschedule_requests (
          order_id,
          shop_id,
          customer_address,
          original_date,
          original_time_slot,
          original_end_time,
          requested_date,
          requested_time_slot,
          requested_end_time,
          customer_reason,
          expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW() + INTERVAL '${expirationHours} hours')
        RETURNING
          request_id as "requestId",
          order_id as "orderId",
          shop_id as "shopId",
          customer_address as "customerAddress",
          original_date as "originalDate",
          original_time_slot as "originalTimeSlot",
          original_end_time as "originalEndTime",
          requested_date as "requestedDate",
          requested_time_slot as "requestedTimeSlot",
          requested_end_time as "requestedEndTime",
          customer_reason as "customerReason",
          status,
          shop_response_reason as "shopResponseReason",
          responded_at as "respondedAt",
          responded_by as "respondedBy",
          created_at as "createdAt",
          updated_at as "updatedAt",
          expires_at as "expiresAt"
      `;

      const result = await this.pool.query(query, [
        input.orderId,
        input.shopId,
        input.customerAddress.toLowerCase(),
        input.originalDate,
        input.originalTimeSlot,
        input.originalEndTime || null,
        input.requestedDate,
        input.requestedTimeSlot,
        input.requestedEndTime || null,
        input.customerReason || null
      ]);

      logger.info('Reschedule request created', {
        requestId: result.rows[0].requestId,
        orderId: input.orderId,
        shopId: input.shopId
      });

      return result.rows[0];
    } catch (error) {
      logger.error('Error creating reschedule request:', error);
      throw new Error('Failed to create reschedule request');
    }
  }

  // ==================== READ ====================

  async getRescheduleRequestById(requestId: string): Promise<RescheduleRequest | null> {
    try {
      const query = `
        SELECT
          request_id as "requestId",
          order_id as "orderId",
          shop_id as "shopId",
          customer_address as "customerAddress",
          original_date as "originalDate",
          original_time_slot as "originalTimeSlot",
          original_end_time as "originalEndTime",
          requested_date as "requestedDate",
          requested_time_slot as "requestedTimeSlot",
          requested_end_time as "requestedEndTime",
          customer_reason as "customerReason",
          status,
          shop_response_reason as "shopResponseReason",
          responded_at as "respondedAt",
          responded_by as "respondedBy",
          created_at as "createdAt",
          updated_at as "updatedAt",
          expires_at as "expiresAt"
        FROM appointment_reschedule_requests
        WHERE request_id = $1
      `;

      const result = await this.pool.query(query, [requestId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting reschedule request:', error);
      throw new Error('Failed to get reschedule request');
    }
  }

  async getPendingRequestForOrder(orderId: string): Promise<RescheduleRequest | null> {
    try {
      const query = `
        SELECT
          request_id as "requestId",
          order_id as "orderId",
          shop_id as "shopId",
          customer_address as "customerAddress",
          original_date as "originalDate",
          original_time_slot as "originalTimeSlot",
          original_end_time as "originalEndTime",
          requested_date as "requestedDate",
          requested_time_slot as "requestedTimeSlot",
          requested_end_time as "requestedEndTime",
          customer_reason as "customerReason",
          status,
          shop_response_reason as "shopResponseReason",
          responded_at as "respondedAt",
          responded_by as "respondedBy",
          created_at as "createdAt",
          updated_at as "updatedAt",
          expires_at as "expiresAt"
        FROM appointment_reschedule_requests
        WHERE order_id = $1 AND status = 'pending'
        LIMIT 1
      `;

      const result = await this.pool.query(query, [orderId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting pending request for order:', error);
      throw new Error('Failed to get pending request');
    }
  }

  async getShopRescheduleRequests(
    shopId: string,
    status?: 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled' | 'all'
  ): Promise<RescheduleRequestWithDetails[]> {
    try {
      let query = `
        SELECT
          r.request_id as "requestId",
          r.order_id as "orderId",
          r.shop_id as "shopId",
          r.customer_address as "customerAddress",
          c.name as "customerName",
          c.email as "customerEmail",
          o.service_id as "serviceId",
          s.service_name as "serviceName",
          r.original_date as "originalDate",
          r.original_time_slot as "originalTimeSlot",
          r.original_end_time as "originalEndTime",
          r.requested_date as "requestedDate",
          r.requested_time_slot as "requestedTimeSlot",
          r.requested_end_time as "requestedEndTime",
          r.customer_reason as "customerReason",
          r.status,
          r.shop_response_reason as "shopResponseReason",
          r.responded_at as "respondedAt",
          r.responded_by as "respondedBy",
          r.created_at as "createdAt",
          r.updated_at as "updatedAt",
          r.expires_at as "expiresAt",
          CASE
            WHEN r.status = 'pending' AND r.expires_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (r.expires_at - NOW())) / 3600
            ELSE NULL
          END as "hoursUntilExpiry"
        FROM appointment_reschedule_requests r
        JOIN service_orders o ON r.order_id = o.order_id
        JOIN shop_services s ON o.service_id = s.service_id
        LEFT JOIN customers c ON r.customer_address = c.wallet_address
        WHERE r.shop_id = $1
      `;

      const params: any[] = [shopId];

      if (status && status !== 'all') {
        query += ` AND r.status = $2`;
        params.push(status);
      }

      query += ` ORDER BY
        CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END,
        r.created_at DESC`;

      const result = await this.pool.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Error getting shop reschedule requests:', error);
      throw new Error('Failed to get shop reschedule requests');
    }
  }

  async getCustomerRescheduleRequests(customerAddress: string): Promise<RescheduleRequestWithDetails[]> {
    try {
      const query = `
        SELECT
          r.request_id as "requestId",
          r.order_id as "orderId",
          r.shop_id as "shopId",
          r.customer_address as "customerAddress",
          c.name as "customerName",
          c.email as "customerEmail",
          o.service_id as "serviceId",
          s.service_name as "serviceName",
          r.original_date as "originalDate",
          r.original_time_slot as "originalTimeSlot",
          r.original_end_time as "originalEndTime",
          r.requested_date as "requestedDate",
          r.requested_time_slot as "requestedTimeSlot",
          r.requested_end_time as "requestedEndTime",
          r.customer_reason as "customerReason",
          r.status,
          r.shop_response_reason as "shopResponseReason",
          r.responded_at as "respondedAt",
          r.responded_by as "respondedBy",
          r.created_at as "createdAt",
          r.updated_at as "updatedAt",
          r.expires_at as "expiresAt",
          CASE
            WHEN r.status = 'pending' AND r.expires_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (r.expires_at - NOW())) / 3600
            ELSE NULL
          END as "hoursUntilExpiry"
        FROM appointment_reschedule_requests r
        JOIN service_orders o ON r.order_id = o.order_id
        JOIN shop_services s ON o.service_id = s.service_id
        LEFT JOIN customers c ON r.customer_address = c.wallet_address
        WHERE r.customer_address = $1
        ORDER BY r.created_at DESC
      `;

      const result = await this.pool.query(query, [customerAddress.toLowerCase()]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting customer reschedule requests:', error);
      throw new Error('Failed to get customer reschedule requests');
    }
  }

  async countPendingRequestsForShop(shopId: string): Promise<number> {
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM appointment_reschedule_requests
        WHERE shop_id = $1 AND status = 'pending'
      `;

      const result = await this.pool.query(query, [shopId]);
      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error('Error counting pending requests:', error);
      throw new Error('Failed to count pending requests');
    }
  }

  // ==================== UPDATE ====================

  async approveRescheduleRequest(
    requestId: string,
    respondedBy: string
  ): Promise<RescheduleRequest> {
    try {
      const query = `
        UPDATE appointment_reschedule_requests
        SET
          status = 'approved',
          responded_at = NOW(),
          responded_by = $2,
          updated_at = NOW()
        WHERE request_id = $1 AND status = 'pending'
        RETURNING
          request_id as "requestId",
          order_id as "orderId",
          shop_id as "shopId",
          customer_address as "customerAddress",
          original_date as "originalDate",
          original_time_slot as "originalTimeSlot",
          original_end_time as "originalEndTime",
          requested_date as "requestedDate",
          requested_time_slot as "requestedTimeSlot",
          requested_end_time as "requestedEndTime",
          customer_reason as "customerReason",
          status,
          shop_response_reason as "shopResponseReason",
          responded_at as "respondedAt",
          responded_by as "respondedBy",
          created_at as "createdAt",
          updated_at as "updatedAt",
          expires_at as "expiresAt"
      `;

      const result = await this.pool.query(query, [requestId, respondedBy.toLowerCase()]);

      if (result.rows.length === 0) {
        throw new Error('Request not found or not pending');
      }

      logger.info('Reschedule request approved', {
        requestId,
        respondedBy
      });

      return result.rows[0];
    } catch (error) {
      logger.error('Error approving reschedule request:', error);
      throw error;
    }
  }

  async rejectRescheduleRequest(
    requestId: string,
    respondedBy: string,
    reason?: string
  ): Promise<RescheduleRequest> {
    try {
      const query = `
        UPDATE appointment_reschedule_requests
        SET
          status = 'rejected',
          shop_response_reason = $3,
          responded_at = NOW(),
          responded_by = $2,
          updated_at = NOW()
        WHERE request_id = $1 AND status = 'pending'
        RETURNING
          request_id as "requestId",
          order_id as "orderId",
          shop_id as "shopId",
          customer_address as "customerAddress",
          original_date as "originalDate",
          original_time_slot as "originalTimeSlot",
          original_end_time as "originalEndTime",
          requested_date as "requestedDate",
          requested_time_slot as "requestedTimeSlot",
          requested_end_time as "requestedEndTime",
          customer_reason as "customerReason",
          status,
          shop_response_reason as "shopResponseReason",
          responded_at as "respondedAt",
          responded_by as "respondedBy",
          created_at as "createdAt",
          updated_at as "updatedAt",
          expires_at as "expiresAt"
      `;

      const result = await this.pool.query(query, [requestId, respondedBy.toLowerCase(), reason || null]);

      if (result.rows.length === 0) {
        throw new Error('Request not found or not pending');
      }

      logger.info('Reschedule request rejected', {
        requestId,
        respondedBy,
        reason
      });

      return result.rows[0];
    } catch (error) {
      logger.error('Error rejecting reschedule request:', error);
      throw error;
    }
  }

  async cancelRescheduleRequest(requestId: string, customerAddress: string): Promise<RescheduleRequest> {
    try {
      const query = `
        UPDATE appointment_reschedule_requests
        SET
          status = 'cancelled',
          updated_at = NOW()
        WHERE request_id = $1
          AND customer_address = $2
          AND status = 'pending'
        RETURNING
          request_id as "requestId",
          order_id as "orderId",
          shop_id as "shopId",
          customer_address as "customerAddress",
          original_date as "originalDate",
          original_time_slot as "originalTimeSlot",
          original_end_time as "originalEndTime",
          requested_date as "requestedDate",
          requested_time_slot as "requestedTimeSlot",
          requested_end_time as "requestedEndTime",
          customer_reason as "customerReason",
          status,
          shop_response_reason as "shopResponseReason",
          responded_at as "respondedAt",
          responded_by as "respondedBy",
          created_at as "createdAt",
          updated_at as "updatedAt",
          expires_at as "expiresAt"
      `;

      const result = await this.pool.query(query, [requestId, customerAddress.toLowerCase()]);

      if (result.rows.length === 0) {
        throw new Error('Request not found, not pending, or unauthorized');
      }

      logger.info('Reschedule request cancelled by customer', {
        requestId,
        customerAddress
      });

      return result.rows[0];
    } catch (error) {
      logger.error('Error cancelling reschedule request:', error);
      throw error;
    }
  }

  async expireOldRequests(): Promise<ExpiredRequestInfo[]> {
    try {
      // First, get the details of requests that will be expired (for notifications)
      const selectQuery = `
        SELECT
          arr.request_id,
          arr.order_id,
          arr.customer_address,
          arr.shop_id,
          c.name as customer_name,
          s.name as shop_name,
          ss.service_name
        FROM appointment_reschedule_requests arr
        LEFT JOIN customers c ON arr.customer_address = c.wallet_address
        LEFT JOIN shops s ON arr.shop_id = s.shop_id
        LEFT JOIN service_orders so ON arr.order_id = so.order_id
        LEFT JOIN shop_services ss ON so.service_id = ss.service_id
        WHERE arr.status = 'pending'
          AND arr.expires_at IS NOT NULL
          AND arr.expires_at < NOW()
      `;

      const selectResult = await this.pool.query(selectQuery);
      const expiredRequests: ExpiredRequestInfo[] = selectResult.rows.map(row => ({
        requestId: row.request_id,
        orderId: row.order_id,
        customerAddress: row.customer_address,
        shopId: row.shop_id,
        customerName: row.customer_name || 'Customer',
        shopName: row.shop_name || 'Shop',
        serviceName: row.service_name || 'Service',
      }));

      if (expiredRequests.length === 0) {
        return [];
      }

      // Now update the status to expired
      const updateQuery = `
        UPDATE appointment_reschedule_requests
        SET
          status = 'expired',
          updated_at = NOW()
        WHERE status = 'pending'
          AND expires_at IS NOT NULL
          AND expires_at < NOW()
      `;

      await this.pool.query(updateQuery);
      logger.info('Expired old reschedule requests', { count: expiredRequests.length });

      return expiredRequests;
    } catch (error) {
      logger.error('Error expiring old requests:', error);
      throw new Error('Failed to expire old requests');
    }
  }

  // ==================== POLICY ====================

  async getReschedulePolicy(shopId: string): Promise<ReschedulePolicy | null> {
    try {
      const query = `
        SELECT
          COALESCE(allow_reschedule, true) as "allowReschedule",
          COALESCE(max_reschedules_per_order, 2) as "maxReschedulesPerOrder",
          COALESCE(reschedule_min_hours, 24) as "rescheduleMinHours",
          COALESCE(reschedule_expiration_hours, 48) as "rescheduleExpirationHours",
          COALESCE(auto_approve_reschedule, false) as "autoApproveReschedule",
          COALESCE(require_reschedule_reason, false) as "requireRescheduleReason"
        FROM shop_time_slot_config
        WHERE shop_id = $1
      `;

      const result = await this.pool.query(query, [shopId]);

      if (result.rows.length === 0) {
        // Return defaults if no config exists
        return {
          allowReschedule: true,
          maxReschedulesPerOrder: 2,
          rescheduleMinHours: 24,
          rescheduleExpirationHours: 48,
          autoApproveReschedule: false,
          requireRescheduleReason: false
        };
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Error getting reschedule policy:', error);
      throw new Error('Failed to get reschedule policy');
    }
  }

  async updateReschedulePolicy(shopId: string, policy: Partial<ReschedulePolicy>): Promise<ReschedulePolicy> {
    try {
      const query = `
        UPDATE shop_time_slot_config
        SET
          allow_reschedule = COALESCE($2, allow_reschedule),
          max_reschedules_per_order = COALESCE($3, max_reschedules_per_order),
          reschedule_min_hours = COALESCE($4, reschedule_min_hours),
          reschedule_expiration_hours = COALESCE($5, reschedule_expiration_hours),
          auto_approve_reschedule = COALESCE($6, auto_approve_reschedule),
          require_reschedule_reason = COALESCE($7, require_reschedule_reason),
          updated_at = NOW()
        WHERE shop_id = $1
        RETURNING
          allow_reschedule as "allowReschedule",
          max_reschedules_per_order as "maxReschedulesPerOrder",
          reschedule_min_hours as "rescheduleMinHours",
          reschedule_expiration_hours as "rescheduleExpirationHours",
          auto_approve_reschedule as "autoApproveReschedule",
          require_reschedule_reason as "requireRescheduleReason"
      `;

      const result = await this.pool.query(query, [
        shopId,
        policy.allowReschedule,
        policy.maxReschedulesPerOrder,
        policy.rescheduleMinHours,
        policy.rescheduleExpirationHours,
        policy.autoApproveReschedule,
        policy.requireRescheduleReason
      ]);

      if (result.rows.length === 0) {
        throw new Error('Shop config not found');
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Error updating reschedule policy:', error);
      throw new Error('Failed to update reschedule policy');
    }
  }

  // ==================== HELPERS ====================

  async getOrderRescheduleCount(orderId: string): Promise<number> {
    try {
      const query = `
        SELECT COALESCE(reschedule_count, 0) as count
        FROM service_orders
        WHERE order_id = $1
      `;

      const result = await this.pool.query(query, [orderId]);
      return result.rows[0]?.count || 0;
    } catch (error) {
      logger.error('Error getting order reschedule count:', error);
      throw new Error('Failed to get reschedule count');
    }
  }

  async getRequestHistory(orderId: string): Promise<RescheduleRequest[]> {
    try {
      const query = `
        SELECT
          request_id as "requestId",
          order_id as "orderId",
          shop_id as "shopId",
          customer_address as "customerAddress",
          original_date as "originalDate",
          original_time_slot as "originalTimeSlot",
          original_end_time as "originalEndTime",
          requested_date as "requestedDate",
          requested_time_slot as "requestedTimeSlot",
          requested_end_time as "requestedEndTime",
          customer_reason as "customerReason",
          status,
          shop_response_reason as "shopResponseReason",
          responded_at as "respondedAt",
          responded_by as "respondedBy",
          created_at as "createdAt",
          updated_at as "updatedAt",
          expires_at as "expiresAt"
        FROM appointment_reschedule_requests
        WHERE order_id = $1
        ORDER BY created_at DESC
      `;

      const result = await this.pool.query(query, [orderId]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting request history:', error);
      throw new Error('Failed to get request history');
    }
  }
}
