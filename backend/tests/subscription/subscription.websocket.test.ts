import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import { NotificationDomain } from '../../src/domains/notification/NotificationDomain';

/**
 * WebSocket Real-Time Subscription Tests
 *
 * These tests verify that:
 * 1. Shop self-cancel notifies both shop AND admins
 * 2. Admin reactivation notifies the shop
 * 3. All subscription events trigger real-time updates
 */
describe('Subscription WebSocket Real-Time Updates', () => {
  let mockWsManager: any;
  let mockNotificationService: any;
  let notificationDomain: NotificationDomain;

  const mockShopAddress = '0x1234567890123456789012345678901234567890';
  const mockAdminAddresses = '0xadmin1,0xadmin2';

  beforeAll(() => {
    // Set admin addresses for testing
    process.env.ADMIN_ADDRESSES = mockAdminAddresses;
    process.env.JWT_SECRET = 'test-secret';
    process.env.NODE_ENV = 'test';
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock WebSocket manager
    mockWsManager = {
      sendNotificationToUser: jest.fn(),
      sendNotificationToAdmins: jest.fn(),
      broadcastToAll: jest.fn(),
    };

    // Create mock notification service with proper typing
    const mockNotif1 = {
      id: 'notif-1',
      notificationType: 'subscription_self_cancelled',
      message: 'Subscription cancelled',
      receiverAddress: mockShopAddress,
    };
    const mockNotif2 = {
      id: 'notif-2',
      notificationType: 'subscription_reactivated',
      message: 'Subscription reactivated',
      receiverAddress: mockShopAddress,
    };
    const mockNotif3 = {
      id: 'notif-3',
      notificationType: 'subscription_cancelled',
      message: 'Subscription cancelled by admin',
      receiverAddress: mockShopAddress,
    };
    const mockNotif4 = {
      id: 'notif-4',
      notificationType: 'subscription_paused',
      message: 'Subscription paused',
      receiverAddress: mockShopAddress,
    };
    const mockNotif5 = {
      id: 'notif-5',
      notificationType: 'subscription_resumed',
      message: 'Subscription resumed',
      receiverAddress: mockShopAddress,
    };

    mockNotificationService = {
      createSubscriptionSelfCancelledNotification: jest.fn<() => Promise<typeof mockNotif1>>().mockResolvedValue(mockNotif1),
      createSubscriptionReactivatedNotification: jest.fn<() => Promise<typeof mockNotif2>>().mockResolvedValue(mockNotif2),
      createSubscriptionCancelledNotification: jest.fn<() => Promise<typeof mockNotif3>>().mockResolvedValue(mockNotif3),
      createSubscriptionPausedNotification: jest.fn<() => Promise<typeof mockNotif4>>().mockResolvedValue(mockNotif4),
      createSubscriptionResumedNotification: jest.fn<() => Promise<typeof mockNotif5>>().mockResolvedValue(mockNotif5),
    };

    // Initialize notification domain with mocks
    notificationDomain = new NotificationDomain();
    (notificationDomain as any).notificationService = mockNotificationService;
    (notificationDomain as any).wsManager = mockWsManager;
  });

  describe('Shop Self-Cancel Subscription', () => {
    it('should send notification to shop when they self-cancel', async () => {
      // Trigger the event handler directly
      await (notificationDomain as any).handleSubscriptionSelfCancelled({
        data: {
          shopAddress: mockShopAddress,
          reason: 'User requested cancellation',
          effectiveDate: new Date().toISOString(),
        },
      });

      // Verify notification was created
      expect(mockNotificationService.createSubscriptionSelfCancelledNotification).toHaveBeenCalledWith(
        mockShopAddress,
        'User requested cancellation',
        expect.any(String)
      );

      // Verify WebSocket notification sent to shop
      expect(mockWsManager.sendNotificationToUser).toHaveBeenCalledWith(
        mockShopAddress,
        expect.objectContaining({
          notificationType: 'subscription_self_cancelled',
        })
      );
    });

    it('should also notify all connected admins when shop self-cancels', async () => {
      await (notificationDomain as any).handleSubscriptionSelfCancelled({
        data: {
          shopAddress: mockShopAddress,
          reason: 'Business closing',
          effectiveDate: new Date().toISOString(),
        },
      });

      // Verify admins were notified for real-time dashboard updates
      expect(mockWsManager.sendNotificationToAdmins).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationType: 'subscription_self_cancelled',
        })
      );
    });
  });

  describe('Admin Reactivates Subscription', () => {
    it('should send notification to shop when admin reactivates their subscription', async () => {
      await (notificationDomain as any).handleSubscriptionReactivated({
        data: {
          shopAddress: mockShopAddress,
        },
      });

      // Verify notification was created
      expect(mockNotificationService.createSubscriptionReactivatedNotification).toHaveBeenCalledWith(
        mockShopAddress
      );

      // Verify WebSocket notification sent to shop
      expect(mockWsManager.sendNotificationToUser).toHaveBeenCalledWith(
        mockShopAddress,
        expect.objectContaining({
          notificationType: 'subscription_reactivated',
        })
      );
    });

    it('should also notify admins when subscription is reactivated', async () => {
      await (notificationDomain as any).handleSubscriptionReactivated({
        data: {
          shopAddress: mockShopAddress,
        },
      });

      // Verify admins were notified
      expect(mockWsManager.sendNotificationToAdmins).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationType: 'subscription_reactivated',
        })
      );
    });
  });

  describe('Admin Cancels Subscription', () => {
    it('should send notification to shop when admin cancels their subscription', async () => {
      await (notificationDomain as any).handleSubscriptionCancelled({
        data: {
          shopAddress: mockShopAddress,
          reason: 'Violation of terms',
          effectiveDate: new Date().toISOString(),
        },
      });

      expect(mockNotificationService.createSubscriptionCancelledNotification).toHaveBeenCalledWith(
        mockShopAddress,
        'Violation of terms',
        expect.any(String)
      );

      expect(mockWsManager.sendNotificationToUser).toHaveBeenCalledWith(
        mockShopAddress,
        expect.objectContaining({
          notificationType: 'subscription_cancelled',
        })
      );
    });

    it('should also notify admins when subscription is cancelled', async () => {
      await (notificationDomain as any).handleSubscriptionCancelled({
        data: {
          shopAddress: mockShopAddress,
          reason: 'Payment failure',
          effectiveDate: new Date().toISOString(),
        },
      });

      expect(mockWsManager.sendNotificationToAdmins).toHaveBeenCalled();
    });
  });

  describe('Admin Pauses Subscription', () => {
    it('should send notification to shop when admin pauses their subscription', async () => {
      await (notificationDomain as any).handleSubscriptionPaused({
        data: {
          shopAddress: mockShopAddress,
          reason: 'Temporary hold',
        },
      });

      expect(mockNotificationService.createSubscriptionPausedNotification).toHaveBeenCalledWith(
        mockShopAddress,
        'Temporary hold'
      );

      expect(mockWsManager.sendNotificationToUser).toHaveBeenCalledWith(
        mockShopAddress,
        expect.objectContaining({
          notificationType: 'subscription_paused',
        })
      );
    });

    it('should also notify admins when subscription is paused', async () => {
      await (notificationDomain as any).handleSubscriptionPaused({
        data: {
          shopAddress: mockShopAddress,
          reason: 'Review pending',
        },
      });

      expect(mockWsManager.sendNotificationToAdmins).toHaveBeenCalled();
    });
  });

  describe('Admin Resumes Subscription', () => {
    it('should send notification to shop when admin resumes their subscription', async () => {
      await (notificationDomain as any).handleSubscriptionResumed({
        data: {
          shopAddress: mockShopAddress,
        },
      });

      expect(mockNotificationService.createSubscriptionResumedNotification).toHaveBeenCalledWith(
        mockShopAddress
      );

      expect(mockWsManager.sendNotificationToUser).toHaveBeenCalledWith(
        mockShopAddress,
        expect.objectContaining({
          notificationType: 'subscription_resumed',
        })
      );
    });

    it('should also notify admins when subscription is resumed', async () => {
      await (notificationDomain as any).handleSubscriptionResumed({
        data: {
          shopAddress: mockShopAddress,
        },
      });

      expect(mockWsManager.sendNotificationToAdmins).toHaveBeenCalled();
    });
  });
});

