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

  it('honors a persist-only type (marketing_campaign: no ws, no push)', async () => {
    const gw = makeGateway();
    await gw.dispatch('marketing_campaign', '0xabc', { message: 'Big sale', metadata: { campaignName: 'Summer' } });

    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockSendNotificationToUser).not.toHaveBeenCalled();
    expect(mockSendToUser).not.toHaveBeenCalled();
  });

  it('resolves a dynamic display title from metadata (marketing campaign name)', async () => {
    const gw = makeGateway();
    await gw.dispatch('marketing_campaign', '0xabc', { message: 'Big sale', metadata: { campaignName: 'Summer Sale' } });

    const [params] = mockCreateNotification.mock.calls[0] as any[];
    expect(params.metadata.display.title).toBe('Summer Sale');
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

/**
 * Nudges and reminders around the confirmation flow. Both are transactional: the shop
 * one protects the shop's own revenue, the customer one is their route to resolving a
 * booking their money is still tied up in. Neither should be mutable by preferences.
 */
describe('NotificationGateway.dispatch — completion nudges and reminders', () => {
  it('nudges the shop, naming the service and the customer', async () => {
    const gw = makeGateway();
    await gw.dispatch('booking_completion_nudge', '0xshop', {
      message: 'msg',
      metadata: { orderId: 'o1', serviceName: 'Full Groom', customerName: 'Qua Ting' },
    });

    const [params, options] = mockCreateNotification.mock.calls[0] as any[];
    expect(options).toEqual({ bypassPreferences: true });
    expect(params.metadata.display.title).toBe('Mark "Full Groom" complete?');

    const [, payload] = mockSendToUser.mock.calls[0] as any[];
    expect(payload.body).toContain('Qua Ting');
    expect(payload.body).toContain('payment settles');
  });

  it('reminds the customer, naming the shop', async () => {
    const gw = makeGateway();
    await gw.dispatch('booking_confirmation_reminder', '0xabc', {
      message: 'msg',
      metadata: { orderId: 'o1', serviceName: 'Full Groom', shopName: 'Peanut Repairs' },
    });

    const [, options] = mockCreateNotification.mock.calls[0] as any[];
    expect(options).toEqual({ bypassPreferences: true });

    const [, payload] = mockSendToUser.mock.calls[0] as any[];
    expect(payload.title).toBe('Still need to know about your Full Groom');
    expect(payload.body).toContain('Peanut Repairs');
  });

  it('both degrade to readable copy with no metadata', async () => {
    const gw = makeGateway();

    await gw.dispatch('booking_completion_nudge', '0xshop', { message: '', metadata: {} });
    let [, payload] = mockSendToUser.mock.calls[0] as any[];
    expect(payload.title).toBe('Mark "a booking" complete?');
    expect(payload.body).toContain('A customer');

    jest.clearAllMocks();
    mockCreateNotification.mockResolvedValue(persisted());
    mockSendToUser.mockResolvedValue({ successCount: 1, failureCount: 0, invalidTokens: [] });

    await gw.dispatch('booking_confirmation_reminder', '0xabc', { message: '', metadata: {} });
    [, payload] = mockSendToUser.mock.calls[0] as any[];
    expect(payload.title).toBe('Still need to know about your booking');
    expect(payload.body).toContain('the shop');
  });
});

/**
 * booking_awaiting_confirmation — the shop's grace window closed without a completion,
 * so the customer is asked whether the service actually happened. Transactional on
 * purpose: there is money sitting against an unresolved booking, and this prompt is the
 * customer's route to either closing it off or getting refunded. Muting it would strand
 * them.
 */
describe('NotificationGateway.dispatch — booking_awaiting_confirmation', () => {
  const meta = (over: Record<string, any> = {}) => ({
    orderId: 'ord_1',
    serviceName: 'Full Groom',
    shopName: 'Peanut Repairs',
    shopId: 's1',
    ...over,
  });

  it('fans out persist + ws + push', async () => {
    const gw = makeGateway();
    await gw.dispatch('booking_awaiting_confirmation', '0xabc', { message: 'msg', metadata: meta() });

    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockSendNotificationToUser).toHaveBeenCalledTimes(1);
    expect(mockSendToUser).toHaveBeenCalledTimes(1);
  });

  it('bypasses preferences — an unresolved payment must always reach the customer', async () => {
    const gw = makeGateway();
    await gw.dispatch('booking_awaiting_confirmation', '0xabc', { message: 'msg', metadata: meta() });

    const [, options] = mockCreateNotification.mock.calls[0] as any[];
    expect(options).toEqual({ bypassPreferences: true });
  });

  it('names the service in the title and the shop in the push body', async () => {
    const gw = makeGateway();
    await gw.dispatch('booking_awaiting_confirmation', '0xabc', { message: 'msg', metadata: meta() });

    const [params] = mockCreateNotification.mock.calls[0] as any[];
    expect(params.metadata.display.title).toBe('Did your Full Groom go ahead?');

    const [, payload] = mockSendToUser.mock.calls[0] as any[];
    expect(payload.title).toBe('Did your Full Groom go ahead?');
    expect(payload.body).toContain('Peanut Repairs');
    expect(payload.data.orderId).toBe('ord_1');
  });

  it('degrades to readable copy with no metadata', async () => {
    const gw = makeGateway();
    await gw.dispatch('booking_awaiting_confirmation', '0xabc', { message: '', metadata: {} });

    const [, payload] = mockSendToUser.mock.calls[0] as any[];
    expect(payload.title).toBe('Did your booking go ahead?');
    expect(payload.body).toBe(
      "The shop hasn't confirmed it. Tell us whether it happened so we can close it off."
    );
  });
});

/**
 * shop_new_service — sent to every follower when a shop they follow publishes a
 * service. It's the platform's first re-engagement notification, which is exactly
 * why it must NOT be transactional: a marketing-style nudge the customer can't
 * mute is how an inbox becomes spam. These pin that distinction.
 */
describe('NotificationGateway.dispatch — shop_new_service', () => {
  const meta = (over: Record<string, any> = {}) => ({
    shopId: 's1',
    serviceId: 'svc1',
    serviceName: 'Full Groom',
    shopName: 'Peanut Repairs',
    ...over,
  });

  it('fans out persist + ws + push', async () => {
    const gw = makeGateway();
    await gw.dispatch('shop_new_service', '0xabc', {
      message: 'Peanut Repairs just added "Full Groom". Book before it fills up.',
      metadata: meta(),
    });

    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockSendNotificationToUser).toHaveBeenCalledTimes(1);
    expect(mockSendToUser).toHaveBeenCalledTimes(1);
  });

  it('does NOT bypass preferences — a follow nudge stays mutable', async () => {
    const gw = makeGateway();
    await gw.dispatch('shop_new_service', '0xabc', { message: 'msg', metadata: meta() });

    const [, options] = mockCreateNotification.mock.calls[0] as any[];
    expect(options).not.toEqual({ bypassPreferences: true });
  });

  it('names the shop in both the in-app display and the push title', async () => {
    const gw = makeGateway();
    await gw.dispatch('shop_new_service', '0xabc', { message: 'msg', metadata: meta() });

    const [params] = mockCreateNotification.mock.calls[0] as any[];
    expect(params.metadata.display.title).toBe('Peanut Repairs added a new service');

    const [addr, payload] = mockSendToUser.mock.calls[0] as any[];
    expect(addr).toBe('0xabc');
    expect(payload.title).toBe('Peanut Repairs added a new service');
    expect(payload.data.type).toBe('shop_new_service');
    expect(payload.data.serviceId).toBe('svc1');
  });

  // Push builders receive ONLY metadata — never the in-app `message`. A body
  // built from `m.message` is silently always-undefined, which is how a push
  // banner ends up generic while the in-app copy is specific.
  it('builds the push body from metadata, naming the shop and the service', async () => {
    const gw = makeGateway();
    await gw.dispatch('shop_new_service', '0xabc', {
      message: 'in-app text that push must not depend on',
      metadata: meta(),
    });

    const [, payload] = mockSendToUser.mock.calls[0] as any[];
    expect(payload.body).toBe('Peanut Repairs just added "Full Groom". Book before it fills up.');
  });

  it('degrades to readable copy when the shop/service names are missing', async () => {
    const gw = makeGateway();
    await gw.dispatch('shop_new_service', '0xabc', { message: '', metadata: {} });

    const [params] = mockCreateNotification.mock.calls[0] as any[];
    expect(params.metadata.display.title).toBe('A shop you follow added a new service');

    const [, payload] = mockSendToUser.mock.calls[0] as any[];
    expect(payload.title).toBe('A shop you follow added a new service');
    expect(payload.body).toBe('A shop you follow just added "a new service". Book before it fills up.');
  });
});
