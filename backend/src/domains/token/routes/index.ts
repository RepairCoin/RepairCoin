import { Router } from 'express';
import verificationRoutes from './verification';

const router = Router();

// Register verification routes
router.use('/', verificationRoutes);

// Token statistics endpoint
router.get('/stats', async (req, res) => {
  // Token statistics endpoint
  res.json({ message: 'Token stats endpoint' });
});

export default router;