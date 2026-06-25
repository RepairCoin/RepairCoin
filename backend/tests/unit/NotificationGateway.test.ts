/**
 * NotificationGateway unit tests
 *
 * Safety net for the notification centralization. These pin the delivery
 * fan-out contract so migrating emission sites onto the gateway (and later
 * folding in the legacy handlers) can't silently drop a channel — which was the
 * root cause of the "mobile didn't get it" / "no native banner" bugs.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock the WS singleton accessor so we can assert broadcasts.
const mockSendNotificationToUser = jest.fn();
jest.mock('../../src/services/WebSocketManager', () => ({
  getWebSocketManager: () => ({ sendNotificationToUser: mockSendNotificationToUser }),
}));

import { NotificationGateway } from '../../src/domains/notification/services/NotificationGateway';

// Injectable test doubles for the other two channels.
const mockCreateNotification = jest.fn<(...args: any[]) => Promise<any>>();
const mockSendToUser = jest.fn<(...args: any[]) => Promise<any>>();

const makeGateway = () =>
  new NotificationGateway(
    { createNotification: (...args: any[]) => mockCreateNotification(...args) } as any,
    { sendToUser: (...args: any[]) => mockSendToUser(...args) } as any
  );

const persisted = (overrides: Record<string, any> = {}) => ({
  id: 'notif-1',
  senderAddress: 'SYSTEM',
  receiverAddress: '0xabc',
  notificationType: 'service_order_cancelled',
  message: 'msg',
  metadata: {},
  isRead: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateNotification.mockResolvedValue(persisted());
  mockSendToUser.mockResolvedValue({ successCount: 1, failureCount: 0, invalidTokens: [] });
});

describe('NotificationGateway.dispatch', () => {
  it('fans out persist + ws + push for a full-channel transactional type', async () => {
    const gw = makeGateway();
    const result = await gw.dispatch('service_order_cancelled', '0xabc', {
      message: 'Your booking was cancelled',
      metadata: { shopName: 'TestShop', serviceName: 'Salompas', orderId: 'o1' },
    });

    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockSendNotificationToUser).toHaveBeenCalledTimes(1);
    expect(mockSendToUser).toHaveBeenCalledTimes(1);
    expect(result).not.toBeNull();
  });

  it('passes bypassPreferences for transactional types and folds display into metadata', async () => {
    const gw = makeGateway();
    await gw.dispatch('service_order_cancelled', '0xabc', {
      message: 'msg',
      metadata: { shopName: 'S', serviceName: 'X' },
    });

    const [params, options] = mockCreateNotification.mock.calls[0] as any[];
    expect(options).toEqual({ bypassPreferences: true });
    expect(params.metadata.display).toEqual({ title: 'Order Cancelled', icon: 'cancelled', color: '#EF4444' });
    expect(params.senderAddress).toBe('SYSTEM');
  });

  it('skips ws and push when persistence is suppressed by preference', async () => {
    mockCreateNotification.mockResolvedValue(persisted({ id: 'suppressed' }));
    const gw = makeGateway();
    const result = await gw.dispatch('booking_confirmed', '0xabc', { message: 'msg', metadata: {} });

    expect(mockSendNotificationToUser).not.toHaveBeenCalled();
    expect(mockSendToUser).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('honors a persist+ws type with no push (reminder_skipped_quiet_hours)', async () => {
    const gw = makeGateway();
    await gw.dispatch('reminder_skipped_quiet_hours', '0xabc', { message: 'skipped', metadata: {} });

    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockSendNotificationToUser).toHaveBeenCalledTimes(1);
    expect(mockSendToUser).not.toHaveBeenCalled();
  });

  it('honors a persist+ws type with no push (marketing_campaign)', async () => {
    const gw = makeGateway();
    await gw.dispatch('marketing_campaign', '0xabc', { message: 'Big sale', metadata: {} });

    expect(mockSendNotificationToUser).toHaveBeenCalledTimes(1);
    expect(mockSendToUser).not.toHaveBeenCalled();
  });

  it('builds the push payload from the registry (title/body/channel/data)', async () => {
    const gw = makeGateway();
    await gw.dispatch('service_order_cancelled', '0xabc', {
      message: 'in-app text',
      metadata: { shopName: 'TestShop', serviceName: 'Salompas', orderId: 'o1', refundSummary: '5 RCN' },
    });

    const [addr, payload] = mockSendToUser.mock.calls[0] as any[];
    expect(addr).toBe('0xabc');
    expect(payload.title).toBe('Booking Cancelled');
    expect(payload.body).toBe('TestShop cancelled your Salompas booking. Refund: 5 RCN');
    expect(payload.channelId).toBe('appointments');
    expect(payload.data.type).toBe('service_order_cancelled');
    expect(payload.data.orderId).toBe('o1');
  });

  it('still returns the notification when push throws (push failure never breaks the caller)', async () => {
    mockSendToUser.mockRejectedValue(new Error('expo down'));
    const gw = makeGateway();
    const result = await gw.dispatch('service_order_cancelled', '0xabc', {
      message: 'msg',
      metadata: { shopName: 'S', serviceName: 'X' },
    });

    expect(result).not.toBeNull();
    expect(mockSendNotificationToUser).toHaveBeenCalledTimes(1);
  });

  it('falls back to all channels for an unregistered type', async () => {
    const gw = makeGateway();
    await gw.dispatch('dog_crossed', '0xabc', { message: 'A dog crossed', metadata: {} });

    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockSendNotificationToUser).toHaveBeenCalledTimes(1);
    expect(mockSendToUser).toHaveBeenCalledTimes(1);
  });
});