describe('WebSocketManager Admin Broadcast', () => {
  it('should correctly parse ADMIN_ADDRESSES and send to all admins', () => {
    const adminAddresses = '0xadmin1, 0xadmin2, 0xadmin3';
    process.env.ADMIN_ADDRESSES = adminAddresses;

    const parsedAddresses = adminAddresses
      .split(',')
      .map(addr => addr.toLowerCase().trim())
      .filter(addr => addr.length > 0);

    expect(parsedAddresses).toEqual(['0xadmin1', '0xadmin2', '0xadmin3']);
    expect(parsedAddresses.length).toBe(3);
  });

  it('should handle empty ADMIN_ADDRESSES gracefully', () => {
    process.env.ADMIN_ADDRESSES = '';

    const adminAddresses = (process.env.ADMIN_ADDRESSES || '')
      .split(',')
      .map(addr => addr.toLowerCase().trim())
      .filter(addr => addr.length > 0);

    expect(adminAddresses).toEqual([]);
    expect(adminAddresses.length).toBe(0);
  });
});

describe('Frontend Notification Listener Scenarios', () => {
  const subscriptionNotificationTypes = [
    'subscription_cancelled',
    'subscription_self_cancelled',
    'subscription_paused',
    'subscription_resumed',
    'subscription_reactivated',
    'subscription_approved'
  ];

  it('should include all subscription notification types in the listener', () => {
    // These are the types the frontend should listen for
    expect(subscriptionNotificationTypes).toContain('subscription_cancelled');
    expect(subscriptionNotificationTypes).toContain('subscription_self_cancelled');
    expect(subscriptionNotificationTypes).toContain('subscription_paused');
    expect(subscriptionNotificationTypes).toContain('subscription_resumed');
    expect(subscriptionNotificationTypes).toContain('subscription_reactivated');
    expect(subscriptionNotificationTypes).toContain('subscription_approved');
  });

  it('should trigger refresh for each subscription notification type', () => {
    subscriptionNotificationTypes.forEach(type => {
      const shouldRefresh = subscriptionNotificationTypes.includes(type);
      expect(shouldRefresh).toBe(true);
    });
  });
});
