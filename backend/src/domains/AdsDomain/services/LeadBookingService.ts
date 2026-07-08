// Phase 4 — AI books an ad lead's appointment (read/write). Creates a PENDING service_orders row for a
// Messenger lead (synthetic guest customer), links it to the ad_lead for ROI attribution, and — for the
// send_link flow — spins up a Stripe Checkout session with the SAME metadata the existing
// /api/shops/webhooks/stripe handler keys on (bookingType='manual_booking_payment' + orderId), so payment
// confirmation is fully automatic (webhook flips the order to paid). Isolated from ManualBookingController
// so the live shop-booking endpoint is untouched. Never books without an explicit confirmation upstream.

import crypto from 'crypto';
import Stripe from 'stripe';
import { getSharedPool } from '../../../utils/database-pool';
import { logger } from '../../../utils/logger';
import { eventBus, createDomainEvent } from '../../../events/EventBus';
import { EmailService } from '../../../services/EmailService';
import { AppointmentService } from '../../ServiceDomain/services/AppointmentService';

export interface LeadBookingInput {
  leadId: string;
  shopId: string;
  serviceId: string;
  bookingDate: string;      // YYYY-MM-DD
  bookingTimeSlot: string;  // HH:MM or HH:MM:SS
  customerName: string;
  customerEmail: string;    // required — needed to create the guest customer + email the pay link
  customerPhone?: string | null;
}

export interface LeadBookingResult {
  orderId: string;
  serviceName: string;
  price: number;
  bookingDate: string;
  bookingTimeSlot: string;  // HH:MM
  paymentUrl: string | null; // null when Stripe isn't configured — caller tells the customer the team will follow up
  emailSent: boolean;
}

/** Deterministic guest-customer address for a lead (re-booking the same lead reuses the same record). */
function guestAddress(leadId: string): string {
  return '0x' + crypto.createHash('sha256').update(`lead:${leadId}`).digest('hex').slice(0, 40);
}

