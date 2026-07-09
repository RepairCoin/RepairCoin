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
import { resendEmailService } from '../../../services/ResendEmailService';
import { AppointmentService } from '../../ServiceDomain/services/AppointmentService';
import { LeadRepository } from '../repositories/LeadRepository';
import { LeadMessageRepository } from '../repositories/LeadMessageRepository';
import { LeadChannelSender, leadChannelSender } from './LeadChannelSender';

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

/** A SHORT pay link that survives Messenger/Facebook link-wrapping. The raw Stripe checkout URL carries a
 *  required `#fragment` that FB strips (replacing it with ?fbclid), breaking the page. So we hand out a short
 *  backend URL that 302-redirects to the live Stripe session (fragment intact). Falls back to the raw URL only
 *  when no public API base is configured (dev). */
function shortPayLink(orderId: string, rawUrl: string | null): string | null {
  const apiBase = (process.env.API_BASE_URL || '').trim().replace(/\/$/, '');
  if (apiBase && !/localhost|127\.0\.0\.1/i.test(apiBase)) return `${apiBase}/api/ads/pay/${orderId}`;
  return rawUrl;
}

/** Simple, brand-neutral HTML for the booking pay-link email (sent via Resend). */
function paymentLinkHtml(d: { customerName: string; shopName: string; serviceName: string; dateStr: string; timeStr: string; amount: number; payLink: string }): string {
  const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a;font-size:15px;line-height:1.6">` +
    `<h2 style="margin:0 0 12px">Confirm your booking</h2>` +
    `<p>Hi ${esc(d.customerName)},</p>` +
    `<p>Your <strong>${esc(d.serviceName)}</strong> at <strong>${esc(d.shopName)}</strong> is reserved for ` +
    `<strong>${esc(d.dateStr)} at ${esc(d.timeStr)}</strong> — $${d.amount.toFixed(2)}.</p>` +
    `<p style="margin:20px 0"><a href="${d.payLink}" style="background:#FFCC00;color:#111827;text-decoration:none;font-weight:600;padding:12px 28px;border-radius:9999px;display:inline-block">Pay &amp; confirm</a></p>` +
    `<p style="font-size:13px;color:#666">Or open this link: <a href="${d.payLink}">${esc(d.payLink)}</a></p>` +
    `<p style="font-size:13px;color:#666">This link expires in 24 hours.</p></div>`;
}

export class LeadBookingService {
  private stripe: Stripe | null = null;
  constructor(
    private readonly pool = getSharedPool(),
    private readonly email = new EmailService(),
    private readonly appointments = new AppointmentService(),
    private readonly leads = new LeadRepository(),
    private readonly messages = new LeadMessageRepository(),
    private readonly channel = leadChannelSender
  ) {}

