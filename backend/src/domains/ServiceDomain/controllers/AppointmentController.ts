// backend/src/domains/ServiceDomain/controllers/AppointmentController.ts
import { Request, Response } from 'express';
import { AppointmentRepository } from '../../../repositories/AppointmentRepository';
import { AppointmentService } from '../services/AppointmentService';
import { logger } from '../../../utils/logger';

export class AppointmentController {
  private appointmentRepo: AppointmentRepository;
  private appointmentService: AppointmentService;

  constructor() {
    this.appointmentRepo = new AppointmentRepository();
    this.appointmentService = new AppointmentService();
  }

  /**
   * Get available time slots for a service
   * GET /api/services/appointments/available-slots
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

      if (!durationMinutes) {
        return res.status(400).json({ success: false, error: 'durationMinutes is required' });
      }

      const duration = await this.appointmentRepo.updateServiceDuration(serviceId, durationMinutes);

      res.json({
        success: true,
        data: duration
      });
    } catch (error: unknown) {
      logger.error('Error in updateServiceDuration controller:', error);
      res.status(400).json({
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
}
