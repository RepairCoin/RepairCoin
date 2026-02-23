/**
 * Manual Booking Controller
 *
 * Handles manual appointment booking by shop admins.
 * Allows shops to book appointments for customers directly from calendar view.
 *
 * Created: February 16, 2026
 */

import { Request, Response } from 'express';
import { getSharedPool } from '../../../utils/database-pool';
import { NotificationService } from '../../notification/services/NotificationService';
import { EmailService } from '../../../services/EmailService';
import Stripe from 'stripe';

const pool = getSharedPool();
const notificationService = new NotificationService();
const emailService = new EmailService();

// Initialize Stripe (lazy initialization to handle missing key gracefully)
let stripe: Stripe | null = null;
const getStripe = (): Stripe => {
  if (!stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-12-18.acacia' as any,
    });
  }
  return stripe;
};

interface ManualBookingRequest {
  customerAddress: string;
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  serviceId: string;
  bookingDate: string; // YYYY-MM-DD
  bookingTimeSlot: string; // HH:MM:SS
  bookingEndTime?: string; // HH:MM:SS
  paymentStatus: 'paid' | 'pending' | 'unpaid' | 'send_link' | 'qr_code';
  notes?: string;
  createNewCustomer?: boolean;
}

/**
 * Create a manual booking
 * POST /api/shops/:shopId/appointments/manual
 */
