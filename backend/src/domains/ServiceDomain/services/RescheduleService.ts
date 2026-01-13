// backend/src/domains/ServiceDomain/services/RescheduleService.ts
import { RescheduleRepository, RescheduleRequest, RescheduleRequestWithDetails, CreateRescheduleRequestInput } from '../../../repositories/RescheduleRepository';
import { AppointmentRepository } from '../../../repositories/AppointmentRepository';
import { logger } from '../../../utils/logger';
import { parseLocalDateString } from '../../../utils/dateUtils';
import { eventBus, createDomainEvent } from '../../../events/EventBus';
import { AppointmentService } from './AppointmentService';
import { getSharedPool } from '../../../utils/database-pool';

export interface RescheduleValidationResult {
  valid: boolean;
  error?: string;
  errorCode?: string;
}

export interface CreateRescheduleResult {
  success: boolean;
  request?: RescheduleRequest;
  error?: string;
  errorCode?: string;
}

export interface ApproveRescheduleResult {
  success: boolean;
  request?: RescheduleRequest;
  error?: string;
  errorCode?: string;
}

export class RescheduleService {
  private rescheduleRepo: RescheduleRepository;
  private appointmentRepo: AppointmentRepository;
  private appointmentService: AppointmentService;

  constructor() {
    this.rescheduleRepo = new RescheduleRepository();
    this.appointmentRepo = new AppointmentRepository();
    this.appointmentService = new AppointmentService();
  }

  /**
   * Validate if a customer can request a reschedule
   */
  async validateRescheduleRequest(
    orderId: string,
    customerAddress: string,
    requestedDate: string,
    requestedTimeSlot: string
  ): Promise<RescheduleValidationResult> {
    try {
      // Get order details
      const orderQuery = await this.rescheduleRepo['pool'].query(
        `SELECT
          order_id, shop_id, service_id, customer_address, status,
          booking_date, booking_time_slot, booking_end_time,
          COALESCE(reschedule_count, 0) as reschedule_count,
          COALESCE(has_pending_reschedule, false) as has_pending_reschedule
        FROM service_orders
        WHERE order_id = $1`,
        [orderId]
      );

      if (orderQuery.rows.length === 0) {
        return { valid: false, error: 'Order not found', errorCode: 'ORDER_NOT_FOUND' };
      }

      const order = orderQuery.rows[0];

      // Verify customer owns this order
      if (order.customer_address.toLowerCase() !== customerAddress.toLowerCase()) {
        return { valid: false, error: 'Unauthorized to reschedule this order', errorCode: 'UNAUTHORIZED' };
      }

      // Check order status - only paid/confirmed orders can be rescheduled
      if (!['paid', 'confirmed'].includes(order.status)) {
        return {
          valid: false,
          error: `Cannot reschedule order with status: ${order.status}`,
          errorCode: 'INVALID_ORDER_STATUS'
        };
      }

      // Check if there's already a pending reschedule request
      if (order.has_pending_reschedule) {
        return {
          valid: false,
          error: 'There is already a pending reschedule request for this order',
          errorCode: 'PENDING_REQUEST_EXISTS'
        };
      }

      // Get shop's reschedule policy
      const policy = await this.rescheduleRepo.getReschedulePolicy(order.shop_id);

      if (!policy || !policy.allowReschedule) {
        return {
          valid: false,
          error: 'This shop does not allow appointment rescheduling',
          errorCode: 'RESCHEDULE_NOT_ALLOWED'
        };
      }

      // Check reschedule limit
      if (order.reschedule_count >= policy.maxReschedulesPerOrder) {
        return {
          valid: false,
          error: `Maximum reschedules (${policy.maxReschedulesPerOrder}) reached for this order`,
          errorCode: 'MAX_RESCHEDULES_REACHED'
        };
      }

      // 24-hour restriction removed - customers can reschedule at any time
      // Shop will review and approve/deny the request

      // Validate the requested time slot is available
      const availableSlots = await this.appointmentService.getAvailableTimeSlots(
        order.shop_id,
        order.service_id,
        requestedDate
      );

      const normalizedRequestedTime = requestedTimeSlot.substring(0, 5); // HH:MM
      const isSlotAvailable = availableSlots.some(
        slot => slot.time === normalizedRequestedTime && slot.available
      );

      if (!isSlotAvailable) {
        return {
          valid: false,
          error: 'The requested time slot is not available',
          errorCode: 'SLOT_NOT_AVAILABLE'
        };
      }

      return { valid: true };
    } catch (error) {
      logger.error('Error validating reschedule request:', error);
      return {
        valid: false,
        error: 'Failed to validate reschedule request',
        errorCode: 'VALIDATION_ERROR'
      };
    }
  }

