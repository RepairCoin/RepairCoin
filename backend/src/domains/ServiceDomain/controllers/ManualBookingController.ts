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

const pool = getSharedPool();
const notificationService = new NotificationService();
const emailService = new EmailService();

interface ManualBookingRequest {
  customerAddress: string;
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  serviceId: string;
  bookingDate: string; // YYYY-MM-DD
  bookingTimeSlot: string; // HH:MM:SS
  bookingEndTime?: string; // HH:MM:SS
  paymentStatus: 'paid' | 'pending' | 'unpaid';
  notes?: string;
  createNewCustomer?: boolean;
}

/**
 * Create a manual booking
 * POST /api/shops/:shopId/appointments/manual
 */
export const createManualBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const { shopId } = req.params;
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
      res.status(403).json({ error: 'You do not have permission to create bookings for this shop' });
      return;
    }

    const shop = shopCheck.rows[0];

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

    // Validation
    if (!customerAddress || !serviceId || !bookingDate || !bookingTimeSlot || !paymentStatus) {
      res.status(400).json({
        error: 'Missing required fields',
        required: ['customerAddress', 'serviceId', 'bookingDate', 'bookingTimeSlot', 'paymentStatus']
      });
      return;
    }

    // Validate payment status
    if (!['paid', 'pending', 'unpaid'].includes(paymentStatus)) {
      res.status(400).json({ error: 'Invalid payment status. Must be: paid, pending, or unpaid' });
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
    const serviceCheck = await pool.query(
      'SELECT service_id, service_name, price_usd, duration_minutes FROM shop_services WHERE service_id = $1 AND shop_id = $2 AND active = true',
      [serviceId, shopId]
    );

    if (serviceCheck.rows.length === 0) {
      res.status(404).json({ error: 'Service not found or inactive' });
      return;
    }

    const service = serviceCheck.rows[0];

    // Check if customer exists
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

    // Create the manual booking
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
        $1, $2, $3, 'confirmed', $4, $5, $6, $7, 'manual', $8, $9, $10, NOW()
      ) RETURNING order_id, total_amount, created_at`,
      [
        customerData.address,
        shopId,
        serviceId,
        service.price_usd,
        bookingDate,
        bookingTimeSlot,
        bookingEndTime || null,
        shopAdminAddress,
        paymentStatus,
        notes || null
      ]
    );

    const order = orderResult.rows[0];

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
        createdAt: order.created_at
      }
    });

  } catch (error) {
    console.error('Error creating manual booking:', error);
    res.status(500).json({
      error: 'Failed to create booking',
      message: error instanceof Error ? error.message : 'Unknown error'
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
