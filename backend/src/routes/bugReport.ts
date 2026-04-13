import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { RateLimiter, createRateLimitMiddleware } from '../utils/rateLimiter';
import { EmailService } from '../services/EmailService';
import { logger } from '../utils/logger';
import { getSharedPool } from '../utils/database-pool';

const router = Router();

const emailService = new EmailService();

// Rate limit: 5 bug reports per hour per user
const bugReportRateLimiter = new RateLimiter({
  maxRequests: 5,
  windowMs: 60 * 60 * 1000,
  keyGenerator: (address: string) => `bug_report_${address.toLowerCase()}_${Math.floor(Date.now() / (60 * 60 * 1000))}`,
});

const bugReportRateLimit = createRateLimitMiddleware(
  bugReportRateLimiter,
  (req) => (req as any).user?.address || req.ip
);

const VALID_CATEGORIES = [
  'App Crash',
  'Payment Issue',
  'Wallet / Tokens',
  'Booking / Orders',
  'Notifications',
  'Login / Auth',
  'UI / Display',
  'Other',
];

router.post(
  '/',
  authMiddleware,
  bugReportRateLimit,
  asyncHandler(async (req: Request, res: Response) => {
    const { category, title, description } = req.body;
    const user = (req as any).user;

    // Validation
    if (!category || !title || !description) {
      return res.status(400).json({
        success: false,
        error: 'Category, title, and description are required',
      });
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid category',
      });
    }

    if (title.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Title must be 100 characters or less',
      });
    }

    if (description.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Description must be 1000 characters or less',
      });
    }

    // Store bug report in database
    const pool = getSharedPool();
    const result = await pool.query(
      `INSERT INTO bug_reports (wallet_address, role, category, title, description, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'open', NOW())
       RETURNING id, created_at`,
      [user.address, user.role, category, title, description]
    );

    const bugReport = result.rows[0];

    // Send email notification to admin
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.EMAIL_FROM;
    if (adminEmail) {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #FFCC00; background: #1a1a1a; padding: 16px; border-radius: 8px;">
            🐛 New Bug Report #${bugReport.id}
          </h2>
          <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
            <tr><td style="padding: 8px; font-weight: bold; color: #666;">Category</td><td style="padding: 8px;">${category}</td></tr>
            <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold; color: #666;">Title</td><td style="padding: 8px;">${title}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold; color: #666;">Reporter</td><td style="padding: 8px;">${user.address} (${user.role})</td></tr>
            <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold; color: #666;">Date</td><td style="padding: 8px;">${new Date(bugReport.created_at).toLocaleString()}</td></tr>
          </table>
          <div style="margin-top: 16px; padding: 16px; background: #f5f5f5; border-radius: 8px;">
            <h3 style="margin-top: 0; color: #333;">Description</h3>
            <p style="white-space: pre-wrap; color: #555;">${description}</p>
          </div>
        </div>
      `;

      emailService.sendBugReportNotification(adminEmail, bugReport.id, html).catch((err: Error) => {
        logger.error('Failed to send bug report email notification', { error: err.message, bugReportId: bugReport.id });
      });
    }

    logger.info('Bug report submitted', {
      bugReportId: bugReport.id,
      category,
      reporter: user.address,
      role: user.role,
    });

    res.status(201).json({
      success: true,
      data: {
        id: bugReport.id,
        message: 'Bug report submitted successfully. Thank you for your feedback!',
      },
    });
  })
);

export default router;
