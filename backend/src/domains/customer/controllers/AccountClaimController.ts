/**
 * Account Claim Controller
 *
 * Handles merging placeholder customer accounts (created via manual booking)
 * with real customer accounts when they sign up with their wallet.
 *
 * Created: February 19, 2026
 */

import { Request, Response } from 'express';
import { getSharedPool } from '../../../utils/database-pool';

const pool = getSharedPool();

// Placeholder wallet prefix
const PLACEHOLDER_PREFIX = '0xmanual';

/**
 * Check if a wallet address is a placeholder
 */
export const isPlaceholderWallet = (address: string): boolean => {
  return address?.toLowerCase().startsWith(PLACEHOLDER_PREFIX);
};

/**
 * Check for claimable accounts
 * GET /api/customers/claim/check
 *
 * Checks if the authenticated user's email or phone matches any placeholder accounts
 */
export const checkClaimableAccounts = async (req: Request, res: Response): Promise<void> => {
  try {
    const customerAddress = req.user?.address;

    if (!customerAddress) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Don't allow placeholder accounts to claim
    if (isPlaceholderWallet(customerAddress)) {
      res.json({
        success: true,
        claimable: false,
        message: 'Placeholder accounts cannot claim other accounts'
      });
      return;
    }

    // Get the real customer's email and phone
    const realCustomer = await pool.query(
      'SELECT email, phone FROM customers WHERE LOWER(address) = LOWER($1)',
      [customerAddress]
    );

    if (realCustomer.rows.length === 0) {
      res.json({
        success: true,
        claimable: false,
        message: 'Customer not found'
      });
      return;
    }

    const { email, phone } = realCustomer.rows[0];

    if (!email && !phone) {
      res.json({
        success: true,
        claimable: false,
        message: 'No email or phone on file to match'
      });
      return;
    }

    // Find placeholder accounts with matching email or phone
    const placeholderAccounts = await pool.query(
      `SELECT
        c.address,
        c.email,
        c.phone,
        c.name,
        c.created_at,
        COUNT(DISTINCT so.order_id) as booking_count,
        COALESCE(SUM(so.total_amount), 0) as total_spent
      FROM customers c
      LEFT JOIN service_orders so ON LOWER(so.customer_address) = LOWER(c.address)
      WHERE LOWER(c.address) LIKE $1
        AND (
          (c.email IS NOT NULL AND LOWER(c.email) = LOWER($2))
          OR (c.phone IS NOT NULL AND c.phone = $3)
        )
      GROUP BY c.address, c.email, c.phone, c.name, c.created_at`,
      [`${PLACEHOLDER_PREFIX}%`, email || '', phone || '']
    );

    if (placeholderAccounts.rows.length === 0) {
      res.json({
        success: true,
        claimable: false,
        message: 'No claimable accounts found'
      });
      return;
    }

    res.json({
      success: true,
      claimable: true,
      accounts: placeholderAccounts.rows.map(acc => ({
        placeholderAddress: acc.address,
        email: acc.email,
        phone: acc.phone,
        name: acc.name,
        bookingCount: parseInt(acc.booking_count),
        totalSpent: parseFloat(acc.total_spent),
        createdAt: acc.created_at
      }))
    });

  } catch (error) {
    console.error('Error checking claimable accounts:', error);
    res.status(500).json({
      error: 'Failed to check claimable accounts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Claim a placeholder account
 * POST /api/customers/claim
 *
 * Transfers bookings and data from a placeholder account to the real account
 */
export const claimAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const customerAddress = req.user?.address;
    const { placeholderAddress } = req.body;

    if (!customerAddress) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!placeholderAddress) {
      res.status(400).json({ error: 'placeholderAddress is required' });
      return;
    }

    // Validate it's actually a placeholder address
    if (!isPlaceholderWallet(placeholderAddress)) {
      res.status(400).json({ error: 'Invalid placeholder address' });
      return;
    }

    // Don't allow placeholder accounts to claim
    if (isPlaceholderWallet(customerAddress)) {
      res.status(400).json({ error: 'Placeholder accounts cannot claim other accounts' });
      return;
    }

    // Get the real customer
    const realCustomer = await pool.query(
      'SELECT address, email, phone FROM customers WHERE LOWER(address) = LOWER($1)',
      [customerAddress]
    );

    if (realCustomer.rows.length === 0) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    // Get the placeholder customer
    const placeholderCustomer = await pool.query(
      'SELECT address, email, phone, name FROM customers WHERE LOWER(address) = LOWER($1)',
      [placeholderAddress]
    );

    if (placeholderCustomer.rows.length === 0) {
      res.status(404).json({ error: 'Placeholder account not found' });
      return;
    }

    const real = realCustomer.rows[0];
    const placeholder = placeholderCustomer.rows[0];

    // Verify email or phone match
    const emailMatch = real.email && placeholder.email &&
                       real.email.toLowerCase() === placeholder.email.toLowerCase();
    const phoneMatch = real.phone && placeholder.phone &&
                       real.phone === placeholder.phone;

    if (!emailMatch && !phoneMatch) {
      res.status(403).json({
        error: 'Cannot claim this account',
        message: 'Email or phone must match to claim an account'
      });
      return;
    }

    // Start transaction
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Transfer service orders to real customer
      const ordersResult = await client.query(
        `UPDATE service_orders
         SET customer_address = $1
         WHERE LOWER(customer_address) = LOWER($2)
         RETURNING order_id`,
        [real.address, placeholder.address]
      );

      const transferredOrders = ordersResult.rows.length;

      // Transfer RCN balances (if any)
      await client.query(
        `UPDATE customer_rcn_sources
         SET customer_address = $1
         WHERE LOWER(customer_address) = LOWER($2)`,
        [real.address, placeholder.address]
      );

      // Transfer conversations
      await client.query(
        `UPDATE conversations
         SET customer_address = $1
         WHERE LOWER(customer_address) = LOWER($2)`,
        [real.address, placeholder.address]
      );

      // Transfer notifications
      await client.query(
        `UPDATE notifications
         SET recipient_address = $1
         WHERE LOWER(recipient_address) = LOWER($2)`,
        [real.address, placeholder.address]
      );

      // Update real customer name if not set
      if (!real.name && placeholder.name) {
        await client.query(
          `UPDATE customers SET name = $1 WHERE LOWER(address) = LOWER($2)`,
          [placeholder.name, real.address]
        );
      }

      // Archive the placeholder customer (add suffix to address)
      const archivedAddress = `${placeholder.address}_archived_${Date.now()}`;
      await client.query(
        `UPDATE customers
         SET address = $1,
             wallet_address = $1,
             email = NULL,
             phone = NULL
         WHERE LOWER(address) = LOWER($2)`,
        [archivedAddress, placeholder.address]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Account claimed successfully',
        transferredOrders,
        claimedFrom: placeholder.address,
        claimedTo: real.address
      });

    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error claiming account:', error);
    res.status(500).json({
      error: 'Failed to claim account',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Check for claimable accounts by email/phone (during signup)
 * POST /api/customers/claim/check-by-contact
 *
 * Used during signup to check if there are placeholder accounts to claim
 */
export const checkClaimableByContact = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, phone } = req.body;

    if (!email && !phone) {
      res.status(400).json({ error: 'Email or phone is required' });
      return;
    }

    // Find placeholder accounts with matching email or phone
    const placeholderAccounts = await pool.query(
      `SELECT
        c.address,
        c.email,
        c.phone,
        c.name,
        c.created_at,
        COUNT(DISTINCT so.order_id) as booking_count
      FROM customers c
      LEFT JOIN service_orders so ON LOWER(so.customer_address) = LOWER(c.address)
      WHERE LOWER(c.address) LIKE $1
        AND (
          ($2 IS NOT NULL AND $2 != '' AND LOWER(c.email) = LOWER($2))
          OR ($3 IS NOT NULL AND $3 != '' AND c.phone = $3)
        )
      GROUP BY c.address, c.email, c.phone, c.name, c.created_at`,
      [`${PLACEHOLDER_PREFIX}%`, email || '', phone || '']
    );

    if (placeholderAccounts.rows.length === 0) {
      res.json({
        success: true,
        hasClaimable: false
      });
      return;
    }

    res.json({
      success: true,
      hasClaimable: true,
      accountCount: placeholderAccounts.rows.length,
      totalBookings: placeholderAccounts.rows.reduce((sum, acc) => sum + parseInt(acc.booking_count), 0)
    });

  } catch (error) {
    console.error('Error checking claimable accounts by contact:', error);
    res.status(500).json({
      error: 'Failed to check accounts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
