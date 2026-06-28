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
import { logger } from '../../../utils/logger';
import { isWelcomeRcnEnabled, resolveWelcomeRcnAmount } from '../../../config/welcomeRcn';

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
      'SELECT address, email, phone, welcome_rcn_granted_at FROM customers WHERE LOWER(address) = LOWER($1)',
      [customerAddress]
    );

    if (realCustomer.rows.length === 0) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    // Get the placeholder customer
    const placeholderCustomer = await pool.query(
      'SELECT address, email, phone, name, import_source, home_shop_id FROM customers WHERE LOWER(address) = LOWER($1)',
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

      // Welcome-RCN amount actually granted on this claim (0 = none). Set inside the
      // SAVEPOINT block below; read after COMMIT for the notification + response.
      let welcomeRcnGranted = 0;

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

      // Transfer notifications (column is receiver_address — using recipient_address here threw
      // mid-transaction and silently rolled back the ENTIRE claim, so nothing ever transferred).
      await client.query(
        `UPDATE notifications
         SET receiver_address = $1
         WHERE LOWER(receiver_address) = LOWER($2)`,
        [real.address, placeholder.address]
      );

      // Update real customer name if not set
      if (!real.name && placeholder.name) {
        await client.query(
          `UPDATE customers SET name = $1 WHERE LOWER(address) = LOWER($2)`,
          [placeholder.name, real.address]
        );
      }

      // Mark the placeholder as claimed by clearing its contact, so it can no longer be matched or
      // re-claimed (checkClaimable matches on email/phone). We intentionally do NOT rename the
      // address: it's the PK and is FK-referenced (e.g. ad_leads.customer_id), and the old
      // `${address}_archived_${ts}` value overflowed varchar(42) — both of which silently rolled
      // back the entire claim. Data has already been transferred off this row above.
      await client.query(
        `UPDATE customers SET email = NULL, phone = NULL
         WHERE LOWER(address) = LOWER($1)`,
        [placeholder.address]
      );

      // Welcome RCN on claim — the migration conversion incentive. Granted only when this is an
      // IMPORTED placeholder (Square→FixFlow win-back), behind ENABLE_WELCOME_RCN, shop-funded
      // and opt-in. Off-chain credit only (no on-chain mint). One grant per customer, EVER.
      //
      // Wrapped in a SAVEPOINT so a grant failure (e.g. shop balance race) rolls back ONLY the
      // grant, never the claim itself — the claim is the contract; the reward is best-effort.
      // The customer-facing notification is sent AFTER commit (also best-effort) so it can never
      // roll back the grant. See docs/.../welcome-rcn-on-claim-scope.md.
      const fundingShopId: string | null = placeholder.home_shop_id || null;
      if (
        isWelcomeRcnEnabled() &&
        placeholder.import_source &&
        !real.welcome_rcn_granted_at &&
        fundingShopId
      ) {
        await client.query('SAVEPOINT welcome_rcn');
        try {
          // Lock the funding shop row so concurrent grants can't double-spend its balance.
          const shopRes = await client.query(
            `SELECT welcome_rcn_enabled, welcome_rcn_amount, COALESCE(purchased_rcn_balance, 0) AS balance
               FROM shops WHERE shop_id = $1 FOR UPDATE`,
            [fundingShopId]
          );
          const shopRow = shopRes.rows[0];
          if (shopRow && shopRow.welcome_rcn_enabled === true) {
            const override =
              shopRow.welcome_rcn_amount != null ? parseFloat(shopRow.welcome_rcn_amount) : null;
            const amount = resolveWelcomeRcnAmount(override);
            const balance = parseFloat(shopRow.balance) || 0;

            if (amount > 0 && balance >= amount) {
              // Credit the customer — the `welcome_rcn_granted_at IS NULL` guard in the WHERE makes
              // this the atomic one-grant-per-customer gate (wins any concurrent claim race).
              const credited = await client.query(
                `UPDATE customers
                    SET current_rcn_balance = COALESCE(current_rcn_balance, 0) + $1,
                        welcome_rcn_granted_at = now()
                  WHERE LOWER(address) = LOWER($2) AND welcome_rcn_granted_at IS NULL
                  RETURNING address`,
                [amount, real.address]
              );

              if (credited.rows.length > 0) {
                await client.query(
                  `INSERT INTO customer_rcn_sources (
                     customer_address, source_type, source_shop_id, amount,
                     transaction_id, is_redeemable, metadata
                   ) VALUES ($1, 'migration_welcome', $2, $3, $4, true, $5)`,
                  [
                    real.address.toLowerCase(),
                    fundingShopId,
                    amount,
                    `welcome_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                    JSON.stringify({
                      reason: 'Welcome RCN on account claim (migration)',
                      claimedFrom: placeholder.address,
                      importSource: placeholder.import_source,
                    }),
                  ]
                );
                // Debit the shop's purchased RCN balance (it funds its own win-back).
                await client.query(
                  `UPDATE shops SET purchased_rcn_balance = COALESCE(purchased_rcn_balance, 0) - $1
                    WHERE shop_id = $2`,
                  [amount, fundingShopId]
                );
                welcomeRcnGranted = amount;
              }
            }
          }
          await client.query('RELEASE SAVEPOINT welcome_rcn');
        } catch (grantErr) {
          await client.query('ROLLBACK TO SAVEPOINT welcome_rcn');
          welcomeRcnGranted = 0;
          logger.warn('Welcome RCN grant skipped (claim still succeeds)', {
            customerAddress: real.address,
            fundingShopId,
            error: grantErr instanceof Error ? grantErr.message : String(grantErr),
          });
        }
      }

      await client.query('COMMIT');

      // Notify the customer about their welcome RCN — AFTER commit, best-effort. A notification
      // failure must never undo a committed grant, so it runs outside the transaction and any
      // error is swallowed (the RCN is already in their balance regardless).
      if (welcomeRcnGranted > 0) {
        try {
          await pool.query(
            `INSERT INTO notifications (sender_address, receiver_address, notification_type, message, metadata)
             VALUES ($1, $2, 'welcome_rcn', $3, $4)`,
            [
              (fundingShopId || 'system').toLowerCase(),
              real.address.toLowerCase(),
              `Welcome to FixFlow! You've received ${welcomeRcnGranted} RCN as a welcome reward — it's already in your balance.`,
              JSON.stringify({ amount: welcomeRcnGranted, reason: 'migration_welcome', shopId: fundingShopId }),
            ]
          );
        } catch (notifyErr) {
          logger.warn('Welcome RCN notification failed (grant unaffected)', {
            customerAddress: real.address,
            error: notifyErr instanceof Error ? notifyErr.message : String(notifyErr),
          });
        }
      }

      res.json({
        success: true,
        message: 'Account claimed successfully',
        transferredOrders,
        welcomeRcnGranted,
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
