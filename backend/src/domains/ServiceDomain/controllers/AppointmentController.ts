// backend/src/domains/ServiceDomain/controllers/AppointmentController.ts
import { Request, Response } from 'express';
import { AppointmentRepository } from '../../../repositories/AppointmentRepository';
import { ServiceRepository } from '../../../repositories/ServiceRepository';
import { AppointmentService } from '../services/AppointmentService';
import { RescheduleService } from '../services/RescheduleService';
import { logger } from '../../../utils/logger';

export class AppointmentController {
  private appointmentRepo: AppointmentRepository;
  private appointmentService: AppointmentService;
  private rescheduleService: RescheduleService;
  private serviceRepo: ServiceRepository;

  constructor() {
    this.appointmentRepo = new AppointmentRepository();
    this.appointmentService = new AppointmentService();
    this.rescheduleService = new RescheduleService();
    this.serviceRepo = new ServiceRepository();
  }

  /**
   * Get available time slots for a service
   * GET /api/services/appointments/available-slots
   *
   * Time slot availability is calculated using the SHOP's timezone.
   * The slot times are converted to absolute UTC timestamps internally,
   * so this works correctly for users in any timezone.
   */
  getAvailableTimeSlots = async (req: Request, res: Response) => {
    try {
      const { shopId, serviceId, date } = req.query;

      if (!shopId || !serviceId || !date) {
        return res.status(400).json({
          success: false,
          error: 'shopId, serviceId, and date are required'
        });
      }

      const slots = await this.appointmentService.getAvailableTimeSlots(
        shopId as string,
        serviceId as string,
        date as string
      );

      res.json({
        success: true,
        data: slots
      });
    } catch (error: unknown) {
      logger.error('Error in getAvailableTimeSlots controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get available time slots'
      });
    }
  };

  /**
   * Get shop availability (operating hours)
   * GET /api/services/appointments/shop-availability/:shopId
   */
  getShopAvailability = async (req: Request, res: Response) => {
    try {
      const { shopId } = req.params;

      const availability = await this.appointmentRepo.getShopAvailability(shopId);

      res.json({
        success: true,
        data: availability
      });
    } catch (error: unknown) {
      logger.error('Error in getShopAvailability controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get shop availability'
      });
    }
  };

  /**
   * Get time slot configuration by shop ID (Public - for customers)
   * GET /api/services/appointments/time-slot-config/:shopId
   */
  getPublicTimeSlotConfig = async (req: Request, res: Response) => {
    try {
      const { shopId } = req.params;

      if (!shopId) {
        return res.status(400).json({ success: false, error: 'shopId is required' });
      }

      const config = await this.appointmentRepo.getTimeSlotConfig(shopId);

      res.json({
        success: true,
        data: config
      });
    } catch (error: unknown) {
      logger.error('Error in getPublicTimeSlotConfig controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get time slot config'
      });
    }
  };

  /**
   * Update shop availability (Shop only)
   * PUT /api/services/appointments/shop-availability
   */
  updateShopAvailability = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const { dayOfWeek, isOpen, openTime, closeTime, breakStartTime, breakEndTime } = req.body;

      if (dayOfWeek === undefined) {
        return res.status(400).json({ success: false, error: 'dayOfWeek is required' });
      }

      const availability = await this.appointmentRepo.updateShopAvailability({
        shopId,
        dayOfWeek,
        isOpen,
        openTime,
        closeTime,
        breakStartTime,
        breakEndTime
      });

      res.json({
        success: true,
        data: availability
      });
    } catch (error: unknown) {
      logger.error('Error in updateShopAvailability controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update shop availability'
      });
    }
  };

  /**
   * Get time slot configuration (Shop only)
   * GET /api/services/appointments/time-slot-config
   */
  getTimeSlotConfig = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const config = await this.appointmentRepo.getTimeSlotConfig(shopId);

      res.json({
        success: true,
        data: config
      });
    } catch (error: unknown) {
      logger.error('Error in getTimeSlotConfig controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get time slot config'
      });
    }
  };

  /**
   * Update time slot configuration (Shop only)
   * PUT /api/services/appointments/time-slot-config
   */
  updateTimeSlotConfig = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const {
        slotDurationMinutes,
        bufferTimeMinutes,
        maxConcurrentBookings,
        bookingAdvanceDays,
        minBookingHours,
        allowWeekendBooking
      } = req.body;

      // Validate all fields before saving
      const validationErrors: string[] = [];

      // Slot Duration: 15-480 minutes (15 min to 8 hours)
      if (slotDurationMinutes !== undefined) {
        if (typeof slotDurationMinutes !== 'number' || !Number.isInteger(slotDurationMinutes) || slotDurationMinutes < 15 || slotDurationMinutes > 480) {
          validationErrors.push('Slot duration must be between 15 and 480 minutes');
        }
      }

      // Buffer Time: 0-120 minutes
      if (bufferTimeMinutes !== undefined) {
        if (typeof bufferTimeMinutes !== 'number' || !Number.isInteger(bufferTimeMinutes) || bufferTimeMinutes < 0 || bufferTimeMinutes > 120) {
          validationErrors.push('Buffer time must be between 0 and 120 minutes');
        }
      }

      // Max Concurrent Bookings: 1-50
      if (maxConcurrentBookings !== undefined) {
        if (typeof maxConcurrentBookings !== 'number' || !Number.isInteger(maxConcurrentBookings) || maxConcurrentBookings < 1 || maxConcurrentBookings > 50) {
          validationErrors.push('Max concurrent bookings must be between 1 and 50');
        }
      }

      // Booking Advance: 1-365 days
      if (bookingAdvanceDays !== undefined) {
        if (typeof bookingAdvanceDays !== 'number' || !Number.isInteger(bookingAdvanceDays) || bookingAdvanceDays < 1 || bookingAdvanceDays > 365) {
          validationErrors.push('Booking advance must be between 1 and 365 days');
        }
      }

      // Minimum Notice: 0-168 hours (1 week)
      if (minBookingHours !== undefined) {
        if (typeof minBookingHours !== 'number' || !Number.isInteger(minBookingHours) || minBookingHours < 0 || minBookingHours > 168) {
          validationErrors.push('Minimum notice must be between 0 and 168 hours');
        }
      }

      // Weekend Booking: must be boolean
      if (allowWeekendBooking !== undefined && typeof allowWeekendBooking !== 'boolean') {
        validationErrors.push('Allow weekend booking must be true or false');
      }

      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validationErrors
        });
      }

      const config = await this.appointmentRepo.updateTimeSlotConfig({
        shopId,
        slotDurationMinutes,
        bufferTimeMinutes,
        maxConcurrentBookings,
        bookingAdvanceDays,
        minBookingHours,
        allowWeekendBooking
      });

      res.json({
        success: true,
        data: config
      });
    } catch (error: unknown) {
      logger.error('Error in updateTimeSlotConfig controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update time slot config'
      });
    }
  };

  /**
   * Delete time slot configuration (Shop only)
   * DELETE /api/services/appointments/time-slot-config
   */
  deleteTimeSlotConfig = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      await this.appointmentRepo.deleteTimeSlotConfig(shopId);

      res.json({
        success: true,
        message: 'Time slot configuration deleted successfully'
      });
    } catch (error: unknown) {
      logger.error('Error in deleteTimeSlotConfig controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete time slot config'
      });
    }
  };

  /**
   * Get date overrides (Shop only)
   * GET /api/services/appointments/date-overrides
   */
  getDateOverrides = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const { startDate, endDate } = req.query;

      const overrides = await this.appointmentRepo.getDateOverrides(
        shopId,
        startDate as string | undefined,
        endDate as string | undefined
      );

      res.json({
        success: true,
        data: overrides
      });
    } catch (error: unknown) {
      logger.error('Error in getDateOverrides controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get date overrides'
      });
    }
  };

  /**
   * Create date override (Shop only)
   * POST /api/services/appointments/date-overrides
   */
  createDateOverride = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const { overrideDate, isClosed, customOpenTime, customCloseTime, reason } = req.body;

      if (!overrideDate) {
        return res.status(400).json({ success: false, error: 'overrideDate is required' });
      }

      const override = await this.appointmentRepo.createDateOverride({
        shopId,
        overrideDate,
        isClosed,
        customOpenTime,
        customCloseTime,
        reason
      });

      res.json({
        success: true,
        data: override
      });
    } catch (error: unknown) {
      logger.error('Error in createDateOverride controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create date override'
      });
    }
  };

  /**
   * Delete date override (Shop only)
   * DELETE /api/services/appointments/date-overrides/:date
   */
  deleteDateOverride = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const { date } = req.params;

      await this.appointmentRepo.deleteDateOverride(shopId, date);

      res.json({
        success: true,
        message: 'Date override deleted successfully'
      });
    } catch (error: unknown) {
      logger.error('Error in deleteDateOverride controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete date override'
      });
    }
  };

  /**
   * Get shop calendar view (Shop only)
   * GET /api/services/appointments/calendar
   */
  getShopCalendar = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'startDate and endDate are required'
        });
      }

      const bookings = await this.appointmentRepo.getShopCalendar(
        shopId,
        startDate as string,
        endDate as string
      );

      res.json({
        success: true,
        data: bookings
      });
    } catch (error: unknown) {
      logger.error('Error in getShopCalendar controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get shop calendar'
      });
    }
  };

  /**
   * Get service duration (Shop only)
   * GET /api/services/:serviceId/duration
   */
  getServiceDuration = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const { serviceId } = req.params;

      // Validate serviceId format (srv_ prefix + UUID)
      if (!serviceId || !/^srv_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serviceId)) {
        return res.status(400).json({ success: false, error: 'Invalid service ID format' });
      }

      // Verify the service belongs to the authenticated shop
      const service = await this.serviceRepo.getServiceById(serviceId);
      if (!service) {
        return res.status(404).json({ success: false, error: 'Service not found' });
      }
      if (service.shopId !== shopId) {
        return res.status(403).json({ success: false, error: 'Unauthorized to access this service' });
      }

      const result = await this.appointmentRepo.getServiceDuration(serviceId);

      res.json({
        success: true,
        data: result
      });
    } catch (error: unknown) {
      logger.error('Error in getServiceDuration controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get service duration'
      });
    }
  };

  /**
   * Update service duration (Shop only)
   * PUT /api/services/:serviceId/duration
   */
  updateServiceDuration = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const { serviceId } = req.params;
      const { durationMinutes } = req.body;

      // Validate serviceId format (srv_ prefix + UUID)
      if (!serviceId || !/^srv_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serviceId)) {
        return res.status(400).json({ success: false, error: 'Invalid service ID format' });
      }

      // Validate durationMinutes - check for undefined/null explicitly
      if (durationMinutes === undefined || durationMinutes === null) {
        return res.status(400).json({ success: false, error: 'durationMinutes is required' });
      }

      // Validate durationMinutes is a positive number
      const duration = Number(durationMinutes);
      if (isNaN(duration) || duration < 1) {
        return res.status(400).json({ success: false, error: 'durationMinutes must be a positive number' });
      }

      // Verify the service belongs to the authenticated shop
      const service = await this.serviceRepo.getServiceById(serviceId);
      if (!service) {
        return res.status(404).json({ success: false, error: 'Service not found' });
      }
      if (service.shopId !== shopId) {
        return res.status(403).json({ success: false, error: 'Unauthorized to modify this service' });
      }

      const result = await this.appointmentRepo.updateServiceDuration(serviceId, duration);

      res.json({
        success: true,
        data: result
      });
    } catch (error: unknown) {
      logger.error('Error in updateServiceDuration controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update service duration'
      });
    }
  };

  /**
   * Get customer's appointments (Customer only)
   * GET /api/services/appointments/my-appointments
   */
  getCustomerAppointments = async (req: Request, res: Response) => {
    try {
      const customerAddress = req.user?.address;
      if (!customerAddress) {
        return res.status(401).json({ success: false, error: 'Customer authentication required' });
      }

      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'startDate and endDate are required'
        });
      }

      const appointments = await this.appointmentRepo.getCustomerAppointments(
        customerAddress,
        startDate as string,
        endDate as string
      );

      res.json({
        success: true,
        data: appointments
      });
    } catch (error: unknown) {
      logger.error('Error in getCustomerAppointments controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get customer appointments'
      });
    }
  };

  /**
   * Cancel appointment (Customer only)
   * POST /api/services/appointments/cancel/:orderId
   */
  cancelCustomerAppointment = async (req: Request, res: Response) => {
    try {
      const customerAddress = req.user?.address;
      if (!customerAddress) {
        return res.status(401).json({ success: false, error: 'Customer authentication required' });
      }

      const { orderId } = req.params;

      await this.appointmentRepo.cancelAppointment(orderId, customerAddress);

      res.json({
        success: true,
        message: 'Appointment cancelled successfully'
      });
    } catch (error: unknown) {
      logger.error('Error in cancelCustomerAppointment controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel appointment'
      });
    }
  };

  // ==================== RESCHEDULE ENDPOINTS ====================

  /**
   * Create reschedule request (Customer only)
   * POST /api/services/appointments/reschedule-request
   */
  createRescheduleRequest = async (req: Request, res: Response) => {
    try {
      const customerAddress = req.user?.address;
      if (!customerAddress) {
        return res.status(401).json({ success: false, error: 'Customer authentication required' });
      }

      const { orderId, requestedDate, requestedTimeSlot, reason } = req.body;

      if (!orderId || !requestedDate || !requestedTimeSlot) {
        return res.status(400).json({
          success: false,
          error: 'orderId, requestedDate, and requestedTimeSlot are required'
        });
      }

      const result = await this.rescheduleService.createRescheduleRequest(
        orderId,
        customerAddress,
        requestedDate,
        requestedTimeSlot,
        reason
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          errorCode: result.errorCode
        });
      }

      res.json({
        success: true,
        data: result.request,
        message: 'Reschedule request submitted successfully. The shop will respond within 48 hours.'
      });
    } catch (error: unknown) {
      logger.error('Error in createRescheduleRequest controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create reschedule request'
      });
    }
  };

  /**
   * Cancel reschedule request (Customer only - can only cancel their own pending requests)
   * DELETE /api/services/appointments/reschedule-request/:requestId
   */
  cancelRescheduleRequest = async (req: Request, res: Response) => {
    try {
      const customerAddress = req.user?.address;
      if (!customerAddress) {
        return res.status(401).json({ success: false, error: 'Customer authentication required' });
      }

      const { requestId } = req.params;

      const result = await this.rescheduleService.cancelRescheduleRequest(requestId, customerAddress);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          errorCode: result.errorCode
        });
      }

      res.json({
        success: true,
        message: 'Reschedule request cancelled successfully'
      });
    } catch (error: unknown) {
      logger.error('Error in cancelRescheduleRequest controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel reschedule request'
      });
    }
  };

  /**
   * Get pending reschedule request for an order (Customer only)
   * GET /api/services/appointments/reschedule-request/order/:orderId
   */
  getRescheduleRequestForOrder = async (req: Request, res: Response) => {
    try {
      const customerAddress = req.user?.address;
      if (!customerAddress) {
        return res.status(401).json({ success: false, error: 'Customer authentication required' });
      }

      const { orderId } = req.params;

      const request = await this.rescheduleService.getPendingRequestForOrder(orderId);

      res.json({
        success: true,
        data: {
          hasPendingRequest: !!request,
          request
        }
      });
    } catch (error: unknown) {
      logger.error('Error in getRescheduleRequestForOrder controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get reschedule request'
      });
    }
  };

  /**
   * Get all reschedule requests for shop (Shop only)
   * GET /api/services/appointments/reschedule-requests
   */
  getShopRescheduleRequests = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const { status } = req.query;
      const validStatuses = ['pending', 'approved', 'rejected', 'expired', 'cancelled', 'all'];
      const statusFilter = status && validStatuses.includes(status as string)
        ? (status as 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled' | 'all')
        : undefined;

      const requests = await this.rescheduleService.getShopRescheduleRequests(shopId, statusFilter);
      const pendingCount = await this.rescheduleService.getPendingRequestCount(shopId);

      res.json({
        success: true,
        data: {
          requests,
          pendingCount
        }
      });
    } catch (error: unknown) {
      logger.error('Error in getShopRescheduleRequests controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get reschedule requests'
      });
    }
  };

  /**
   * Get pending reschedule request count for shop (Shop only)
   * GET /api/services/appointments/reschedule-requests/count
   */
  getShopRescheduleRequestCount = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const count = await this.rescheduleService.getPendingRequestCount(shopId);

      res.json({
        success: true,
        data: { count }
      });
    } catch (error: unknown) {
      logger.error('Error in getShopRescheduleRequestCount controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get reschedule request count'
      });
    }
  };

  /**
   * Approve reschedule request (Shop only)
   * POST /api/services/appointments/reschedule-request/:requestId/approve
   */
  approveRescheduleRequest = async (req: Request, res: Response) => {
    try {
      const shopAddress = req.user?.address;
      const shopId = req.user?.shopId;
      if (!shopAddress || !shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const { requestId } = req.params;

      const result = await this.rescheduleService.approveRescheduleRequest(requestId, shopAddress);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          errorCode: result.errorCode
        });
      }

      res.json({
        success: true,
        data: result.request,
        message: 'Reschedule request approved. The appointment has been updated.'
      });
    } catch (error: unknown) {
      logger.error('Error in approveRescheduleRequest controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to approve reschedule request'
      });
    }
  };

  /**
   * Reject reschedule request (Shop only)
   * POST /api/services/appointments/reschedule-request/:requestId/reject
   */
  rejectRescheduleRequest = async (req: Request, res: Response) => {
    try {
      const shopAddress = req.user?.address;
      const shopId = req.user?.shopId;
      if (!shopAddress || !shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const { requestId } = req.params;
      const { reason } = req.body;

      const result = await this.rescheduleService.rejectRescheduleRequest(requestId, shopAddress, reason);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          errorCode: result.errorCode
        });
      }

      res.json({
        success: true,
        data: result.request,
        message: 'Reschedule request rejected.'
      });
    } catch (error: unknown) {
      logger.error('Error in rejectRescheduleRequest controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reject reschedule request'
      });
    }
  };

  /**
   * Direct reschedule by shop (Shop only - no approval needed)
   * POST /api/services/bookings/:orderId/direct-reschedule
   */
  directRescheduleOrder = async (req: Request, res: Response) => {
    try {
      const shopAddress = req.user?.address;
      const shopId = req.user?.shopId;
      if (!shopAddress || !shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const { orderId } = req.params;
      const { newDate, newTimeSlot, reason } = req.body;

      if (!newDate || !newTimeSlot) {
        return res.status(400).json({
          success: false,
          error: 'newDate and newTimeSlot are required'
        });
      }

      const result = await this.rescheduleService.directRescheduleOrder(
        orderId,
        shopId,
        shopAddress,
        newDate,
        newTimeSlot,
        reason
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          errorCode: result.errorCode
        });
      }

      res.json({
        success: true,
        message: 'Appointment rescheduled successfully. Customer has been notified.'
      });
    } catch (error: unknown) {
      logger.error('Error in directRescheduleOrder controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reschedule appointment'
      });
    }
  };
}
