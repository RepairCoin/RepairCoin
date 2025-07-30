import { Router, Request, Response } from 'express';
import { databaseService } from '../../../services/DatabaseService';
import { logger } from '../../../utils/logger';
import { requireAdmin } from '../../../middleware/auth';

const router = Router();

// Get token circulation metrics
router.get('/token-circulation', requireAdmin, async (req: Request, res: Response) => {
  try {
    const metrics = await databaseService.getTokenCirculationMetrics();
    
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
    const rankings = await databaseService.getShopPerformanceRankings(limit);
    
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
      offset = '0'
    } = req.query;
    
    const logs = await databaseService.getAdminActivityLogs({
      adminAddress: adminAddress as string,
      actionType: actionType as string,
      entityType: entityType as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
    
    res.json({
      success: true,
      data: logs
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
    
    const alerts = await databaseService.getAlerts({
      unreadOnly: unreadOnly === 'true',
      severity: severity as string,
      alertType: alertType as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
    
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
    await databaseService.markAlertAsRead(alertId);
    
    // Log admin action
    await databaseService.logAdminActivity({
      adminAddress: req.user?.address || 'system',
      actionType: 'alert_read',
      actionDescription: 'Marked alert as read',
      entityType: 'alert',
      entityId: alertId.toString(),
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
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
    await databaseService.resolveAlert(alertId, req.user?.address || 'system');
    
    // Log admin action
    await databaseService.logAdminActivity({
      adminAddress: req.user?.address || 'system',
      actionType: 'alert_resolved',
      actionDescription: 'Resolved alert',
      entityType: 'alert',
      entityId: alertId.toString(),
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
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
    // Run all monitoring checks
    await Promise.all([
      databaseService.checkLowTreasuryBalance(),
      databaseService.checkPendingApplications(),
      databaseService.checkUnusualActivity()
    ]);
    
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

export default router;