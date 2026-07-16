// backend/src/domains/messaging/controllers/MessagingAdminController.ts
import { Request, Response } from 'express';
import { CustomerMessagingCostRepository } from '../../../repositories/CustomerMessagingCostRepository';
import { CustomerConsentRepository } from '../../../repositories/CustomerConsentRepository';
import { logger } from '../../../utils/logger';

/**
 * Admin-only read views over the off-channel AI-messaging ledgers (Phase 3):
 *   - customer_messaging_costs  → who-pays economics (AI vs carrier cost per shop)
 *   - customer_messaging_consent → opt-in counts by channel/status
 * Surfaced so admins/management can see the true cost of SMS/WhatsApp auto-replies (D5).
 */
export class MessagingAdminController {
  private costRepo: CustomerMessagingCostRepository;
  private consentRepo: CustomerConsentRepository;

  constructor(deps: {
    costRepo?: CustomerMessagingCostRepository;
    consentRepo?: CustomerConsentRepository;
  } = {}) {
    this.costRepo = deps.costRepo ?? new CustomerMessagingCostRepository();
    this.consentRepo = deps.consentRepo ?? new CustomerConsentRepository();
  }

  /** GET /api/messages/admin/messaging-costs?days=30 (days optional → all-time). */
  getMessagingCostSummary = async (req: Request, res: Response): Promise<Response> => {
    try {
      const daysRaw = req.query.days;
      const days = typeof daysRaw === 'string' ? parseInt(daysRaw, 10) : NaN;
      const since =
        Number.isFinite(days) && days > 0 ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : undefined;

      const [{ shops, grandTotal }, consent] = await Promise.all([
        this.costRepo.getAllShopsSummary(since),
        this.consentRepo.getSummary(),
      ]);

      return res.json({
        success: true,
        data: {
          periodDays: since ? days : null, // null = all-time
          grandTotal,
          shops,
          consent,
        },
      });
    } catch (error) {
      logger.error('MessagingAdminController.getMessagingCostSummary failed:', error);
      return res.status(500).json({ success: false, error: 'Failed to load messaging cost summary' });
    }
  };
}
