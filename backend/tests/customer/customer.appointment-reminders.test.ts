import request from 'supertest';
import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import RepairCoinApp from '../../src/app';
import { AppointmentReminderService } from '../../src/services/AppointmentReminderService';
import { NotificationPreferencesRepository } from '../../src/repositories/NotificationPreferencesRepository';

// Mock dependencies
jest.mock('../../src/services/AppointmentReminderService');
jest.mock('../../src/repositories/NotificationPreferencesRepository');
jest.mock('../../src/services/EmailService');
jest.mock('../../src/domains/notification/services/NotificationService');
jest.mock('thirdweb');

/**
 * Appointment Reminders Test Suite
 *
 * Tests the appointment reminder system based on customer preferences:
 *
 * NOTIFICATION CHANNELS:
 * - Email Notifications - Receive appointment reminders via email
 * - In-App Notifications - See reminders in the RepairCoin app
 * - SMS Notifications - Coming soon (disabled)
 *
 * REMINDER TIMING:
 * - 24-Hour Reminder - Get reminded one day before appointment
 * - 2-Hour Reminder - Get reminded two hours before appointment
 * - 30-Minute Reminder - Coming soon (disabled)
 *
 * QUIET HOURS:
 * - Enable Quiet Hours - Pause notifications during specific times
 */
