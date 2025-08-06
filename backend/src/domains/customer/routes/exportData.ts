import { Router } from 'express';
import { authMiddleware, requireRole } from '../../../middleware/auth';
import { validateEthereumAddress } from '../../../middleware/errorHandler';
import { customerRepository, transactionRepository } from '../../../repositories';
import { logger } from '../../../utils/logger';
import { json2csv } from 'json-2-csv';

const router = Router();

/**
 * Export customer data as JSON
 * GET /api/customers/:address/export
 */
router.get('/:address/export',
  authMiddleware,
  requireRole(['admin', 'customer']),
  validateEthereumAddress('address'),
  async (req, res) => {
    try {
      const { address } = req.params;
      const { format = 'json' } = req.query;
      
      // Check authorization - customers can only export their own data
      if (req.user?.role === 'customer' && req.user?.address?.toLowerCase() !== address.toLowerCase()) {
        return res.status(403).json({
          success: false,
          error: 'You can only export your own data'
        });
      }

      // Get customer data
      const customer = await customerRepository.getCustomer(address);
      if (!customer) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found'
        });
      }

      // Get transaction history
      const transactions = await transactionRepository.getTransactionsByCustomer(address, 1000);

      // Get referral data
      const referralRepository = new (await import('../../../repositories/ReferralRepository')).ReferralRepository();
      const rcnBreakdown = await referralRepository.getCustomerRcnBySource(address);
      const customerReferrals = await referralRepository.getCustomerReferrals(address);

      // Prepare export data
      const exportData = {
        profile: {
          address: customer.address,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          tier: customer.tier,
          lifetimeEarnings: customer.lifetimeEarnings,
          currentBalance: rcnBreakdown.earned - transactions
            .filter(tx => tx.type === 'redeem')
            .reduce((sum, tx) => sum + tx.amount, 0),
          joinDate: customer.joinDate,
          referralCode: customer.referralCode,
          isActive: customer.isActive
        },
        earnings: {
          totalEarned: rcnBreakdown.earned,
          fromRepairs: rcnBreakdown.byType['shop_repair'] || 0,
          fromReferrals: rcnBreakdown.byType['referral_bonus'] || 0,
          fromTierBonuses: rcnBreakdown.byType['tier_bonus'] || 0,
          fromOther: rcnBreakdown.byType['promotion'] || 0
        },
        referrals: {
          referralCode: customer.referralCode,
          referredByCount: customer.referralCount || 0,
          myReferrals: {
            total: customerReferrals.length,
            successful: customerReferrals.filter(r => r.status === 'completed').length,
            pending: customerReferrals.filter(r => r.status === 'pending').length,
            totalEarned: customerReferrals.filter(r => r.status === 'completed').length * 25
          },
          referralHistory: customerReferrals.map(r => ({
            code: r.referralCode,
            status: r.status,
            refereeAddress: r.refereeAddress,
            createdAt: r.createdAt,
            completedAt: r.completedAt
          }))
        },
        transactions: transactions.map(tx => ({
          id: tx.id,
          type: tx.type,
          amount: tx.amount,
          shopId: tx.shopId,
          reason: tx.reason,
          timestamp: tx.timestamp,
          transactionHash: tx.transactionHash
        }))
      };

      // Handle different export formats
      if (format === 'csv') {
        // Flatten data for CSV
        const csvData = transactions.map(tx => ({
          date: new Date(tx.timestamp).toLocaleDateString(),
          time: new Date(tx.timestamp).toLocaleTimeString(),
          type: tx.type,
          amount: tx.amount,
          shop: tx.shopId || 'N/A',
          reason: tx.reason,
          txHash: tx.transactionHash || 'N/A'
        }));

        const csv = await json2csv(csvData);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="repaircoin-transactions-${address}.csv"`);
        return res.send(csv);
      }

      // Default to JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="repaircoin-data-${address}.json"`);
      res.json({
        success: true,
        exportDate: new Date().toISOString(),
        data: exportData
      });

      logger.info('Customer data exported', {
        address,
        format,
        exportedBy: req.user?.address
      });

    } catch (error) {
      logger.error('Error exporting customer data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export data'
      });
    }
  }
);

export default router;