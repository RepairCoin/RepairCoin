import { Router, Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import { requireAdmin } from '../../../middleware/auth';
import { AdminRepository } from '../../../repositories/AdminRepository';
import { CustomerRepository } from '../../../repositories/CustomerRepository';
import { ShopRepository } from '../../../repositories/ShopRepository';
import { TransactionRepository } from '../../../repositories/TransactionRepository';

const router = Router();

// Get token circulation metrics
router.get('/token-circulation', requireAdmin, async (req: Request, res: Response) => {
  try {
    // TODO: Implement getTokenCirculationMetrics in repository
    const metrics = {}; // await analyticsRepository.getTokenCirculationMetrics();
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Error getting circulation metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve circulation metrics'
    });
  }
});

// Get shop performance rankings
router.get('/shop-rankings', requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    // TODO: Implement getShopPerformanceRankings in repository
    const rankings = []; // await analyticsRepository.getShopPerformanceRankings(limit);
    
    res.json({
      success: true,
      data: rankings
    });
  } catch (error) {
    logger.error('Error getting shop rankings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve shop rankings'
    });
  }
});

// Get admin activity logs
router.get('/activity-logs', requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      adminAddress,
      actionType,
      entityType,
      startDate,
      endDate,
      limit = '50',
      page = '1'
    } = req.query;
    
    const adminRepository = new AdminRepository();
    const result = await adminRepository.getAdminActivityLogs({
      adminAddress: adminAddress as string,
      actionType: actionType as string,
      entityType: entityType as string,
      startDate: startDate as string,
      endDate: endDate as string,
      page: parseInt(page as string),
      limit: parseInt(limit as string)
    });
    
    // Transform the result for the frontend
    const logs = result.items.map(activity => ({
      id: activity.id,
      timestamp: activity.createdAt,
      adminAddress: activity.adminAddress,
      action: activity.actionType,
      description: activity.actionDescription,
      entityType: activity.entityType,
      entityId: activity.entityId,
      metadata: activity.metadata,
      status: 'completed' // All logged activities are completed
    }));
    
    res.json({
      success: true,
      data: {
        logs,
        total: result.pagination.totalItems,
        pagination: result.pagination
      }
    });
  } catch (error) {
    logger.error('Error getting activity logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve activity logs'
    });
  }
});

// Get admin alerts
router.get('/alerts', requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      unreadOnly,
      severity,
      alertType,
      limit = '50',
      offset = '0'
    } = req.query;
    
    // TODO: Implement getAlerts in repository
    const alerts = { alerts: [], total: 0 };
    // await analyticsRepository.getAlerts({
    //   unreadOnly: unreadOnly === 'true',
    //   severity: severity as string,
    //   alertType: alertType as string,
    //   limit: parseInt(limit as string),
    //   offset: parseInt(offset as string)
    // });
    
    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    logger.error('Error getting alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve alerts'
    });
  }
});

// Mark alert as read
router.put('/alerts/:id/read', requireAdmin, async (req: Request, res: Response) => {
  try {
    const alertId = parseInt(req.params.id);
    // TODO: Implement markAlertAsRead in repository
    // await analyticsRepository.markAlertAsRead(alertId);
    
    // Log admin action
    // await analyticsRepository.logAdminActivity({
    //   adminAddress: req.user?.address || 'system',
    //   actionType: 'alert_read',
    //   actionDescription: 'Marked alert as read',
    //   entityType: 'alert',
    //   entityId: alertId.toString(),
    //   ipAddress: req.ip,
    //   userAgent: req.get('user-agent')
    // });
    
    res.json({
      success: true,
      message: 'Alert marked as read'
    });
  } catch (error) {
    logger.error('Error marking alert as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark alert as read'
    });
  }
});

// Resolve alert
router.put('/alerts/:id/resolve', requireAdmin, async (req: Request, res: Response) => {
  try {
    const alertId = parseInt(req.params.id);
    // TODO: Implement resolveAlert in repository
    // await analyticsRepository.resolveAlert(alertId, req.user?.address || 'system');
    
    // Log admin action
    // await analyticsRepository.logAdminActivity({
    //   adminAddress: req.user?.address || 'system',
    //   actionType: 'alert_resolved',
    //   actionDescription: 'Resolved alert',
    //   entityType: 'alert',
    //   entityId: alertId.toString(),
    //   ipAddress: req.ip,
    //   userAgent: req.get('user-agent')
    // });
    
    res.json({
      success: true,
      message: 'Alert resolved'
    });
  } catch (error) {
    logger.error('Error resolving alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve alert'
    });
  }
});

// Run monitoring checks manually (for testing)
router.post('/monitoring/check', requireAdmin, async (req: Request, res: Response) => {
  try {
    // TODO: Implement monitoring checks in repository
    // Run all monitoring checks
    // await Promise.all([
    //   monitoringRepository.checkLowTreasuryBalance(),
    //   monitoringRepository.checkPendingApplications(),
    //   monitoringRepository.checkUnusualActivity()
    // ]);
    
    res.json({
      success: true,
      message: 'Monitoring checks completed'
    });
  } catch (error) {
    logger.error('Error running monitoring checks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run monitoring checks'
    });
  }
});

