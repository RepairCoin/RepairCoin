// backend/src/routes/metrics.ts
import { Router } from 'express';
import { requireRole } from '../middleware/auth';
import { metricsCollector } from '../utils/metrics';
import { ResponseHelper } from '../utils/responseHelper';

const router = Router();

// Get system metrics (admin only)
router.get('/', requireRole(['admin']), (req, res) => {
  const timeRange = req.query.timeRange ? parseInt(req.query.timeRange as string) : 3600000;
  const metrics = metricsCollector.getMetrics(timeRange);
  
  ResponseHelper.success(res, {
    ...metrics,
    timeRangeMs: timeRange,
    timestamp: new Date().toISOString()
  });
});

export default router;