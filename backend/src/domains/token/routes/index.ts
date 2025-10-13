import { Router } from 'express';
import verificationRoutes from './verification';
import redemptionSessionRoutes from './redemptionSession';
import transferRoutes from './transfer';

const router = Router();

// Register verification routes
router.use('/', verificationRoutes);

// Register redemption session routes
router.use('/redemption-session', redemptionSessionRoutes);

// Register transfer routes
router.use('/', transferRoutes);

// Token statistics endpoint
router.get('/stats', async (req, res) => {
  // Token statistics endpoint
  res.json({ message: 'Token stats endpoint' });
});

export default router;