  /**
   * Create a new reschedule request
   */
  async createRescheduleRequest(
    orderId: string,
    customerAddress: string,
    requestedDate: string,
    requestedTimeSlot: string,
    reason?: string
  ): Promise<CreateRescheduleResult> {
    try {
      // Validate the request first
      const validation = await this.validateRescheduleRequest(
        orderId,
        customerAddress,
        requestedDate,
        requestedTimeSlot
      );

      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          errorCode: validation.errorCode
        };
      }

      // Get order details with customer, shop, and service info for creating the request
      const orderQuery = await this.rescheduleRepo['pool'].query(
        `SELECT
          so.order_id, so.shop_id, so.service_id, so.customer_address,
          TO_CHAR(so.booking_date, 'YYYY-MM-DD') as booking_date, so.booking_time_slot, so.booking_end_time,
          c.name as customer_name,
          s.name as shop_name,
          s.wallet_address as shop_address,
          ss.service_name
        FROM service_orders so
        LEFT JOIN customers c ON so.customer_address = c.wallet_address
        LEFT JOIN shops s ON so.shop_id = s.shop_id
        LEFT JOIN shop_services ss ON so.service_id = ss.service_id
        WHERE so.order_id = $1`,
        [orderId]
      );

      const order = orderQuery.rows[0];

      // Get policy for expiration hours
      const policy = await this.rescheduleRepo.getReschedulePolicy(order.shop_id);

      // Get service duration to calculate end time
      const serviceDuration = await this.appointmentRepo.getServiceDuration(order.service_id);
      const config = await this.appointmentRepo.getTimeSlotConfig(order.shop_id);
      const durationMinutes = serviceDuration?.durationMinutes || config?.slotDurationMinutes || 60;

      // Calculate requested end time
      const [hours, minutes] = requestedTimeSlot.split(':').map(Number);
      const endMinutes = hours * 60 + minutes + durationMinutes;
      const endHours = Math.floor(endMinutes / 60);
      const endMins = endMinutes % 60;
      const requestedEndTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;

      // Format original date and time (booking_date is now a string from SQL TO_CHAR)
      const originalDate = String(order.booking_date).split('T')[0];

      const originalTimeSlot = typeof order.booking_time_slot === 'string'
        ? order.booking_time_slot.substring(0, 5)
        : order.booking_time_slot;

      const originalEndTime = order.booking_end_time
        ? (typeof order.booking_end_time === 'string'
          ? order.booking_end_time.substring(0, 5)
          : order.booking_end_time)
        : null;

      // Create the request
      const input: CreateRescheduleRequestInput = {
        orderId,
        shopId: order.shop_id,
        customerAddress: customerAddress.toLowerCase(),
        originalDate,
        originalTimeSlot,
        originalEndTime,
        requestedDate,
        requestedTimeSlot: requestedTimeSlot.substring(0, 5),
        requestedEndTime,
        customerReason: reason || null,
        expirationHours: policy?.rescheduleExpirationHours || 48
      };

      const request = await this.rescheduleRepo.createRescheduleRequest(input);

      // Emit event for notifications with enriched data
      await eventBus.publish(createDomainEvent(
        'reschedule:request_created',
        request.requestId,
        {
          requestId: request.requestId,
          orderId,
          shopId: order.shop_id,
          shopAddress: order.shop_address?.toLowerCase(),
          shopName: order.shop_name,
          customerAddress: customerAddress.toLowerCase(),
          customerName: order.customer_name || 'Customer',
          serviceName: order.service_name,
          originalDate,
          originalTimeSlot,
          requestedDate,
          requestedTimeSlot: requestedTimeSlot.substring(0, 5),
          reason
        },
        'ServiceDomain'
      ));

      logger.info('Reschedule request created successfully', {
        requestId: request.requestId,
        orderId,
        shopId: order.shop_id
      });