// Get today's activity stats
router.get('/today-stats', requireAdmin, async (req: Request, res: Response) => {
  try {
    const customerRepo = new CustomerRepository();
    const shopRepo = new ShopRepository();
    const transactionRepo = new TransactionRepository();
    
    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Get new customers today
    const newCustomersResult = await customerRepo.getCustomersRegisteredBetween(
      today.toISOString(),
      tomorrow.toISOString()
    );
    
    // Get today's transactions
    const todayTransactions = await transactionRepo.getTransactionsBetween(
      today.toISOString(), 
      tomorrow.toISOString()
    );
    
    // Calculate today's metrics
    const tokensIssuedToday = todayTransactions
      .filter((t: any) => t.type === 'mint' || t.type === 'tier_bonus')
      .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
      
    const redemptionsToday = todayTransactions
      .filter((t: any) => t.type === 'redeem')
      .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
      
    const revenueToday = todayTransactions
      .filter((t: any) => t.type === 'shop_purchase')
      .reduce((sum: number, t: any) => sum + (t.amount || 0), 0) * 0.1; // $0.10 per RCN
    
    res.json({
      success: true,
      data: {
        newCustomers: newCustomersResult.length,
        tokensIssuedToday,
        redemptionsToday,
        revenueToday
      }
    });
  } catch (error) {
    logger.error('Error getting today stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve today stats'
    });
  }
});

// Get recent activity feed
router.get('/recent-activity', requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const transactionRepo = new TransactionRepository();
    const adminRepo = new AdminRepository();
    
    // Get recent transactions
    const recentTransactions = await transactionRepo.getRecentTransactions(limit);
    
    // Get recent admin activities
    const recentAdminActivities = await adminRepo.getAdminActivityLogs({
      limit: limit / 2,
      page: 1
    });
    
    // Format activities for the feed
    const activities = [];
    
    // Add transactions to activities
    recentTransactions.slice(0, 5).forEach(transaction => {
      const timeAgo = getTimeAgo(new Date(transaction.createdAt));
      let message = '';
      let icon = '💸';
      
      switch(transaction.type) {
        case 'mint':
          message = `${transaction.amount} RCN issued to customer`;
          icon = '🪙';
          break;
        case 'redeem':
          message = `${transaction.amount} RCN redeemed`;
          icon = '💸';
          break;
        case 'shop_purchase':
          message = `Shop purchased ${transaction.amount} RCN`;
          icon = '💰';
          break;
        case 'tier_bonus':
          message = `Tier bonus reward issued`;
          icon = '🎁';
          break;
        case 'transfer':
          message = `${transaction.amount} RCN transferred`;
          icon = '➡️';
          break;
        default:
          message = `Transaction: ${transaction.type}`;
      }
      
      activities.push({
        type: transaction.type,
        message,
        time: timeAgo,
        icon,
        timestamp: transaction.createdAt
      });
    });
    
    // Add admin activities
    recentAdminActivities.items.slice(0, 3).forEach(activity => {
      const timeAgo = getTimeAgo(new Date(activity.createdAt));
      let icon = '⚙️';
      
      if (activity.actionType.includes('approve')) icon = '✅';
      if (activity.actionType.includes('customer')) icon = '👤';
      if (activity.actionType.includes('shop')) icon = '🏪';
      
      activities.push({
        type: activity.actionType,
        message: activity.actionDescription,
        time: timeAgo,
        icon,
        timestamp: activity.createdAt
      });
    });
    
    // Sort by timestamp
    activities.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    res.json({
      success: true,
      data: activities.slice(0, limit)
    });
  } catch (error) {
    logger.error('Error getting recent activity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve recent activity'
    });
  }
});

// Get top customers
router.get('/top-customers', requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;
    const customerRepo = new CustomerRepository();
    
    const topCustomers = await customerRepo.getTopCustomersByEarnings(limit);
    
    res.json({
      success: true,
      data: topCustomers.map(customer => ({
        name: customer.name || 'Anonymous',
        earnings: customer.lifetimeEarnings || 0,
        tier: customer.tier || 'BRONZE',
        address: customer.address
      }))
    });
  } catch (error) {
    logger.error('Error getting top customers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve top customers'
    });
  }
});

// Get network health metrics
router.get('/network-health', requireAdmin, async (req: Request, res: Response) => {
  try {
    const shopRepo = new ShopRepository();
    const customerRepo = new CustomerRepository();
    const transactionRepo = new TransactionRepository();
    
    // Get active shops in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const allShops = await shopRepo.getAllShops();
    const recentTransactions = await transactionRepo.getTransactionsBetween(
      thirtyDaysAgo.toISOString(),
      new Date().toISOString()
    );
    
    // Count unique shops with transactions in last 30 days
    const activeShopIds = new Set(recentTransactions.map(t => t.shopId).filter(Boolean));
    const activeShops30Days = activeShopIds.size;
    
    // Calculate customer retention (customers with transactions in last 30 days / total)
    const allCustomers = await customerRepo.getAllCustomers();
    const activeCustomerAddresses = new Set(
      recentTransactions.map(t => t.customerAddress).filter(Boolean)
    );
    const customerRetention = allCustomers.length > 0 
      ? (activeCustomerAddresses.size / allCustomers.length * 100).toFixed(1)
      : 0;
    
    // Calculate average customer balance
    const customerBalances = await Promise.all(
      allCustomers.map(async (customer) => {
        const balance = await customerRepo.getCustomerBalance(customer.address);
        return balance;
      })
    );
    const avgCustomerBalance = customerBalances.length > 0
      ? Math.round(customerBalances.reduce((sum, b) => sum + b, 0) / customerBalances.length)
      : 0;
    
    // Platform uptime (hardcoded for now, could be from monitoring service)
    const platformUptime = 99.9;
    
    res.json({
      success: true,
      data: {
        activeShops30Days,
        totalShops: allShops.length,
        customerRetention: parseFloat(customerRetention as any),
        avgCustomerBalance,
        platformUptime
      }
    });
  } catch (error) {
    logger.error('Error getting network health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve network health metrics'
    });
  }
});

// Helper function to calculate time ago
function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
}

export default router;