function hhmm(t: string): string { return t.substring(0, 5); }
function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export class LeadBookingService {
  private stripe: Stripe | null = null;
  constructor(
    private readonly pool = getSharedPool(),
    private readonly email = new EmailService(),
    private readonly appointments = new AppointmentService()
  ) {}

  private getStripe(): Stripe | null {
    if (!process.env.STRIPE_SECRET_KEY) return null;
    if (!this.stripe) this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' as any });
    return this.stripe;
  }

  /** Create a pending booking for a lead + a Stripe pay link. Throws {status} on a gate (409 slot taken,
   *  400 outside hours / bad service). The caller (the AI) must have an EXPLICIT slot confirmation first. */
  async createLeadBooking(input: LeadBookingInput): Promise<LeadBookingResult> {
    const { leadId, shopId, serviceId, bookingDate, customerName, customerEmail } = input;
    const bookingTimeSlot = input.bookingTimeSlot.length === 5 ? `${input.bookingTimeSlot}:00` : input.bookingTimeSlot;

    // Price + names come from the DB, never from the caller/AI.
    const svc = await this.pool.query(
      `SELECT service_name, price_usd, duration_minutes FROM shop_services WHERE service_id = $1 AND shop_id = $2 AND active = true`,
      [serviceId, shopId]
    );
    if (!svc.rows.length) throw Object.assign(new Error('Service not found or inactive'), { status: 400 });
    const service = svc.rows[0];
    const shopRes = await this.pool.query(`SELECT name FROM shops WHERE shop_id = $1`, [shopId]);
    const shopName = shopRes.rows[0]?.name || 'the shop';
    const bookingEndTime = `${addMinutes(hhmm(bookingTimeSlot), Number(service.duration_minutes) || 60)}:00`;

    // Guard: slot still open + within operating hours (the AI only offers real slots, but re-check at write).
    const conflict = await this.pool.query(
      `SELECT order_id FROM service_orders WHERE shop_id = $1 AND booking_date = $2 AND booking_time_slot = $3
         AND status NOT IN ('cancelled', 'refunded')`,
      [shopId, bookingDate, bookingTimeSlot]
    );
    if (conflict.rows.length) throw Object.assign(new Error('That time was just taken'), { status: 409 });
    const withinHours = await this.appointments.isWithinOperatingHours(shopId, bookingDate, bookingTimeSlot).catch(() => true);
    if (!withinHours) throw Object.assign(new Error('That time is outside opening hours'), { status: 400 });

    // Resolve the customer. `customers.email` is UNIQUE (unique_customers_email on lower(email) + a trigger),
    // so we must NOT blindly insert. If the email already belongs to a customer, book under THEIR account
    // (booking shows in their history + attribution, no duplicate, no unique violation). Otherwise create a
    // synthetic guest contact for the lead (contact record only — no wallet/RCN).
    let address: string;
    const existing = await this.pool.query(
      `SELECT address FROM customers WHERE lower(email) = lower($1) LIMIT 1`, [customerEmail]);
    if (existing.rows.length) {
      address = existing.rows[0].address;
    } else {
      address = guestAddress(leadId);
      await this.pool.query(
        `INSERT INTO customers (address, wallet_address, email, name, phone, created_at)
           VALUES ($1, $1, $2, $3, $4, NOW())
         ON CONFLICT (address) DO UPDATE SET email = EXCLUDED.email,
           name = COALESCE(customers.name, EXCLUDED.name), phone = COALESCE(customers.phone, EXCLUDED.phone)`,
        [address, customerEmail, customerName || 'Messenger Lead', input.customerPhone || null]
      );
    }

    // Create the pending booking, linked to the ad lead (deterministic ROI attribution).
    const orderRes = await this.pool.query(
      `INSERT INTO service_orders (
         order_id, customer_address, shop_id, service_id, status, total_amount, booking_date,
         booking_time_slot, booking_end_time, booking_type, booked_by, payment_status, notes, ad_lead_id, created_at
       ) VALUES (gen_random_uuid(), $1, $2, $3, 'pending', $4, $5, $6, $7, 'manual', 'ai_agent', 'pending', $8, $9, NOW())
       RETURNING order_id`,
      [address, shopId, serviceId, service.price_usd, bookingDate, bookingTimeSlot, bookingEndTime,
       `AI-booked from Messenger lead ${leadId}`, leadId]
    );
    const orderId = orderRes.rows[0].order_id;

    // Attribution/Kanban auto-advance (no-op unless ADS_CONVERSION_ATTRIBUTION). Non-blocking.
    eventBus.publish(createDomainEvent(
      'service.order_created', address,
      { orderId, customerAddress: address, shopId, serviceId, status: 'pending' }, 'AdsDomain'
    )).catch((e) => logger.warn(`LeadBooking: order_created publish failed: ${e?.message || e}`));

    // Stripe pay link (same metadata the booking webhook keys on → auto-marks paid).
    let paymentUrl: string | null = null;
    const stripe = this.getStripe();
    if (stripe) {
      try {
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [{
            price_data: {
              currency: 'usd',
              product_data: { name: service.service_name, description: `Appointment at ${shopName} on ${bookingDate} at ${hhmm(bookingTimeSlot)}` },
              unit_amount: Math.round(Number(service.price_usd) * 100),
            },
            quantity: 1,
          }],
          mode: 'payment',
          success_url: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/payment/success?orderId=${orderId}`,
          cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/payment/cancelled?orderId=${orderId}`,
          customer_email: customerEmail || undefined,
          metadata: { orderId, shopId, serviceId, bookingType: 'manual_booking_payment' },
          expires_at: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
        });
        paymentUrl = session.url;
        await this.pool.query(`UPDATE service_orders SET stripe_session_id = $1 WHERE order_id = $2`, [session.id, orderId]);
      } catch (e: any) {
        logger.error(`LeadBooking: Stripe session failed for order ${orderId}: ${e?.message || e}`);
      }
    } else {
      logger.warn('LeadBooking: STRIPE_SECRET_KEY unset — booking created without a pay link');
    }

    // Email the pay link too (Messenger delivery is handled by the caller).
    let emailSent = false;
    if (customerEmail && paymentUrl) {
      try {
        emailSent = await this.email.sendPaymentLinkEmail(customerEmail, customerName || 'Customer', {
          shopName,
          serviceName: service.service_name,
          bookingDate: new Date(`${bookingDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          bookingTime: new Date(`2000-01-01T${bookingTimeSlot}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          amount: Number(service.price_usd),
          paymentLink: paymentUrl,
          expiresIn: '24 hours',
        });
      } catch (e: any) {
        logger.error(`LeadBooking: pay-link email failed for order ${orderId}: ${e?.message || e}`);
      }
    }

    return {
      orderId, serviceName: service.service_name, price: Number(service.price_usd),
      bookingDate, bookingTimeSlot: hhmm(bookingTimeSlot), paymentUrl, emailSent,
    };
  }
}

export const leadBookingService = new LeadBookingService();