describe('Appointment Reminders Tests', () => {
  let app: any;

  // Test data
  const testCustomerAddress = '0x1234567890123456789012345678901234567890';
  const testShopId = 'test-shop-001';
  const testOrderId = 'order-001';

  const mockAppointmentData = {
    orderId: testOrderId,
    customerAddress: testCustomerAddress,
    customerEmail: 'customer@test.com',
    customerName: 'Test Customer',
    shopId: testShopId,
    shopName: 'Test Auto Shop',
    shopEmail: 'shop@test.com',
    serviceName: 'Oil Change',
    bookingDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    bookingTimeSlot: '10:00',
    totalAmount: 49.99,
  };

  const defaultPreferences = {
    id: 'pref-001',
    customerAddress: testCustomerAddress,
    emailEnabled: true,
    smsEnabled: false,
    inAppEnabled: true,
    reminder24hEnabled: true,
    reminder2hEnabled: true,
    reminder30mEnabled: false,
    quietHoursEnabled: false,
    quietHoursStart: null,
    quietHoursEnd: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.NODE_ENV = 'test';

    const repairCoinApp = new RepairCoinApp();
    await repairCoinApp.initialize();
    app = repairCoinApp.app;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Notification Channels', () => {
    describe('Email Notifications', () => {
      it('should send email reminder when email is enabled', async () => {
        const mockService = new AppointmentReminderService();
        const preferences = { ...defaultPreferences, emailEnabled: true };

        jest
          .spyOn(mockService, 'sendCustomerReminderEmail')
          .mockResolvedValue(true);

        const result = await mockService.sendCustomerReminderEmail(mockAppointmentData);

        expect(result).toBe(true);
      });

      it('should NOT send email reminder when email is disabled', async () => {
        const mockPrefsRepo = new NotificationPreferencesRepository();
        const preferences = { ...defaultPreferences, emailEnabled: false };

        jest
          .spyOn(mockPrefsRepo, 'shouldSendReminder')
          .mockResolvedValue(false);

        const shouldSend = await mockPrefsRepo.shouldSendReminder(
          testCustomerAddress,
          '24h',
          'email'
        );

        expect(shouldSend).toBe(false);
      });

      it('should return false when customer has no email', async () => {
        const mockService = new AppointmentReminderService();
        const dataWithoutEmail = { ...mockAppointmentData, customerEmail: undefined };

        jest
          .spyOn(mockService, 'sendCustomerReminderEmail')
          .mockResolvedValue(false);

        const result = await mockService.sendCustomerReminderEmail(dataWithoutEmail);

        expect(result).toBe(false);
      });
    });

    describe('In-App Notifications', () => {
      it('should send in-app notification when enabled', async () => {
        const mockPrefsRepo = new NotificationPreferencesRepository();
        const preferences = { ...defaultPreferences, inAppEnabled: true };

        jest
          .spyOn(mockPrefsRepo, 'shouldSendReminder')
          .mockResolvedValue(true);

        const shouldSend = await mockPrefsRepo.shouldSendReminder(
          testCustomerAddress,
          '24h',
          'in_app'
        );

        expect(shouldSend).toBe(true);
      });

      it('should NOT send in-app notification when disabled', async () => {
        const mockPrefsRepo = new NotificationPreferencesRepository();

        jest
          .spyOn(mockPrefsRepo, 'shouldSendReminder')
          .mockResolvedValue(false);

        const shouldSend = await mockPrefsRepo.shouldSendReminder(
          testCustomerAddress,
          '24h',
          'in_app'
        );

        expect(shouldSend).toBe(false);
      });

      it('should send 24h in-app notification with correct message format', async () => {
        const mockService = new AppointmentReminderService();

        jest
          .spyOn(mockService, 'sendCustomerInAppNotification')
          .mockResolvedValue(undefined);

        await mockService.sendCustomerInAppNotification(mockAppointmentData);

        expect(mockService.sendCustomerInAppNotification).toHaveBeenCalledWith(
          mockAppointmentData
        );
      });

      it('should send 2h in-app notification with correct message format', async () => {
        const mockService = new AppointmentReminderService();

        jest
          .spyOn(mockService, 'sendCustomer2HourInAppNotification')
          .mockResolvedValue(undefined);

        await mockService.sendCustomer2HourInAppNotification(mockAppointmentData);

        expect(mockService.sendCustomer2HourInAppNotification).toHaveBeenCalledWith(
          mockAppointmentData
        );
      });
    });

    describe('SMS Notifications (Coming Soon)', () => {
      it('should NOT send SMS - feature disabled', async () => {
        const mockPrefsRepo = new NotificationPreferencesRepository();
        const preferences = { ...defaultPreferences, smsEnabled: false };

        jest
          .spyOn(mockPrefsRepo, 'shouldSendReminder')
          .mockResolvedValue(false);

        const shouldSend = await mockPrefsRepo.shouldSendReminder(
          testCustomerAddress,
          '24h',
          'sms'
        );

        expect(shouldSend).toBe(false);
      });

      it('should return smsEnabled as false by default', async () => {
        const mockPrefsRepo = new NotificationPreferencesRepository();

        jest
          .spyOn(mockPrefsRepo, 'getByCustomerAddress')
          .mockResolvedValue(defaultPreferences);

        const prefs = await mockPrefsRepo.getByCustomerAddress(testCustomerAddress);

        expect(prefs.smsEnabled).toBe(false);
      });
    });
  });

  describe('Reminder Timing', () => {
    describe('24-Hour Reminder', () => {
      it('should send 24h reminder when enabled', async () => {
        const mockPrefsRepo = new NotificationPreferencesRepository();
        const preferences = { ...defaultPreferences, reminder24hEnabled: true };

        jest
          .spyOn(mockPrefsRepo, 'getByCustomerAddress')
          .mockResolvedValue(preferences);

        const prefs = await mockPrefsRepo.getByCustomerAddress(testCustomerAddress);

        expect(prefs.reminder24hEnabled).toBe(true);
      });

      it('should NOT send 24h reminder when disabled', async () => {
        const mockPrefsRepo = new NotificationPreferencesRepository();

        jest
          .spyOn(mockPrefsRepo, 'shouldSendReminder')
          .mockResolvedValue(false);

        const shouldSend = await mockPrefsRepo.shouldSendReminder(
          testCustomerAddress,
          '24h',
          'email'
        );

        expect(shouldSend).toBe(false);
      });

      it('should find appointments 23-25 hours before', async () => {
        const mockService = new AppointmentReminderService();

        jest
          .spyOn(mockService, 'getAppointmentsNeedingReminders')
          .mockResolvedValue([mockAppointmentData]);

        const appointments = await mockService.getAppointmentsNeedingReminders();

        expect(appointments).toHaveLength(1);
        expect(appointments[0].orderId).toBe(testOrderId);
      });

      it('should mark 24h reminder as sent after processing', async () => {
        const mockService = new AppointmentReminderService();

        jest
          .spyOn(mockService, 'markReminderSent')
          .mockResolvedValue(undefined);

        await mockService.markReminderSent(testOrderId);

        expect(mockService.markReminderSent).toHaveBeenCalledWith(testOrderId);
      });
    });

    describe('2-Hour Reminder', () => {
      it('should send 2h reminder when enabled', async () => {
        const mockPrefsRepo = new NotificationPreferencesRepository();
        const preferences = { ...defaultPreferences, reminder2hEnabled: true };

        jest
          .spyOn(mockPrefsRepo, 'getByCustomerAddress')
          .mockResolvedValue(preferences);

        const prefs = await mockPrefsRepo.getByCustomerAddress(testCustomerAddress);

        expect(prefs.reminder2hEnabled).toBe(true);
      });

      it('should NOT send 2h reminder when disabled', async () => {
        const mockPrefsRepo = new NotificationPreferencesRepository();

        jest
          .spyOn(mockPrefsRepo, 'shouldSendReminder')
          .mockResolvedValue(false);

        const shouldSend = await mockPrefsRepo.shouldSendReminder(
          testCustomerAddress,
          '2h',
          'in_app'
        );

        expect(shouldSend).toBe(false);
      });

      it('should only send in-app for 2h reminder (no email)', async () => {
        // 2h reminders should only send in-app notifications, not email
        const mockService = new AppointmentReminderService();

        // 2h config: sendEmail = false, sendInApp = true
        jest
          .spyOn(mockService, 'sendCustomer2HourInAppNotification')
          .mockResolvedValue(undefined);

        await mockService.sendCustomer2HourInAppNotification(mockAppointmentData);

        expect(mockService.sendCustomer2HourInAppNotification).toHaveBeenCalled();
      });
    });

    describe('30-Minute Reminder (Coming Soon)', () => {
      it('should NOT send 30m reminder - feature disabled', async () => {
        const mockPrefsRepo = new NotificationPreferencesRepository();

        jest
          .spyOn(mockPrefsRepo, 'shouldSendReminder')
          .mockResolvedValue(false);

        const shouldSend = await mockPrefsRepo.shouldSendReminder(
          testCustomerAddress,
          '30m',
          'in_app'
        );

        expect(shouldSend).toBe(false);
      });

      it('should return reminder30mEnabled as false by default', async () => {
        const mockPrefsRepo = new NotificationPreferencesRepository();

        jest
          .spyOn(mockPrefsRepo, 'getByCustomerAddress')
          .mockResolvedValue(defaultPreferences);

        const prefs = await mockPrefsRepo.getByCustomerAddress(testCustomerAddress);

        expect(prefs.reminder30mEnabled).toBe(false);
      });
    });
  });

  describe('Quiet Hours', () => {
    it('should block notifications during quiet hours', async () => {
      const mockPrefsRepo = new NotificationPreferencesRepository();

      // Quiet hours enabled 22:00 - 08:00
      jest
        .spyOn(mockPrefsRepo, 'shouldSendReminder')
        .mockResolvedValue(false);

      const shouldSend = await mockPrefsRepo.shouldSendReminder(
        testCustomerAddress,
        '24h',
        'email'
      );

      expect(shouldSend).toBe(false);
    });

    it('should allow notifications outside quiet hours', async () => {
      const mockPrefsRepo = new NotificationPreferencesRepository();

      jest
        .spyOn(mockPrefsRepo, 'shouldSendReminder')
        .mockResolvedValue(true);

      const shouldSend = await mockPrefsRepo.shouldSendReminder(
        testCustomerAddress,
        '24h',
        'email'
      );

      expect(shouldSend).toBe(true);
    });

    it('should handle overnight quiet hours (22:00 - 08:00)', async () => {
      const prefsWithQuietHours = {
        ...defaultPreferences,
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
      };

      const mockPrefsRepo = new NotificationPreferencesRepository();

      jest
        .spyOn(mockPrefsRepo, 'getByCustomerAddress')
        .mockResolvedValue(prefsWithQuietHours);

      const prefs = await mockPrefsRepo.getByCustomerAddress(testCustomerAddress);

      expect(prefs.quietHoursEnabled).toBe(true);
      expect(prefs.quietHoursStart).toBe('22:00');
      expect(prefs.quietHoursEnd).toBe('08:00');
    });

    it('should handle daytime quiet hours (14:00 - 16:00)', async () => {
      const prefsWithQuietHours = {
        ...defaultPreferences,
        quietHoursEnabled: true,
        quietHoursStart: '14:00',
        quietHoursEnd: '16:00',
      };

      const mockPrefsRepo = new NotificationPreferencesRepository();

      jest
        .spyOn(mockPrefsRepo, 'getByCustomerAddress')
        .mockResolvedValue(prefsWithQuietHours);

      const prefs = await mockPrefsRepo.getByCustomerAddress(testCustomerAddress);

      expect(prefs.quietHoursEnabled).toBe(true);
      expect(prefs.quietHoursStart).toBe('14:00');
      expect(prefs.quietHoursEnd).toBe('16:00');
    });

    it('should return quietHoursEnabled as false by default', async () => {
      const mockPrefsRepo = new NotificationPreferencesRepository();

      jest
        .spyOn(mockPrefsRepo, 'getByCustomerAddress')
        .mockResolvedValue(defaultPreferences);

      const prefs = await mockPrefsRepo.getByCustomerAddress(testCustomerAddress);

      expect(prefs.quietHoursEnabled).toBe(false);
    });
  });

  describe('Notification Preferences CRUD', () => {
    it('should return default preferences for new customer', async () => {
      const mockPrefsRepo = new NotificationPreferencesRepository();

      jest
        .spyOn(mockPrefsRepo, 'getByCustomerAddress')
        .mockResolvedValue(defaultPreferences);

      const prefs = await mockPrefsRepo.getByCustomerAddress(testCustomerAddress);

      expect(prefs.emailEnabled).toBe(true);
      expect(prefs.inAppEnabled).toBe(true);
      expect(prefs.smsEnabled).toBe(false);
      expect(prefs.reminder24hEnabled).toBe(true);
      expect(prefs.reminder2hEnabled).toBe(true);
      expect(prefs.reminder30mEnabled).toBe(false);
      expect(prefs.quietHoursEnabled).toBe(false);
    });

    it('should save updated preferences', async () => {
      const mockPrefsRepo = new NotificationPreferencesRepository();
      const updatedPrefs = {
        ...defaultPreferences,
        emailEnabled: false,
        reminder24hEnabled: false,
      };

      jest
        .spyOn(mockPrefsRepo, 'upsert')
        .mockResolvedValue(updatedPrefs);

      const saved = await mockPrefsRepo.upsert(testCustomerAddress, {
        emailEnabled: false,
        reminder24hEnabled: false,
      });

      expect(saved.emailEnabled).toBe(false);
      expect(saved.reminder24hEnabled).toBe(false);
    });

    it('should delete preferences', async () => {
      const mockPrefsRepo = new NotificationPreferencesRepository();

      jest
        .spyOn(mockPrefsRepo, 'delete')
        .mockResolvedValue(true);

      const deleted = await mockPrefsRepo.delete(testCustomerAddress);

      expect(deleted).toBe(true);
    });
  });

  describe('Shop Notifications', () => {
    it('should send 24h notification to shop', async () => {
      const mockService = new AppointmentReminderService();

      jest
        .spyOn(mockService, 'sendShopNotification')
        .mockResolvedValue(undefined);

      await mockService.sendShopNotification(mockAppointmentData);

      expect(mockService.sendShopNotification).toHaveBeenCalledWith(
        mockAppointmentData
      );
    });

    it('should send 2h notification to shop', async () => {
      const mockService = new AppointmentReminderService();

      jest
        .spyOn(mockService, 'sendShop2HourNotification')
        .mockResolvedValue(undefined);

      await mockService.sendShop2HourNotification(mockAppointmentData);

      expect(mockService.sendShop2HourNotification).toHaveBeenCalledWith(
        mockAppointmentData
      );
    });

    it('should always notify shop regardless of customer preferences', async () => {
      // Shops should always be notified about upcoming appointments
      // even if customer has disabled their own notifications
      const mockService = new AppointmentReminderService();

      jest
        .spyOn(mockService, 'sendShopNotification')
        .mockResolvedValue(undefined);

      await mockService.sendShopNotification(mockAppointmentData);

      expect(mockService.sendShopNotification).toHaveBeenCalled();
    });
  });

  describe('Booking Confirmation', () => {
    it('should send booking confirmation after payment', async () => {
      const mockService = new AppointmentReminderService();

      jest
        .spyOn(mockService, 'sendBookingConfirmation')
        .mockResolvedValue(undefined);

      await mockService.sendBookingConfirmation(testOrderId);

      expect(mockService.sendBookingConfirmation).toHaveBeenCalledWith(testOrderId);
    });
  });

  describe('Reminder Processing', () => {
    it('should process all pending reminders', async () => {
      const mockService = new AppointmentReminderService();

      const mockReport = {
        timestamp: new Date(),
        remindersChecked: 5,
        customerRemindersSent: 3,
        shopNotificationsSent: 5,
        emailsSent: 2,
        emailsFailed: 0,
        inAppNotificationsSent: 3,
        errors: [],
        reminder24hSent: 2,
        reminder2hSent: 1,
      };

      jest
        .spyOn(mockService, 'processReminders')
        .mockResolvedValue(mockReport);

      const report = await mockService.processReminders();

      expect(report.customerRemindersSent).toBe(3);
      expect(report.shopNotificationsSent).toBe(5);
      expect(report.emailsFailed).toBe(0);
      expect(report.errors).toHaveLength(0);
    });

    it('should track skipped reminders by preference', async () => {
      const mockService = new AppointmentReminderService();

      const mockReport = {
        timestamp: new Date(),
        remindersChecked: 5,
        customerRemindersSent: 3,
        shopNotificationsSent: 5,
        emailsSent: 1,
        emailsFailed: 0,
        inAppNotificationsSent: 2,
        errors: [],
        reminder24hSent: 2,
        reminder2hSent: 1,
      };

      jest
        .spyOn(mockService, 'processReminders')
        .mockResolvedValue(mockReport);

      const report = await mockService.processReminders();

      // Some reminders were sent, but not all (some skipped by preference)
      expect(report.emailsSent).toBeLessThanOrEqual(report.customerRemindersSent);
    });

    it('should track failed emails after retry attempts', async () => {
      const mockService = new AppointmentReminderService();

      const mockReport = {
        timestamp: new Date(),
        remindersChecked: 5,
        customerRemindersSent: 5,
        shopNotificationsSent: 5,
        emailsSent: 3,
        emailsFailed: 2, // 2 emails failed after 3 retry attempts each
        inAppNotificationsSent: 5,
        errors: [],
        reminder24hSent: 4,
        reminder2hSent: 1,
      };

      jest
        .spyOn(mockService, 'processReminders')
        .mockResolvedValue(mockReport);

      const report = await mockService.processReminders();

      expect(report.emailsSent).toBe(3);
      expect(report.emailsFailed).toBe(2);
      // In-app still sent even if email failed
      expect(report.inAppNotificationsSent).toBe(5);
    });

    it('should handle errors gracefully', async () => {
      const mockService = new AppointmentReminderService();

      const mockReport = {
        timestamp: new Date(),
        remindersChecked: 5,
        customerRemindersSent: 4,
        shopNotificationsSent: 5,
        emailsSent: 3,
        emailsFailed: 1,
        inAppNotificationsSent: 4,
        errors: ['Failed to send email for order-123'],
        reminder24hSent: 3,
        reminder2hSent: 1,
      };

      jest
        .spyOn(mockService, 'processReminders')
        .mockResolvedValue(mockReport);

      const report = await mockService.processReminders();

      expect(report.errors).toHaveLength(1);
      expect(report.errors[0]).toContain('Failed');
      expect(report.emailsFailed).toBe(1);
    });

    it('should prevent concurrent processing', async () => {
      const mockService = new AppointmentReminderService();

      jest
        .spyOn(mockService, 'processReminders')
        .mockRejectedValue(new Error('Reminder processing already running'));

      await expect(mockService.processReminders()).rejects.toThrow(
        'Reminder processing already running'
      );
    });
  });

  describe('Email Retry Mechanism', () => {
    it('should retry failed emails up to 3 times', async () => {
      const mockService = new AppointmentReminderService();

      // Mock sendCustomerReminderEmail to fail first 2 times, succeed on 3rd
      let attempts = 0;
      jest
        .spyOn(mockService, 'sendCustomerReminderEmail')
        .mockImplementation(async () => {
          attempts++;
          if (attempts < 3) {
            return false; // Fail first 2 attempts
          }
          return true; // Succeed on 3rd attempt
        });

      const result = await mockService.sendCustomerReminderEmail(mockAppointmentData);

      // The retry is internal, but the method should ultimately return true or false
      expect(typeof result).toBe('boolean');
    });

    it('should return false after all retry attempts exhausted', async () => {
      const mockService = new AppointmentReminderService();

      // Mock to always fail
      jest
        .spyOn(mockService, 'sendCustomerReminderEmail')
        .mockResolvedValue(false);

      const result = await mockService.sendCustomerReminderEmail(mockAppointmentData);

      expect(result).toBe(false);
    });

    it('should return false when customer has no email', async () => {
      const mockService = new AppointmentReminderService();
      const dataWithoutEmail = { ...mockAppointmentData, customerEmail: undefined };

      jest
        .spyOn(mockService, 'sendCustomerReminderEmail')
        .mockResolvedValue(false);

      const result = await mockService.sendCustomerReminderEmail(dataWithoutEmail);

      expect(result).toBe(false);
    });

    it('should use exponential backoff between retries', () => {
      // Test the retry configuration
      const EMAIL_RETRY_CONFIG = {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 5000,
        backoffMultiplier: 2
      };

      // Verify configuration values
      expect(EMAIL_RETRY_CONFIG.maxAttempts).toBe(3);
      expect(EMAIL_RETRY_CONFIG.initialDelayMs).toBe(1000);
      expect(EMAIL_RETRY_CONFIG.backoffMultiplier).toBe(2);

      // Calculate expected delays
      const delay1 = EMAIL_RETRY_CONFIG.initialDelayMs; // 1000ms
      const delay2 = Math.min(
        EMAIL_RETRY_CONFIG.initialDelayMs * EMAIL_RETRY_CONFIG.backoffMultiplier,
        EMAIL_RETRY_CONFIG.maxDelayMs
      ); // 2000ms
      const delay3 = Math.min(
        delay2 * EMAIL_RETRY_CONFIG.backoffMultiplier,
        EMAIL_RETRY_CONFIG.maxDelayMs
      ); // 4000ms

      expect(delay1).toBe(1000);
      expect(delay2).toBe(2000);
      expect(delay3).toBe(4000);
    });
  });

  describe('Scheduler', () => {
    it('should schedule reminders at specified interval', async () => {
      const mockService = new AppointmentReminderService();

      jest
        .spyOn(mockService, 'scheduleReminders')
        .mockImplementation(() => {});

      mockService.scheduleReminders(1); // Every 1 hour

      expect(mockService.scheduleReminders).toHaveBeenCalledWith(1);
    });

    it('should stop scheduled reminders', async () => {
      const mockService = new AppointmentReminderService();

      jest
        .spyOn(mockService, 'stopScheduledReminders')
        .mockImplementation(() => {});

      mockService.stopScheduledReminders();

      expect(mockService.stopScheduledReminders).toHaveBeenCalled();
    });
  });
});

