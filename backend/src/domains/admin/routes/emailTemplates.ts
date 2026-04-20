import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../../middleware/errorHandler';
import { logger } from '../../../utils/logger';
import { EmailTemplateService } from '../../../services/EmailTemplateService';

const router = Router();
const emailTemplateService = new EmailTemplateService();

/**
 * Get all email templates (optionally filtered by category)
 * GET /admin/settings/email-templates?category=welcome
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { category } = req.query;

  const templates = await emailTemplateService.getTemplates(category as string);

  res.json({
    success: true,
    data: templates
  });
}));

/**
 * Get a single email template by key
 * GET /admin/settings/email-templates/:key
 */
router.get('/:key', asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;

  const template = await emailTemplateService.getTemplate(key);

  if (!template) {
    return res.status(404).json({
      success: false,
      error: `Template ${key} not found`
    });
  }

  res.json({
    success: true,
    data: template
  });
}));

/**
 * Update an email template
 * PUT /admin/settings/email-templates/:key
 */
router.put('/:key', asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;
  const updates = req.body;
  const adminAddress = req.user?.address || 'unknown';

  // Validate required fields
  if (!updates || Object.keys(updates).length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No updates provided'
    });
  }

  const updatedTemplate = await emailTemplateService.updateTemplate(
    key,
    updates,
    adminAddress
  );

  res.json({
    success: true,
    message: 'Template updated successfully',
    data: updatedTemplate
  });
}));

/**
 * Toggle template enabled/disabled
 * PUT /admin/settings/email-templates/:key/toggle
 */
router.put('/:key/toggle', asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;
  const { enabled } = req.body;

  if (typeof enabled !== 'boolean') {
    return res.status(400).json({
      success: false,
      error: 'enabled must be a boolean value'
    });
  }

  await emailTemplateService.toggleTemplate(key, enabled);

  res.json({
    success: true,
    message: `Template ${enabled ? 'enabled' : 'disabled'} successfully`
  });
}));

/**
 * Reset template to default
 * DELETE /admin/settings/email-templates/:key
 */
router.delete('/:key', asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;

  try {
    await emailTemplateService.resetToDefault(key);

    res.json({
      success: true,
      message: 'Template reset to default successfully'
    });
  } catch (error: any) {
    if (error.message.includes('not fully implemented')) {
      return res.status(501).json({
        success: false,
        error: 'Reset to default feature coming soon. For now, manually update the template or re-run migrations.'
      });
    }
    throw error;
  }
}));

/**
 * Preview email template with sample data
 * POST /admin/settings/email-templates/:key/preview
 */
router.post('/:key/preview', asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;
  const { sampleData } = req.body;

  // Generate default sample data if not provided
  const defaultSampleData: Record<string, string> = {
    customerName: 'John Doe',
    shopName: 'RepairShop Pro',
    platformName: 'RepairCoin',
    amount: '50.00',
    amountUsd: '5.00',
    walletAddress: '0x1234...5678',
    serviceName: 'Oil Change',
    bookingDate: new Date().toLocaleDateString(),
    bookingTime: '10:00 AM',
    totalAmount: '75.00',
    transactionId: 'TXN123456',
    newBalance: '125.50',
    shopEmail: 'shop@example.com',
    approvalDate: new Date().toLocaleDateString(),
    purchaseDate: new Date().toLocaleDateString(),
    paymentMethod: 'Credit Card',
    paymentReference: 'PAY-123456',
    totalCost: '500.00',
    submissionDate: new Date().toLocaleDateString(),
    rejectionReason: 'Missing required documentation',
    expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    planName: 'Standard',
    monthlyCost: '500',
    suspensionReason: 'Violation of terms of service',
    suspensionDate: new Date().toLocaleDateString(),
    reinstatementDate: new Date().toLocaleDateString(),
    currentBalance: '85.50',
    resetLink: 'https://repaircoin.ai/reset-password?token=abc123',
    expirationTime: '24 hours',
    cancellationDate: new Date().toLocaleDateString(),
  };

  const mergedData = { ...defaultSampleData, ...sampleData };

  const rendered = await emailTemplateService.renderTemplate(key, mergedData);

  res.json({
    success: true,
    data: {
      subject: rendered.subject,
      bodyHtml: rendered.bodyHtml,
      sampleData: mergedData
    }
  });
}));

/**
 * Send test email
 * POST /admin/settings/email-templates/:key/test
 */
router.post('/:key/test', asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;
  const { recipientEmail } = req.body;

  if (!recipientEmail) {
    return res.status(400).json({
      success: false,
      error: 'recipientEmail is required'
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(recipientEmail)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid email format'
    });
  }

  // Generate sample data
  const sampleData: Record<string, string> = {
    customerName: 'Test User',
    shopName: 'Test Shop',
    platformName: 'RepairCoin',
    amount: '50.00',
    amountUsd: '5.00',
    walletAddress: '0x1234...5678',
    serviceName: 'Test Service',
    bookingDate: new Date().toLocaleDateString(),
    bookingTime: '10:00 AM',
    totalAmount: '75.00',
    transactionId: 'TEST-' + Date.now(),
    newBalance: '125.50',
    shopEmail: recipientEmail,
    approvalDate: new Date().toLocaleDateString(),
  };

  const rendered = await emailTemplateService.renderTemplate(key, sampleData);

  // TODO: Integrate with actual email service (SendGrid, SMTP, etc.)
  // For now, just log and return success
  logger.info('Test email would be sent:', {
    to: recipientEmail,
    subject: rendered.subject,
    templateKey: key
  });

  // Mark template as sent
  await emailTemplateService.markAsSent(key);

  res.json({
    success: true,
    message: `Test email sent to ${recipientEmail}`,
    note: 'Email service integration pending - email was logged but not actually sent'
  });
}));

export default router;