      return { success: true, request };
    } catch (error) {
      logger.error('Error creating reschedule request:', error);
      return {
        success: false,
        error: 'Failed to create reschedule request',
        errorCode: 'CREATE_ERROR'
      };
    }
  }

  /**
   * Approve a reschedule request (shop action)
   */
  async approveRescheduleRequest(
    requestId: string,
    shopAddress: string
  ): Promise<ApproveRescheduleResult> {
    try {
      // Get the request
      const request = await this.rescheduleRepo.getRescheduleRequestById(requestId);

      if (!request) {
        return { success: false, error: 'Request not found', errorCode: 'NOT_FOUND' };
      }

      if (request.status !== 'pending') {
        return {
          success: false,
          error: `Cannot approve request with status: ${request.status}`,
          errorCode: 'INVALID_STATUS'
        };
      }

      // Get additional info for notifications
      const orderInfoQuery = await this.rescheduleRepo['pool'].query(
        `SELECT
          so.service_id,
          c.name as customer_name,
          s.name as shop_name,
          s.wallet_address as shop_address,
          ss.service_name
        FROM service_orders so
        LEFT JOIN customers c ON so.customer_address = c.wallet_address
        LEFT JOIN shops s ON so.shop_id = s.shop_id
        LEFT JOIN shop_services ss ON so.service_id = ss.service_id
        WHERE so.order_id = $1`,
        [request.orderId]
      );
      const orderInfo = orderInfoQuery.rows[0];

      // Slot availability check removed - shop manually approves, they know their schedule

      // Approve the request
      const approvedRequest = await this.rescheduleRepo.approveRescheduleRequest(
        requestId,
        shopAddress
      );

      // Update the order with the new date/time
      await this.rescheduleRepo['pool'].query(
        `UPDATE service_orders SET
          original_booking_date = booking_date,
          original_booking_time_slot = booking_time_slot,
          booking_date = $2,
          booking_time_slot = $3,
          booking_end_time = $4,
          reschedule_count = COALESCE(reschedule_count, 0) + 1,
          rescheduled_at = NOW(),
          rescheduled_by = $5,
          updated_at = NOW()
        WHERE order_id = $1`,
        [
          request.orderId,
          request.requestedDate,
          request.requestedTimeSlot,
          request.requestedEndTime,
          shopAddress.toLowerCase()
        ]
      );

      logger.info('Order updated with new schedule', {
        orderId: request.orderId,
        newDate: request.requestedDate,
        newTimeSlot: request.requestedTimeSlot
      });

      // Emit event for notifications with enriched data
      await eventBus.publish(createDomainEvent(
        'reschedule:request_approved',
        requestId,
        {
          requestId,
          orderId: request.orderId,
          shopId: request.shopId,
          shopAddress: orderInfo.shop_address?.toLowerCase(),
          shopName: orderInfo.shop_name,
          customerAddress: request.customerAddress,
          customerName: orderInfo.customer_name || 'Customer',
          serviceName: orderInfo.service_name,
          originalDate: request.originalDate,
          originalTimeSlot: request.originalTimeSlot,
          newDate: request.requestedDate,
          newTimeSlot: request.requestedTimeSlot
        },
        'ServiceDomain'
      ));

      logger.info('Reschedule request approved', {
        requestId,
        orderId: request.orderId,
        approvedBy: shopAddress
      });

      return { success: true, request: approvedRequest };
    } catch (error) {
      logger.error('Error approving reschedule request:', error);
      return {
        success: false,
        error: 'Failed to approve reschedule request',
        errorCode: 'APPROVE_ERROR'
      };
    }
  }

  /**
   * Reject a reschedule request (shop action)
   */
  async rejectRescheduleRequest(
    requestId: string,
    shopAddress: string,
    reason?: string
  ): Promise<ApproveRescheduleResult> {
    try {
      const request = await this.rescheduleRepo.getRescheduleRequestById(requestId);

      if (!request) {
        return { success: false, error: 'Request not found', errorCode: 'NOT_FOUND' };
      }

      if (request.status !== 'pending') {
        return {
          success: false,
          error: `Cannot reject request with status: ${request.status}`,
          errorCode: 'INVALID_STATUS'
        };
      }

      // Get additional info for notifications
      const orderInfoQuery = await this.rescheduleRepo['pool'].query(
        `SELECT
          c.name as customer_name,
          s.name as shop_name,
          s.wallet_address as shop_address,
          ss.service_name
        FROM service_orders so
        LEFT JOIN customers c ON so.customer_address = c.wallet_address
        LEFT JOIN shops s ON so.shop_id = s.shop_id
        LEFT JOIN shop_services ss ON so.service_id = ss.service_id
        WHERE so.order_id = $1`,
        [request.orderId]
      );
      const orderInfo = orderInfoQuery.rows[0];

      const rejectedRequest = await this.rescheduleRepo.rejectRescheduleRequest(
        requestId,
        shopAddress,
        reason
      );

      // Emit event for notifications with enriched data
      await eventBus.publish(createDomainEvent(
        'reschedule:request_rejected',
        requestId,
        {
          requestId,
          orderId: request.orderId,
          shopId: request.shopId,
          shopAddress: orderInfo?.shop_address?.toLowerCase(),
          shopName: orderInfo?.shop_name,
          customerAddress: request.customerAddress,
          customerName: orderInfo?.customer_name || 'Customer',
          serviceName: orderInfo?.service_name,
          reason
        },
        'ServiceDomain'
      ));

      logger.info('Reschedule request rejected', {
        requestId,
        orderId: request.orderId,
        rejectedBy: shopAddress,
        reason
      });

      return { success: true, request: rejectedRequest };
    } catch (error) {
      logger.error('Error rejecting reschedule request:', error);
      return {
        success: false,
        error: 'Failed to reject reschedule request',
        errorCode: 'REJECT_ERROR'
      };
    }
  }

  /**
   * Cancel a reschedule request (customer action)
   */
  async cancelRescheduleRequest(
    requestId: string,
    customerAddress: string
  ): Promise<ApproveRescheduleResult> {
    try {
      const cancelledRequest = await this.rescheduleRepo.cancelRescheduleRequest(
        requestId,
        customerAddress
      );

      logger.info('Reschedule request cancelled by customer', {
        requestId,
        customerAddress
      });

      return { success: true, request: cancelledRequest };
    } catch (error) {
      logger.error('Error cancelling reschedule request:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel reschedule request',
        errorCode: 'CANCEL_ERROR'
      };
    }
  }

  /**
   * Get reschedule requests for a shop
   */
  async getShopRescheduleRequests(
    shopId: string,
    status?: 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled' | 'all'
  ): Promise<RescheduleRequestWithDetails[]> {
    return this.rescheduleRepo.getShopRescheduleRequests(shopId, status);
  }

  /**
   * Get pending request for an order (if any)
   */
  async getPendingRequestForOrder(orderId: string): Promise<RescheduleRequest | null> {
    return this.rescheduleRepo.getPendingRequestForOrder(orderId);
  }

  /**
   * Get count of pending requests for a shop
   */
  async getPendingRequestCount(shopId: string): Promise<number> {
    return this.rescheduleRepo.countPendingRequestsForShop(shopId);
  }

  /**
   * Expire old pending requests (to be called by a scheduled job)
   */
  async expireOldRequests(): Promise<number> {
    const expiredCount = await this.rescheduleRepo.expireOldRequests();

    if (expiredCount > 0) {
      logger.info('Expired old reschedule requests', { count: expiredCount });

      // Emit event for each expired request (for notifications)
      // Note: In production, you'd want to get the list of expired requests
      // and emit events for each one
    }

    return expiredCount;
  }

  /**
   * Direct reschedule by shop (no approval needed)
   * Shop can directly change the appointment date/time
   */
  async directRescheduleOrder(
    orderId: string,
    shopId: string,
    shopAddress: string,
    newDate: string,
    newTimeSlot: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string; errorCode?: string }> {
    try {
      logger.info('Direct reschedule request', { orderId, shopId, newDate, newTimeSlot });

      // Get order details and verify shop owns it
      const pool = getSharedPool();
      const orderQuery = await pool.query(
        `SELECT
          so.order_id, so.shop_id, so.service_id, so.customer_address, so.status,
          TO_CHAR(so.booking_date, 'YYYY-MM-DD') as booking_date,
          so.booking_time_slot, so.booking_end_time,
          COALESCE(so.reschedule_count, 0) as reschedule_count,
          c.name as customer_name,
          s.name as shop_name,
          ss.service_name
        FROM service_orders so
        LEFT JOIN customers c ON so.customer_address = c.wallet_address
        LEFT JOIN shops s ON so.shop_id = s.shop_id
        LEFT JOIN shop_services ss ON so.service_id = ss.service_id
        WHERE so.order_id = $1`,
        [orderId]
      );

      if (orderQuery.rows.length === 0) {
        return { success: false, error: 'Order not found', errorCode: 'ORDER_NOT_FOUND' };
      }

      const order = orderQuery.rows[0];

      // Verify shop owns this order
      if (order.shop_id !== shopId) {
        return { success: false, error: 'Unauthorized to reschedule this order', errorCode: 'UNAUTHORIZED' };
      }

      // Check order status - only paid/confirmed/scheduled orders can be rescheduled
      if (!['paid', 'confirmed', 'scheduled'].includes(order.status)) {
        return {
          success: false,
          error: `Cannot reschedule order with status: ${order.status}`,
          errorCode: 'INVALID_ORDER_STATUS'
        };
      }

      // Get service duration to calculate end time
      const serviceDuration = await this.appointmentRepo.getServiceDuration(order.service_id);
      const config = await this.appointmentRepo.getTimeSlotConfig(order.shop_id);
      const durationMinutes = serviceDuration?.durationMinutes || config?.slotDurationMinutes || 60;

      // Calculate new end time
      const [hours, minutes] = newTimeSlot.split(':').map(Number);
      const endMinutes = hours * 60 + minutes + durationMinutes;
      const endHours = Math.floor(endMinutes / 60);
      const endMins = endMinutes % 60;
      const newEndTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;

      // Store original values before update
      const originalDate = order.booking_date;
      const originalTimeSlot = typeof order.booking_time_slot === 'string'
        ? order.booking_time_slot.substring(0, 5)
        : order.booking_time_slot;

      // Update the order directly - use basic columns that are guaranteed to exist
      logger.info('Updating order with new date/time', { orderId, newDate, newTimeSlot: newTimeSlot.substring(0, 5), newEndTime });

      try {
        const updateResult = await pool.query(
          `UPDATE service_orders SET
            booking_date = $2,
            booking_time_slot = $3,
            booking_end_time = $4,
            updated_at = NOW()
          WHERE order_id = $1`,
          [
            orderId,
            newDate,
            newTimeSlot.substring(0, 5),
            newEndTime
          ]
        );

        logger.info('Order updated successfully', { rowsAffected: updateResult.rowCount });

        // Try to update optional tracking columns (may fail if columns don't exist)
        try {
          await pool.query(
            `UPDATE service_orders SET
              original_booking_date = COALESCE(original_booking_date, $2::timestamp),
              original_booking_time_slot = COALESCE(original_booking_time_slot, $3),
              reschedule_count = COALESCE(reschedule_count, 0) + 1,
              rescheduled_at = NOW(),
              rescheduled_by = $4,
              reschedule_reason = $5
            WHERE order_id = $1`,
            [
              orderId,
              originalDate,
              originalTimeSlot,
              shopAddress.toLowerCase(),
              reason || 'Rescheduled by shop'
            ]
          );
        } catch (trackingError) {
          // Tracking columns may not exist - that's OK, core update succeeded
          logger.warn('Could not update reschedule tracking columns (migration may not be applied):', trackingError);
        }
      } catch (updateError) {
        logger.error('Failed to update order:', updateError);
        throw updateError;
      }

      // Emit event for customer notification
      await eventBus.publish(createDomainEvent(
        'booking:rescheduled_by_shop',
        orderId,
        {
          orderId,
          shopId: order.shop_id,
          shopName: order.shop_name,
          customerAddress: order.customer_address,
          customerName: order.customer_name || 'Customer',
          serviceName: order.service_name,
          originalDate,
          originalTimeSlot,
          newDate,
          newTimeSlot: newTimeSlot.substring(0, 5),
          reason: reason || 'Rescheduled by shop',
          rescheduledBy: shopAddress.toLowerCase()
        },
        'ServiceDomain'
      ));

      logger.info('Order rescheduled directly by shop', {
        orderId,
        shopId,
        originalDate,
        originalTimeSlot,
        newDate,
        newTimeSlot,
        rescheduledBy: shopAddress
      });

      return { success: true };
    } catch (error) {
      logger.error('Error in direct reschedule by shop:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Failed to reschedule order: ${errorMessage}`,
        errorCode: 'RESCHEDULE_ERROR'
      };
    }
  }
}
