// Phase 4 write primitive: creates a PENDING booking linked to the ad_lead + a Stripe session whose
// metadata the existing webhook keys on; 409 when the slot was just taken. pg/Stripe/email are faked.
process.env.SKIP_DB_CONNECTION_TESTS = 'true';
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_fake';

import { LeadBookingService } from '../../src/domains/AdsDomain/services/LeadBookingService';

function fakePool(overrides: { conflict?: boolean; existingCustomer?: string } = {}) {
  const queries: { sql: string; params: any[] }[] = [];
  const pool = {
    query: async (sql: string, params: any[] = []) => {
      queries.push({ sql, params });
      if (/FROM shop_services/i.test(sql)) return { rows: [{ service_name: 'Newly Baker', price_usd: 99, duration_minutes: 45 }] };
      if (/FROM shops WHERE shop_id/i.test(sql)) return { rows: [{ name: 'Peanut' }] };
      if (/SELECT address FROM customers[\s\S]*lower\(email\)/i.test(sql)) return { rows: overrides.existingCustomer ? [{ address: overrides.existingCustomer }] : [] };
      if (/SELECT order_id FROM service_orders/i.test(sql)) return { rows: overrides.conflict ? [{ order_id: 'x' }] : [] };
      if (/INSERT INTO service_orders/i.test(sql)) return { rows: [{ order_id: 'order-1' }] };
      return { rows: [] };
    },
  };
  return { pool, queries };
}

function build(overrides: { conflict?: boolean; existingCustomer?: string } = {}) {
  const { pool, queries } = fakePool(overrides);
  let sessionArgs: any;
  const stripe = { checkout: { sessions: { create: async (a: any) => { sessionArgs = a; return { id: 'cs_1', url: 'https://checkout.stripe.com/pay/cs_1' }; } } } };
  let emailArgs: any;
  const email = { sendPaymentLinkEmail: async (...a: any[]) => { emailArgs = a; return true; } };
  const appointments = { isWithinOperatingHours: async () => true };
  const svc = new LeadBookingService(pool as any, email as any, appointments as any);
  (svc as any).getStripe = () => stripe;
  return { svc, queries, sessionArgs: () => sessionArgs, emailArgs: () => emailArgs };
}

const input = {
  leadId: 'lead-1', shopId: 'peanut', serviceId: 'srv-1', bookingDate: '2026-07-10',
  bookingTimeSlot: '09:00', customerName: 'Deo', customerEmail: 'deo@example.com',
};

describe('LeadBookingService.createLeadBooking', () => {
  it('creates a pending booking linked to the ad_lead + a Stripe session the webhook can match', async () => {
    const { svc, queries, sessionArgs, emailArgs } = build();
    const res = await svc.createLeadBooking(input);

    expect(res.orderId).toBe('order-1');
    expect(res.paymentUrl).toBe('https://checkout.stripe.com/pay/cs_1');
    expect(res.price).toBe(99);

    const insert = queries.find((q) => /INSERT INTO service_orders/i.test(q.sql))!;
    expect(insert.sql).toContain('ad_lead_id');
    expect(insert.sql).toMatch(/'pending'/);          // status
    expect(insert.params).toContain('lead-1');        // ad_lead_id value
    expect(insert.params).toContain('srv-1');
    // New email → a synthetic guest customer is created.
    expect(queries.some((q) => /INSERT INTO customers/i.test(q.sql))).toBe(true);

    // Stripe metadata MUST match what /api/shops/webhooks/stripe keys on.
    expect(sessionArgs().metadata.bookingType).toBe('manual_booking_payment');
    expect(sessionArgs().metadata.orderId).toBe('order-1');
    expect(sessionArgs().line_items[0].price_data.unit_amount).toBe(9900); // $99 → cents, from DB

    expect(emailArgs()[0]).toBe('deo@example.com'); // pay link also emailed
  });

  it('books under the EXISTING customer (no new insert) when the email is already a customer', async () => {
    const { svc, queries } = build({ existingCustomer: '0xreal_account' });
    const res = await svc.createLeadBooking(input);
    expect(res.orderId).toBe('order-1');
    // No synthetic customer inserted — reused the real account...
    expect(queries.some((q) => /INSERT INTO customers/i.test(q.sql))).toBe(false);
    // ...and the booking is attached to that account's address.
    const insert = queries.find((q) => /INSERT INTO service_orders/i.test(q.sql))!;
    expect(insert.params).toContain('0xreal_account');
  });

  it('throws 409 when the slot was just taken', async () => {
    const { svc } = build({ conflict: true });
    await expect(svc.createLeadBooking(input)).rejects.toMatchObject({ status: 409 });
  });
});