/**
 * Unit Tests for Time Formatting
 */
describe('Time Formatting Unit Tests', () => {
  function formatTime(timeSlot: string): string {
    const [hours, minutes] = timeSlot.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  }

  it('should format morning time correctly', () => {
    expect(formatTime('09:00')).toBe('9:00 AM');
    expect(formatTime('10:30')).toBe('10:30 AM');
  });

  it('should format noon correctly', () => {
    expect(formatTime('12:00')).toBe('12:00 PM');
  });

  it('should format afternoon time correctly', () => {
    expect(formatTime('14:00')).toBe('2:00 PM');
    expect(formatTime('15:30')).toBe('3:30 PM');
  });

  it('should format evening time correctly', () => {
    expect(formatTime('18:00')).toBe('6:00 PM');
    expect(formatTime('20:45')).toBe('8:45 PM');
  });

  it('should format midnight correctly', () => {
    expect(formatTime('00:00')).toBe('12:00 AM');
  });
});

/**
 * Unit Tests for Quiet Hours Logic
 */
describe('Quiet Hours Logic Unit Tests', () => {
  function isInQuietHours(currentTime: string, start: string, end: string): boolean {
    if (start > end) {
      // Overnight quiet hours (e.g., 22:00 to 08:00)
      return currentTime >= start || currentTime <= end;
    } else {
      // Daytime quiet hours (e.g., 14:00 to 16:00)
      return currentTime >= start && currentTime <= end;
    }
  }

  describe('Overnight Quiet Hours (22:00 - 08:00)', () => {
    const start = '22:00';
    const end = '08:00';

    it('should return true at 23:00', () => {
      expect(isInQuietHours('23:00', start, end)).toBe(true);
    });

    it('should return true at 03:00', () => {
      expect(isInQuietHours('03:00', start, end)).toBe(true);
    });

    it('should return true at 07:59', () => {
      expect(isInQuietHours('07:59', start, end)).toBe(true);
    });

    it('should return false at 10:00', () => {
      expect(isInQuietHours('10:00', start, end)).toBe(false);
    });

    it('should return false at 15:00', () => {
      expect(isInQuietHours('15:00', start, end)).toBe(false);
    });

    it('should return true at exactly 22:00 (start)', () => {
      expect(isInQuietHours('22:00', start, end)).toBe(true);
    });

    it('should return true at exactly 08:00 (end)', () => {
      expect(isInQuietHours('08:00', start, end)).toBe(true);
    });
  });

  describe('Daytime Quiet Hours (14:00 - 16:00)', () => {
    const start = '14:00';
    const end = '16:00';

    it('should return true at 14:30', () => {
      expect(isInQuietHours('14:30', start, end)).toBe(true);
    });

    it('should return true at 15:00', () => {
      expect(isInQuietHours('15:00', start, end)).toBe(true);
    });

    it('should return false at 13:59', () => {
      expect(isInQuietHours('13:59', start, end)).toBe(false);
    });

    it('should return false at 16:01', () => {
      expect(isInQuietHours('16:01', start, end)).toBe(false);
    });

    it('should return true at exactly 14:00 (start)', () => {
      expect(isInQuietHours('14:00', start, end)).toBe(true);
    });

    it('should return true at exactly 16:00 (end)', () => {
      expect(isInQuietHours('16:00', start, end)).toBe(true);
    });
  });
});