  /** Called when a booking's Stripe payment completes (from the webhook). For an AI/ad booking (has ad_lead_id):
   *  auto-advance the status paid→scheduled (autopilot — the slot is chosen + paid, no manual shop step needed) and
   *  send the customer a thank-you/confirmation on their channel (Messenger). Best-effort; never throws. */
  async onPaymentConfirmed(orderId: string): Promise<void> {
    try {
      const r = await this.pool.query(
        `SELECT o.ad_lead_id, o.booking_time_slot, s.service_name
           FROM service_orders o LEFT JOIN shop_services s ON s.service_id = o.service_id
          WHERE o.order_id = $1`,
        [orderId]
      );
      const o = r.rows[0];
      if (!o?.ad_lead_id) return; // not an AI/ad booking — leave the shop's normal flow alone
      // Advance paid→scheduled (best-effort + ISOLATED so a status hiccup never blocks the confirmation below).
      try {
        await this.pool.query(
          `UPDATE service_orders SET status = 'scheduled', updated_at = now() WHERE order_id = $1 AND status = 'paid'`,
          [orderId]
        );
      } catch (e: any) {
        logger.warn(`LeadBooking.onPaymentConfirmed: status advance failed for ${orderId}: ${e?.message || e}`);
      }
      const lead = await this.leads.findById(o.ad_lead_id);
      if (!lead) return;
      const first = (lead.name || '').trim().split(/\s+/)[0];
      const time = o.booking_time_slot ? hhmm(o.booking_time_slot) : '';
      const body = `Payment received${first ? `, ${first}` : ''} — you're all set! 🎉 Your ${o.service_name || 'appointment'}` +
        `${time ? ` at ${time}` : ''} is confirmed. Thank you so much, and we'll see you then!`;
      const channel = LeadChannelSender.pickChannel(lead);
      const deliveryStatus = await this.channel.deliver(channel, lead, body);
      await this.messages.append({ leadId: lead.id, direction: 'outbound', author: 'ai', channel, body, deliveryStatus });
    } catch (e: any) {
      logger.error(`LeadBooking.onPaymentConfirmed failed for ${orderId}: ${e?.message || e}`);
    }
  }

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
      `SELECT address FROM customers
         WHERE lower(email) = lower($1)
            OR ($2::text IS NOT NULL AND $2 <> '' AND phone = $2)
         LIMIT 1`,
      [customerEmail, input.customerPhone ?? null]);
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

    // Hand out the SHORT, Messenger-safe redirect link (not the raw fragment-bearing Stripe URL).
    const payLink = shortPayLink(orderId, paymentUrl);

    // Email the pay link too (Messenger delivery is handled by the caller). Prefer Resend (the configured
    // provider); fall back to the legacy EmailService only if Resend isn't ready.
    let emailSent = false;
    if (customerEmail && payLink) {
      const dateStr = new Date(`${bookingDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const timeStr = new Date(`2000-01-01T${bookingTimeSlot}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      try {
        if (resendEmailService.isReady()) {
          const html = paymentLinkHtml({ customerName: customerName || 'there', shopName, serviceName: service.service_name, dateStr, timeStr, amount: Number(service.price_usd), payLink });
          const text = `Hi ${customerName || 'there'},\n\nYour ${service.service_name} at ${shopName} is reserved for ` +
            `${dateStr} at ${timeStr} — $${Number(service.price_usd).toFixed(2)}.\n\nPay & confirm: ${payLink}\n\n` +
            `This link expires in 24 hours.`;
          const result = await resendEmailService.sendEmail({
            to: customerEmail,
            subject: `Confirm your booking at ${shopName}`,
            html,
            text,
            from: { email: process.env.RESEND_FROM_EMAIL || 'leads@send.fixflow.ai', name: `${shopName} via FixFlow` },
          });
          emailSent = result.success;
          if (!result.success) logger.error(`LeadBooking: Resend pay-link email failed for order ${orderId}: ${result.error}`);
        } else {
          emailSent = await this.email.sendPaymentLinkEmail(customerEmail, customerName || 'Customer', {
            shopName, serviceName: service.service_name, bookingDate: dateStr, bookingTime: timeStr,
            amount: Number(service.price_usd), paymentLink: payLink, expiresIn: '24 hours',
          });
        }
      } catch (e: any) {
        logger.error(`LeadBooking: pay-link email failed for order ${orderId}: ${e?.message || e}`);
      }
    }

    return {
      orderId, serviceName: service.service_name, price: Number(service.price_usd),
      bookingDate, bookingTimeSlot: hhmm(bookingTimeSlot), paymentUrl: payLink, emailSent,
    };
  }

  /** Resolve the live Stripe checkout URL for an order (for the /api/ads/pay/:orderId redirect). Reuses the
   *  open session; regenerates a fresh one if it expired; returns { paid:true } when already paid. */
  async getCheckoutUrl(orderId: string): Promise<{ url: string | null; paid: boolean; found: boolean }> {
    const r = await this.pool.query(
      `SELECT o.status, o.payment_status, o.stripe_session_id, o.service_id, o.shop_id, o.total_amount,
              o.booking_date, s.service_name, sh.name AS shop_name
         FROM service_orders o
         LEFT JOIN shop_services s ON s.service_id = o.service_id
         LEFT JOIN shops sh ON sh.shop_id = o.shop_id
        WHERE o.order_id = $1`,
      [orderId]
    );
    if (!r.rows.length) return { url: null, paid: false, found: false };
    const o = r.rows[0];
    if (o.status === 'paid' || o.payment_status === 'paid') return { url: null, paid: true, found: true };
    const stripe = this.getStripe();
    if (!stripe) return { url: null, paid: false, found: true };
    if (o.stripe_session_id) {
      try {
        const s = await stripe.checkout.sessions.retrieve(o.stripe_session_id);
        if (s.status === 'complete' || s.payment_status === 'paid') return { url: null, paid: true, found: true };
        if (s.status === 'open' && s.url) return { url: s.url, paid: false, found: true };
      } catch (e: any) {
        logger.warn(`LeadBooking.getCheckoutUrl retrieve failed for ${orderId}: ${e?.message || e}`);
      }
    }
    // Session missing/expired → regenerate one for the still-pending order.
    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: { name: o.service_name || 'Appointment', description: `Appointment at ${o.shop_name || 'the shop'} on ${o.booking_date}` },
            unit_amount: Math.round(Number(o.total_amount) * 100),
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/payment/success?orderId=${orderId}`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/payment/cancelled?orderId=${orderId}`,
        metadata: { orderId, shopId: o.shop_id, serviceId: o.service_id, bookingType: 'manual_booking_payment' },
        expires_at: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
      });
      await this.pool.query(`UPDATE service_orders SET stripe_session_id = $1 WHERE order_id = $2`, [session.id, orderId]);
      return { url: session.url, paid: false, found: true };
    } catch (e: any) {
      logger.error(`LeadBooking.getCheckoutUrl regenerate failed for ${orderId}: ${e?.message || e}`);
      return { url: null, paid: false, found: true };
    }
  }
}

export const leadBookingService = new LeadBookingService();
