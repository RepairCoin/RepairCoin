/**
 * PaymentService.cancelOrder — 24-hour advance cancellation rule
 *
 * Verifies the gate added at PaymentService.ts:951 that rejects customer
 * cancellations made less than 24 hours before the booking time.
 *
 * File under test: backend/src/domains/ServiceDomain/services/PaymentService.ts
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PaymentService } from '../../src/domains/ServiceDomain/services/PaymentService';
import { customerRepository, shopRepository } from '../../src/repositories';

type AnyAsync = (...args: any[]) => Promise<any>;
const asyncMock = () => jest.fn<AnyAsync>().mockResolvedValue(undefined);

const buildOrder = (overrides: Record<string, any> = {}): Record<string, any> => ({
  orderId: 'ord_test_24h',
  serviceId: 'svc_1',
  customerAddress: '0xabc',
  shopId: 'shop_1',
  status: 'paid',
  totalAmount: 100,
  finalAmountUsd: 100,
  rcnRedeemed: 0,
  rcnDiscountUsd: 0,
  bookingDate: new Date(),
  bookingTime: '10:00',
  stripePaymentIntentId: null,
  shopApproved: true,
  ...overrides,
});

const formatHHMM = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

describe('PaymentService.cancelOrder — 24-hour advance rule', () => {
  let service: PaymentService;
  let getOrderById: jest.Mock<AnyAsync>;
  let updateCancellationData: jest.Mock<AnyAsync>;

  beforeEach(() => {
    const stripeService: any = {
      getStripe: jest.fn(),
      refundPayment: jest.fn(),
    };
    service = new PaymentService(stripeService);

    getOrderById = jest.fn<AnyAsync>();
    updateCancellationData = jest.fn<AnyAsync>().mockResolvedValue(undefined);

    (service as any).orderRepository = { getOrderById, updateCancellationData };
    (service as any).serviceRepository = {
      getServiceById: jest.fn<AnyAsync>().mockResolvedValue(null),
    };
    (service as any).googleCalendarService = {
      deleteEvent: asyncMock(),
    };
    (service as any).notificationService = {
      createServiceOrderCancelledNotification: asyncMock(),
      createNotification: asyncMock(),
    };
    (service as any).emailService = {
      sendBookingCancelledByCustomer: asyncMock(),
      sendRefundProcessedNotification: asyncMock(),
    };
    (service as any).transactionRepository = {
      recordTransaction: asyncMock(),
    };

    jest.spyOn(customerRepository, 'getCustomer').mockResolvedValue(null as any);
    jest.spyOn(shopRepository, 'getShop').mockResolvedValue(null as any);
  });

  it('rejects cancellation when booking is less than 24 hours away', async () => {
    const target = new Date(Date.now() + 12 * 60 * 60 * 1000);
    getOrderById.mockResolvedValue(
      buildOrder({ bookingDate: target, bookingTime: formatHHMM(target) })
    );

    await expect(
      service.cancelOrder('ord_test_24h', 'schedule_conflict')
    ).rejects.toThrow('Bookings must be cancelled at least 24 hours in advance');

    expect(getOrderById).toHaveBeenCalledWith('ord_test_24h');
    expect(updateCancellationData).not.toHaveBeenCalled();
  });

  it('allows cancellation when booking is at least 24 hours away', async () => {
    const target = new Date(Date.now() + 48 * 60 * 60 * 1000);
    getOrderById.mockResolvedValue(
      buildOrder({ bookingDate: target, bookingTime: formatHHMM(target) })
    );

    await service.cancelOrder('ord_test_24h', 'schedule_conflict', 'note');

    expect(updateCancellationData).toHaveBeenCalledWith(
      'ord_test_24h',
      'schedule_conflict',
      'note'
    );
  });
});