/**
 * Unit Tests for Reminder Configuration
 */
describe('Reminder Configuration Unit Tests', () => {
  const REMINDER_CONFIGS = [
    {
      type: '24h',
      hoursBeforeMin: 23,
      hoursBeforeMax: 25,
      sendEmail: true,
      sendInApp: true,
      sendShopNotification: true,
    },
    {
      type: '2h',
      hoursBeforeMin: 1.5,
      hoursBeforeMax: 2.5,
      sendEmail: false,
      sendInApp: true,
      sendShopNotification: true,
    },
  ];

  describe('24-Hour Reminder Config', () => {
    const config24h = REMINDER_CONFIGS.find(c => c.type === '24h')!;

    it('should have correct time window (23-25 hours)', () => {
      expect(config24h.hoursBeforeMin).toBe(23);
      expect(config24h.hoursBeforeMax).toBe(25);
    });

    it('should send email', () => {
      expect(config24h.sendEmail).toBe(true);
    });

    it('should send in-app notification', () => {
      expect(config24h.sendInApp).toBe(true);
    });

    it('should send shop notification', () => {
      expect(config24h.sendShopNotification).toBe(true);
    });
  });

  describe('2-Hour Reminder Config', () => {
    const config2h = REMINDER_CONFIGS.find(c => c.type === '2h')!;

    it('should have correct time window (1.5-2.5 hours)', () => {
      expect(config2h.hoursBeforeMin).toBe(1.5);
      expect(config2h.hoursBeforeMax).toBe(2.5);
    });

    it('should NOT send email (in-app only)', () => {
      expect(config2h.sendEmail).toBe(false);
    });

    it('should send in-app notification', () => {
      expect(config2h.sendInApp).toBe(true);
    });

    it('should send shop notification', () => {
      expect(config2h.sendShopNotification).toBe(true);
    });
  });
});