export const createManualBooking = async (req: Request, res: Response): Promise<void> => {
  console.log('=== Manual Booking Request ===');
  console.log('Params:', req.params);
  console.log('Body:', JSON.stringify(req.body, null, 2));

  try {
    const { shopId } = req.params;
    const shopAdminAddress = req.user?.address;
    console.log('Step 1: shopId =', shopId, ', shopAdminAddress =', shopAdminAddress);

    if (!shopAdminAddress) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Validate shop authorization
    const shopCheck = await pool.query(
      'SELECT shop_id, name FROM shops WHERE shop_id = $1 AND LOWER(wallet_address) = LOWER($2)',
      [shopId, shopAdminAddress]
    );

    console.log('Step 2: Shop check result:', shopCheck.rows.length, 'rows');

    if (shopCheck.rows.length === 0) {
      res.status(403).json({ error: 'You do not have permission to create bookings for this shop' });
      return;
    }

    const shop = shopCheck.rows[0];
    console.log('Step 3: Shop found:', shop.name);

    const {
      customerAddress,
      customerEmail,
      customerName,
      customerPhone,
      serviceId,
      bookingDate,
      bookingTimeSlot,
      bookingEndTime,
      paymentStatus,
      notes,
      createNewCustomer
    }: ManualBookingRequest = req.body;

    console.log('Step 4: Extracted fields - customerAddress:', customerAddress, ', serviceId:', serviceId, ', bookingDate:', bookingDate, ', paymentStatus:', paymentStatus);

    // Validation
    if (!customerAddress || !serviceId || !bookingDate || !bookingTimeSlot || !paymentStatus) {
      res.status(400).json({
        error: 'Missing required fields',
        required: ['customerAddress', 'serviceId', 'bookingDate', 'bookingTimeSlot', 'paymentStatus']
      });
      return;
    }
    console.log('Step 5: Basic validation passed');

    // Validate payment status
    if (!['paid', 'pending', 'unpaid', 'send_link', 'qr_code'].includes(paymentStatus)) {
      res.status(400).json({ error: 'Invalid payment status. Must be: paid, pending, unpaid, send_link, or qr_code' });
      return;
    }

    // Validate email is provided for send_link
    if (paymentStatus === 'send_link' && !customerEmail) {
      res.status(400).json({ error: 'Customer email is required to send a payment link' });
      return;
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(bookingDate)) {
      res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
      return;
    }

    // Validate time format
    const timeRegex = /^\d{2}:\d{2}:\d{2}$/;
    if (!timeRegex.test(bookingTimeSlot)) {
      res.status(400).json({ error: 'Invalid time format. Use HH:MM:SS' });
      return;
    }

    // Check if service exists and belongs to shop
    console.log('Step 6: Checking service exists...');
    const serviceCheck = await pool.query(
      'SELECT service_id, service_name, price_usd, duration_minutes FROM shop_services WHERE service_id = $1 AND shop_id = $2 AND active = true',
      [serviceId, shopId]
    );
    console.log('Step 7: Service check result:', serviceCheck.rows.length, 'rows');

    if (serviceCheck.rows.length === 0) {
      res.status(404).json({ error: 'Service not found or inactive' });
      return;
    }

    const service = serviceCheck.rows[0];
    console.log('Step 8: Service found:', service.service_name, 'price:', service.price_usd);

    // Check if customer exists
    console.log('Step 9: Checking customer exists...');
    let customer = await pool.query(
      'SELECT address, email, name, phone FROM customers WHERE LOWER(address) = LOWER($1)',
      [customerAddress]
    );

    // Create new customer if needed
    if (customer.rows.length === 0 && createNewCustomer) {
      if (!customerEmail && !customerPhone) {
        res.status(400).json({ error: 'Email or phone required to create new customer' });
        return;
      }

      await pool.query(
        `INSERT INTO customers (address, wallet_address, email, name, phone, created_at)
         VALUES ($1, $1, $2, $3, $4, NOW())`,
        [
          customerAddress.toLowerCase(),
          customerEmail || null,
          customerName || 'Walk-in Customer',
          customerPhone || null
        ]
      );

      customer = await pool.query(
        'SELECT address, email, name, phone FROM customers WHERE LOWER(address) = LOWER($1)',
        [customerAddress]
      );
    } else if (customer.rows.length === 0) {
      res.status(404).json({
        error: 'Customer not found',
        message: 'Set createNewCustomer: true to create a new customer account'
      });
      return;
    }

    const customerData = customer.rows[0];

    // Check for time slot conflicts
    const conflictCheck = await pool.query(
      `SELECT order_id FROM service_orders
       WHERE shop_id = $1
       AND booking_date = $2
       AND booking_time_slot = $3
       AND status NOT IN ('cancelled', 'refunded')`,
      [shopId, bookingDate, bookingTimeSlot]
    );

    if (conflictCheck.rows.length > 0) {
      res.status(409).json({
        error: 'Time slot conflict',
        message: 'This time slot is already booked. Please choose a different time.'
      });
      return;
    }

    // Check shop availability configuration (optional - can be added later)
    // For now, we'll allow any time slot booking

    // Determine order status based on payment status
    // 'send_link' and 'qr_code' create order in 'pending' status until customer pays
    // Note: Valid statuses are: pending, paid, completed, cancelled, refunded, no_show, expired
    const requiresPayment = paymentStatus === 'send_link' || paymentStatus === 'qr_code';
    const orderStatus = requiresPayment ? 'pending' : 'paid';
    const dbPaymentStatus = requiresPayment ? 'pending' : paymentStatus;
    console.log('Step 10: Order status will be:', orderStatus, ', dbPaymentStatus:', dbPaymentStatus);

    // Create the manual booking
    console.log('Step 11: Creating order...');
    const orderResult = await pool.query(
      `INSERT INTO service_orders (
        order_id,
        customer_address,
        shop_id,
        service_id,
        status,
        total_amount,
        booking_date,
        booking_time_slot,
        booking_end_time,
        booking_type,
        booked_by,
        payment_status,
        notes,
        created_at
      ) VALUES (
        gen_random_uuid(),
        $1, $2, $3, $4, $5, $6, $7, $8, 'manual', $9, $10, $11, NOW()
      ) RETURNING order_id, total_amount, created_at`,
      [
        customerData.address,
        shopId,
        serviceId,
        orderStatus,
        service.price_usd,
        bookingDate,
        bookingTimeSlot,
        bookingEndTime || null,
        shopAdminAddress,
        dbPaymentStatus,
        notes || null
      ]
    );

    const order = orderResult.rows[0];
    console.log('Step 12: Order created:', order.order_id);

    // Handle payment link generation for 'send_link' or 'qr_code' options
    let paymentLinkUrl: string | null = null;
    if (paymentStatus === 'send_link' || paymentStatus === 'qr_code') {
      // Check if Stripe is configured
      if (!process.env.STRIPE_SECRET_KEY) {
        console.error('Stripe is not configured - STRIPE_SECRET_KEY missing');
        // Continue without payment link, booking is still created
      } else {
        try {
          // Create a Stripe Checkout Session for the booking
          const session = await getStripe().checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
              price_data: {
                currency: 'usd',
                product_data: {
                  name: service.service_name,
                  description: `Appointment at ${shop.name} on ${bookingDate} at ${bookingTimeSlot.substring(0, 5)}`,
                },
                unit_amount: Math.round(service.price_usd * 100), // Convert to cents
              },
              quantity: 1,
            }],
            mode: 'payment',
            success_url: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/customer/bookings?payment=success&orderId=${order.order_id}`,
            cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/customer/bookings?payment=cancelled&orderId=${order.order_id}`,
            customer_email: customerEmail || undefined,
            metadata: {
              orderId: order.order_id,
              shopId: shopId,
              serviceId: serviceId,
              bookingType: 'manual_booking_payment',
            },
            expires_at: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // Expires in 24 hours
          });

          paymentLinkUrl = session.url;

          // Update order with Stripe session ID
          await pool.query(
            `UPDATE service_orders SET stripe_session_id = $1 WHERE order_id = $2`,
            [session.id, order.order_id]
          );

          // Send payment link email to customer (only for send_link, not qr_code)
          if (paymentStatus === 'send_link' && customerEmail) {
            await emailService.sendPaymentLinkEmail(
              customerEmail,
              customerData.name || 'Customer',
              {
                shopName: shop.name,
                serviceName: service.service_name,
                bookingDate: bookingDate,
                bookingTime: bookingTimeSlot.substring(0, 5),
                amount: service.price_usd,
                paymentLink: paymentLinkUrl || '',
                expiresIn: '24 hours',
              }
            );
          }
        } catch (stripeError: any) {
          console.error('Error creating payment link:', stripeError);
          // Continue with booking even if payment link fails
          // The booking is created, shop can resend link later
        }
      }
    }

    // Send notification to customer
    try {
      await notificationService.createNotification({
        senderAddress: shopAdminAddress,
        receiverAddress: customerData.address,
        notificationType: 'appointment_booked',
        message: `Your appointment at ${shop.name} has been scheduled for ${bookingDate} at ${bookingTimeSlot.substring(0, 5)}`,
        metadata: {
          orderId: order.order_id,
          shopId: shopId,
          shopName: shop.name,
          serviceName: service.service_name,
          bookingDate: bookingDate,
          bookingTime: bookingTimeSlot,
          paymentStatus: paymentStatus
        }
      });

      // Send email if customer has email
      if (customerData.email) {
        const timeFormatted = new Date(`2000-01-01T${bookingTimeSlot}`).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });

        await emailService.sendAppointmentConfirmation(
          customerData.email,
          customerData.name || 'Customer',
          shop.name,
          service.service_name,
          new Date(bookingDate),
          timeFormatted,
          paymentStatus
        );
      }
    } catch (notifError) {
      console.error('Failed to send notification:', notifError);
      // Don't fail the booking if notification fails
    }

    res.status(201).json({
      success: true,
      message: 'Appointment booked successfully',
      booking: {
        orderId: order.order_id,
        customerAddress: customerData.address,
        customerName: customerData.name,
        customerEmail: customerData.email,
        shopId: shopId,
        shopName: shop.name,
        serviceId: serviceId,
        serviceName: service.service_name,
        bookingDate: bookingDate,
        bookingTimeSlot: bookingTimeSlot,
        bookingEndTime: bookingEndTime,
        totalAmount: parseFloat(order.total_amount),
        paymentStatus: paymentStatus,
        bookingType: 'manual',
        bookedBy: shopAdminAddress,
        notes: notes,
        createdAt: order.created_at,
        paymentLink: paymentLinkUrl // Include payment link for QR code or send_link options
      }
    });

  } catch (error: any) {
    console.error('Error creating manual booking:', error);
    console.error('Error stack:', error?.stack);
    res.status(500).json({
      error: 'Failed to create booking',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  }
};

/**
 * Search for customers
 * GET /api/shops/:shopId/customers/search?q=<query>
 */
export const searchCustomers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { shopId } = req.params;
    const { q } = req.query;
    const shopAdminAddress = req.user?.address;

    if (!shopAdminAddress) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Validate shop authorization
    const shopCheck = await pool.query(
      'SELECT shop_id FROM shops WHERE shop_id = $1 AND LOWER(wallet_address) = LOWER($2)',
      [shopId, shopAdminAddress]
    );

    if (shopCheck.rows.length === 0) {
      res.status(403).json({ error: 'You do not have permission to search customers for this shop' });
      return;
    }

    if (!q || typeof q !== 'string') {
      res.status(400).json({ error: 'Search query required (q parameter)' });
      return;
    }

    const searchQuery = `%${q.toLowerCase()}%`;

    // Search customers by name, email, phone, or wallet address
    const customers = await pool.query(
      `SELECT
        address,
        wallet_address,
        email,
        name,
        phone,
        no_show_count,
        no_show_tier,
        created_at
      FROM customers
      WHERE
        LOWER(name) LIKE $1 OR
        LOWER(email) LIKE $1 OR
        LOWER(phone) LIKE $1 OR
        LOWER(address) LIKE $1
      ORDER BY
        CASE
          WHEN LOWER(name) LIKE $1 THEN 1
          WHEN LOWER(email) LIKE $1 THEN 2
          WHEN LOWER(phone) LIKE $1 THEN 3
          ELSE 4
        END,
        name ASC
      LIMIT 20`,
      [searchQuery]
    );

    res.json({
      success: true,
      customers: customers.rows.map(c => ({
        address: c.address,
        email: c.email,
        name: c.name,
        phone: c.phone,
        noShowCount: c.no_show_count,
        noShowTier: c.no_show_tier,
        createdAt: c.created_at
      }))
    });

  } catch (error) {
    console.error('Error searching customers:', error);
    res.status(500).json({
      error: 'Failed to search customers',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get payment link for an unpaid manual booking
 * GET /api/shops/:shopId/appointments/:orderId/payment-link
 */
export const getPaymentLink = async (req: Request, res: Response): Promise<void> => {
  try {
    const { shopId, orderId } = req.params;
    const shopAdminAddress = req.user?.address;

    if (!shopAdminAddress) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Validate shop authorization
    const shopCheck = await pool.query(
      'SELECT shop_id, name FROM shops WHERE shop_id = $1 AND LOWER(wallet_address) = LOWER($2)',
      [shopId, shopAdminAddress]
    );

    if (shopCheck.rows.length === 0) {
      res.status(403).json({ error: 'You do not have permission to access this shop' });
      return;
    }

    // Get the order
    const orderResult = await pool.query(
      `SELECT
        so.order_id,
        so.customer_address,
        so.service_id,
        so.status,
        so.payment_status,
        so.total_amount,
        so.booking_date,
        so.booking_time_slot,
        so.stripe_session_id,
        ss.service_name,
        c.email as customer_email,
        c.name as customer_name,
        s.name as shop_name
      FROM service_orders so
      JOIN shop_services ss ON so.service_id = ss.service_id
      JOIN shops s ON so.shop_id = s.shop_id
      LEFT JOIN customers c ON LOWER(so.customer_address) = LOWER(c.address)
      WHERE so.order_id = $1 AND so.shop_id = $2`,
      [orderId, shopId]
    );

    if (orderResult.rows.length === 0) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const order = orderResult.rows[0];

    // Check if order is eligible for payment link
    if (order.status !== 'pending' || order.payment_status !== 'pending') {
      res.status(400).json({
        error: 'Order is not awaiting payment',
        status: order.status,
        paymentStatus: order.payment_status
      });
      return;
    }

    // If we have a Stripe session, check if it's still valid
    if (order.stripe_session_id) {
      try {
        const session = await getStripe().checkout.sessions.retrieve(order.stripe_session_id);

        if (session.status === 'open' && session.url) {
          res.json({
            success: true,
            paymentLink: session.url,
            status: 'open',
            expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
            order: {
              orderId: order.order_id,
              serviceName: order.service_name,
              amount: parseFloat(order.total_amount),
              bookingDate: order.booking_date,
              bookingTime: order.booking_time_slot
            }
          });
          return;
        } else if (session.status === 'complete') {
          // Payment was actually completed, update the order
          await pool.query(
            `UPDATE service_orders SET status = 'paid', payment_status = 'paid' WHERE order_id = $1`,
            [orderId]
          );
          res.json({
            success: true,
            message: 'Payment already completed',
            status: 'complete'
          });
          return;
        }
        // Session expired, fall through to create new one
      } catch (stripeError: any) {
        console.log('Could not retrieve Stripe session:', stripeError.message);
        // Fall through to create new session
      }
    }

    // No valid session exists, need to regenerate
    res.json({
      success: false,
      message: 'Payment link expired or not found. Use regenerate endpoint to create a new one.',
      status: 'expired',
      order: {
        orderId: order.order_id,
        serviceName: order.service_name,
        amount: parseFloat(order.total_amount),
        bookingDate: order.booking_date,
        bookingTime: order.booking_time_slot
      }
    });

  } catch (error) {
    console.error('Error getting payment link:', error);
    res.status(500).json({
      error: 'Failed to get payment link',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Regenerate payment link for an unpaid manual booking
 * POST /api/shops/:shopId/appointments/:orderId/regenerate-payment-link
 */
export const regeneratePaymentLink = async (req: Request, res: Response): Promise<void> => {
  try {
    const { shopId, orderId } = req.params;
    const { sendEmail } = req.body; // Optional: send email to customer
    const shopAdminAddress = req.user?.address;

    if (!shopAdminAddress) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Validate shop authorization
    const shopCheck = await pool.query(
      'SELECT shop_id, name FROM shops WHERE shop_id = $1 AND LOWER(wallet_address) = LOWER($2)',
      [shopId, shopAdminAddress]
    );

    if (shopCheck.rows.length === 0) {
      res.status(403).json({ error: 'You do not have permission to access this shop' });
      return;
    }

    const shop = shopCheck.rows[0];

    // Get the order
    const orderResult = await pool.query(
      `SELECT
        so.order_id,
        so.customer_address,
        so.service_id,
        so.status,
        so.payment_status,
        so.total_amount,
        so.booking_date,
        so.booking_time_slot,
        ss.service_name,
        c.email as customer_email,
        c.name as customer_name
      FROM service_orders so
      JOIN shop_services ss ON so.service_id = ss.service_id
      LEFT JOIN customers c ON LOWER(so.customer_address) = LOWER(c.address)
      WHERE so.order_id = $1 AND so.shop_id = $2`,
      [orderId, shopId]
    );

    if (orderResult.rows.length === 0) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const order = orderResult.rows[0];

    // Check if order is eligible for payment link
    if (order.status !== 'pending' || order.payment_status !== 'pending') {
      res.status(400).json({
        error: 'Order is not awaiting payment',
        status: order.status,
        paymentStatus: order.payment_status
      });
      return;
    }

    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      res.status(500).json({ error: 'Payment processing is not configured' });
      return;
    }

    // Create new Stripe Checkout Session
    const session = await getStripe().checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: order.service_name,
            description: `Appointment at ${shop.name} on ${order.booking_date} at ${order.booking_time_slot.substring(0, 5)}`,
          },
          unit_amount: Math.round(order.total_amount * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/customer/bookings?payment=success&orderId=${orderId}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/customer/bookings?payment=cancelled&orderId=${orderId}`,
      customer_email: order.customer_email || undefined,
      metadata: {
        orderId: orderId,
        shopId: shopId,
        serviceId: order.service_id,
        bookingType: 'manual_booking_payment',
      },
      expires_at: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
    });

    // Update order with new session ID
    await pool.query(
      `UPDATE service_orders SET stripe_session_id = $1 WHERE order_id = $2`,
      [session.id, orderId]
    );

    // Send email if requested and customer has email
    if (sendEmail && order.customer_email && session.url) {
      try {
        await emailService.sendPaymentLinkEmail(
          order.customer_email,
          order.customer_name || 'Customer',
          {
            shopName: shop.name,
            serviceName: order.service_name,
            bookingDate: order.booking_date,
            bookingTime: order.booking_time_slot.substring(0, 5),
            amount: order.total_amount,
            paymentLink: session.url,
            expiresIn: '24 hours',
          }
        );
      } catch (emailError) {
        console.error('Failed to send payment email:', emailError);
        // Continue anyway, payment link was created successfully
      }
    }

    res.json({
      success: true,
      paymentLink: session.url,
      sessionId: session.id,
      expiresAt: new Date(session.expires_at! * 1000).toISOString(),
      emailSent: sendEmail && order.customer_email ? true : false,
      order: {
        orderId: order.order_id,
        serviceName: order.service_name,
        amount: parseFloat(order.total_amount),
        bookingDate: order.booking_date,
        bookingTime: order.booking_time_slot,
        customerEmail: order.customer_email
      }
    });

  } catch (error) {
    console.error('Error regenerating payment link:', error);
    res.status(500).json({
      error: 'Failed to regenerate payment link',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