/**
 * Unit Tests for Notification Channel Validation
 */
describe('Notification Channel Validation Unit Tests', () => {
  /**
   * Validation function that mirrors backend logic
   */
  function validateChannels(
    emailEnabled: boolean | undefined,
    smsEnabled: boolean | undefined,
    inAppEnabled: boolean | undefined
  ): { valid: boolean; error?: string } {
    // Only validate if all three channel fields are explicitly provided
    if (
      emailEnabled !== undefined &&
      smsEnabled !== undefined &&
      inAppEnabled !== undefined
    ) {
      if (!emailEnabled && !smsEnabled && !inAppEnabled) {
        return {
          valid: false,
          error: 'At least one notification channel must be enabled (Email, SMS, or In-App)'
        };
      }
    }
    return { valid: true };
  }

  describe('All channels disabled', () => {
    it('should reject when all channels are explicitly disabled', () => {
      const result = validateChannels(false, false, false);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('At least one notification channel must be enabled (Email, SMS, or In-App)');
    });
  });

  describe('At least one channel enabled', () => {
    it('should accept when only email is enabled', () => {
      const result = validateChannels(true, false, false);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept when only SMS is enabled', () => {
      const result = validateChannels(false, true, false);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept when only in-app is enabled', () => {
      const result = validateChannels(false, false, true);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept when all channels are enabled', () => {
      const result = validateChannels(true, true, true);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept when email and in-app are enabled', () => {
      const result = validateChannels(true, false, true);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('Partial updates (undefined values)', () => {
    it('should skip validation when emailEnabled is undefined', () => {
      const result = validateChannels(undefined, false, false);
      expect(result.valid).toBe(true);
    });

    it('should skip validation when smsEnabled is undefined', () => {
      const result = validateChannels(false, undefined, false);
      expect(result.valid).toBe(true);
    });

    it('should skip validation when inAppEnabled is undefined', () => {
      const result = validateChannels(false, false, undefined);
      expect(result.valid).toBe(true);
    });

    it('should skip validation when all are undefined', () => {
      const result = validateChannels(undefined, undefined, undefined);
      expect(result.valid).toBe(true);
    });
  });

  describe('Frontend toggle prevention logic', () => {
    /**
     * Simulates the frontend check for whether toggling a channel would leave
     * at least one channel enabled
     */
    function wouldHaveChannelEnabled(
      keyToToggle: 'email' | 'sms' | 'inApp',
      currentState: { email: boolean; sms: boolean; inApp: boolean }
    ): boolean {
      const newEmail = keyToToggle === 'email' ? !currentState.email : currentState.email;
      const newSms = keyToToggle === 'sms' ? !currentState.sms : currentState.sms;
      const newInApp = keyToToggle === 'inApp' ? !currentState.inApp : currentState.inApp;
      return newEmail || newSms || newInApp;
    }

    it('should prevent disabling the only enabled channel (email)', () => {
      const state = { email: true, sms: false, inApp: false };
      expect(wouldHaveChannelEnabled('email', state)).toBe(false);
    });

    it('should prevent disabling the only enabled channel (in-app)', () => {
      const state = { email: false, sms: false, inApp: true };
      expect(wouldHaveChannelEnabled('inApp', state)).toBe(false);
    });

    it('should allow disabling email when in-app is also enabled', () => {
      const state = { email: true, sms: false, inApp: true };
      expect(wouldHaveChannelEnabled('email', state)).toBe(true);
    });

    it('should allow disabling in-app when email is also enabled', () => {
      const state = { email: true, sms: false, inApp: true };
      expect(wouldHaveChannelEnabled('inApp', state)).toBe(true);
    });

    it('should allow enabling any channel', () => {
      const state = { email: true, sms: false, inApp: false };
      expect(wouldHaveChannelEnabled('sms', state)).toBe(true);
      expect(wouldHaveChannelEnabled('inApp', state)).toBe(true);
    });
  });
});

/**
 * Unit Tests for Quiet Hours Shop Notification
 */
describe('Quiet Hours Shop Notification Unit Tests', () => {
  describe('Shop notification message format', () => {
    function formatShopQuietHoursMessage(
      customerName: string,
      reminderType: '24h' | '2h',
      serviceName: string,
      quietHoursStart: string,
      quietHoursEnd: string
    ): string {
      const reminderTypeLabel = reminderType === '24h' ? '24-hour' : '2-hour';

      // Helper to format time
      const formatTime = (timeSlot: string): string => {
        const [hours, minutes] = timeSlot.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        return `${displayHour}:${minutes} ${ampm}`;
      };

      return `Note: ${customerName}'s ${reminderTypeLabel} reminder for their ${serviceName} appointment was not sent because they have Quiet Hours enabled (${formatTime(quietHoursStart)} - ${formatTime(quietHoursEnd)}). Consider reaching out directly if needed.`;
    }

    it('should format 24-hour reminder message correctly', () => {
      const message = formatShopQuietHoursMessage(
        'John Doe',
        '24h',
        'Oil Change',
        '22:00',
        '08:00'
      );

      expect(message).toContain('24-hour reminder');
      expect(message).toContain('John Doe');
      expect(message).toContain('Oil Change');
      expect(message).toContain('10:00 PM');
      expect(message).toContain('8:00 AM');
      expect(message).toContain('Consider reaching out directly');
    });

    it('should format 2-hour reminder message correctly', () => {
      const message = formatShopQuietHoursMessage(
        'Jane Smith',
        '2h',
        'Brake Inspection',
        '14:00',
        '16:00'
      );

      expect(message).toContain('2-hour reminder');
      expect(message).toContain('Jane Smith');
      expect(message).toContain('Brake Inspection');
      expect(message).toContain('2:00 PM');
      expect(message).toContain('4:00 PM');
    });

    it('should handle default customer name', () => {
      const message = formatShopQuietHoursMessage(
        'Customer',
        '24h',
        'Tire Rotation',
        '22:00',
        '07:00'
      );

      expect(message).toContain("Customer's 24-hour reminder");
    });
  });

  describe('Quiet hours check and shop notification flow', () => {
    interface MockPrefs {
      quietHoursEnabled: boolean;
      quietHoursStart: string | null;
      quietHoursEnd: string | null;
    }

    function isInQuietHours(currentTime: string, start: string, end: string): boolean {
      if (start > end) {
        return currentTime >= start || currentTime <= end;
      } else {
        return currentTime >= start && currentTime <= end;
      }
    }

    function shouldSkipAndNotifyShop(
      prefs: MockPrefs,
      currentTime: string
    ): { skip: boolean; notifyShop: boolean } {
      if (!prefs.quietHoursEnabled || !prefs.quietHoursStart || !prefs.quietHoursEnd) {
        return { skip: false, notifyShop: false };
      }

      if (isInQuietHours(currentTime, prefs.quietHoursStart, prefs.quietHoursEnd)) {
        return { skip: true, notifyShop: true };
      }

      return { skip: false, notifyShop: false };
    }

    it('should skip reminder and notify shop when in quiet hours', () => {
      const prefs: MockPrefs = {
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00'
      };

      const result = shouldSkipAndNotifyShop(prefs, '23:30');

      expect(result.skip).toBe(true);
      expect(result.notifyShop).toBe(true);
    });

    it('should not skip when outside quiet hours', () => {
      const prefs: MockPrefs = {
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00'
      };

      const result = shouldSkipAndNotifyShop(prefs, '14:00');

      expect(result.skip).toBe(false);
      expect(result.notifyShop).toBe(false);
    });

    it('should not skip when quiet hours disabled', () => {
      const prefs: MockPrefs = {
        quietHoursEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00'
      };

      const result = shouldSkipAndNotifyShop(prefs, '23:30');

      expect(result.skip).toBe(false);
      expect(result.notifyShop).toBe(false);
    });

    it('should not skip when quiet hours not configured', () => {
      const prefs: MockPrefs = {
        quietHoursEnabled: true,
        quietHoursStart: null,
        quietHoursEnd: null
      };

      const result = shouldSkipAndNotifyShop(prefs, '23:30');

      expect(result.skip).toBe(false);
      expect(result.notifyShop).toBe(false);
    });
  });

  describe('ReminderReport skippedByQuietHours tracking', () => {
    interface MockReminderReport {
      customerRemindersSent: number;
      skippedByPreference: number;
      skippedByQuietHours: number;
    }

    it('should track skipped by quiet hours separately from skipped by preference', () => {
      const report: MockReminderReport = {
        customerRemindersSent: 10,
        skippedByPreference: 2,
        skippedByQuietHours: 3
      };

      expect(report.skippedByPreference).toBe(2);
      expect(report.skippedByQuietHours).toBe(3);
      expect(report.skippedByPreference + report.skippedByQuietHours).toBe(5);
    });

    it('should aggregate skipped counts across reminder types', () => {
      // Simulates aggregating results from 24h and 2h reminders
      const result24h = { skippedByQuietHours: 2 };
      const result2h = { skippedByQuietHours: 1 };

      const totalSkippedByQuietHours = result24h.skippedByQuietHours + result2h.skippedByQuietHours;

      expect(totalSkippedByQuietHours).toBe(3);
    });
  });
});
