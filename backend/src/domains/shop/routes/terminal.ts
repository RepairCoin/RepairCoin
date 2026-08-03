import { Router, Request, Response } from 'express';
import { getStripeTerminalService } from '../../../services/StripeTerminalService';
import { logger } from '../../../utils/logger';
import { authMiddleware, requireRole } from '../../../middleware/auth';

const router = Router();

router.use(authMiddleware, requireRole(['shop']));

/**
 * The service raises 404/409 with messages written for the shop to read. Flattening those into
 * a generic 500 is what turns "finish payment setup first" into an unexplained failure.
 */
const fail = (res: Response, error: unknown, fallback: string) => {
  const status = (error as { status?: number })?.status;
  if (status === 400 || status === 404 || status === 409) {
    return res.status(status).json({
      success: false,
      error: error instanceof Error ? error.message : fallback,
    });
  }
  return res.status(500).json({ success: false, error: fallback });
};

const shopIdOf = (req: Request): string | undefined => req.user?.shopId;

router.get('/terminal/readiness', async (req: Request, res: Response) => {
  const shopId = shopIdOf(req);
  if (!shopId) return res.status(401).json({ success: false, error: 'Shop authentication required' });

  try {
    const readiness = await getStripeTerminalService().getReadiness(shopId);
    return res.json({ success: true, data: readiness });
  } catch (error) {
    logger.error('Failed to read Terminal readiness', {
      shopId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return fail(res, error, 'Failed to read card reader status');
  }
});

router.get('/terminal/locations', async (req: Request, res: Response) => {
  const shopId = shopIdOf(req);
  if (!shopId) return res.status(401).json({ success: false, error: 'Shop authentication required' });

  try {
    const locations = await getStripeTerminalService().listLocations(shopId);
    return res.json({ success: true, data: { locations } });
  } catch (error) {
    logger.error('Failed to list Terminal locations', {
      shopId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return fail(res, error, 'Failed to load reader locations');
  }
});

router.get('/terminal/readers', async (req: Request, res: Response) => {
  const shopId = shopIdOf(req);
  if (!shopId) return res.status(401).json({ success: false, error: 'Shop authentication required' });

  try {
    const readers = await getStripeTerminalService().listReaders(shopId);
    return res.json({ success: true, data: { readers } });
  } catch (error) {
    logger.error('Failed to list Terminal readers', {
      shopId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return fail(res, error, 'Failed to load card readers');
  }
});

router.post('/terminal/readers', async (req: Request, res: Response) => {
  const shopId = shopIdOf(req);
  if (!shopId) return res.status(401).json({ success: false, error: 'Shop authentication required' });

  const registrationCode = String(req.body?.registrationCode ?? '').trim();
  if (!registrationCode) {
    return res.status(400).json({ success: false, error: 'Reader pairing code is required' });
  }

  try {
    const reader = await getStripeTerminalService().registerReader(shopId, {
      registrationCode,
      label: typeof req.body?.label === 'string' ? req.body.label.trim() : undefined,
      locationId: typeof req.body?.locationId === 'string' ? req.body.locationId : undefined,
    });
    return res.json({ success: true, data: { reader } });
  } catch (error) {
    logger.error('Failed to register Terminal reader', {
      shopId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // A wrong or expired pairing code is the shop's most likely mistake, and Stripe's own
    // message says which — pass it through instead of a generic failure.
    if ((error as { type?: string })?.type === 'StripeInvalidRequestError') {
      return res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Could not pair that reader',
      });
    }
    return fail(res, error, 'Failed to pair card reader');
  }
});

router.post('/terminal/readers/:id/default', async (req: Request, res: Response) => {
  const shopId = shopIdOf(req);
  if (!shopId) return res.status(401).json({ success: false, error: 'Shop authentication required' });

  try {
    const reader = await getStripeTerminalService().setDefaultReader(shopId, req.params.id);
    return res.json({ success: true, data: { reader } });
  } catch (error) {
    logger.error('Failed to set default Terminal reader', {
      shopId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return fail(res, error, 'Failed to set default reader');
  }
});

router.delete('/terminal/readers/:id', async (req: Request, res: Response) => {
  const shopId = shopIdOf(req);
  if (!shopId) return res.status(401).json({ success: false, error: 'Shop authentication required' });

  try {
    await getStripeTerminalService().deleteReader(shopId, req.params.id);
    return res.json({ success: true });
  } catch (error) {
    logger.error('Failed to remove Terminal reader', {
      shopId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return fail(res, error, 'Failed to remove card reader');
  }
});

router.post('/terminal/connection-token', async (req: Request, res: Response) => {
  const shopId = shopIdOf(req);
  if (!shopId) return res.status(401).json({ success: false, error: 'Shop authentication required' });

  try {
    const secret = await getStripeTerminalService().createConnectionToken(shopId);
    return res.json({ success: true, data: { secret } });
  } catch (error) {
    logger.error('Failed to create Terminal connection token', {
      shopId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return fail(res, error, 'Failed to connect to card reader');
  }
});

router.post('/terminal/readers/:id/test-payment', async (req: Request, res: Response) => {
  const shopId = shopIdOf(req);
  if (!shopId) return res.status(401).json({ success: false, error: 'Shop authentication required' });

  try {
    const result = await getStripeTerminalService().startTestPayment(shopId, req.params.id);
    return res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Failed to start Terminal test payment', {
      shopId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return fail(res, error, 'Failed to start test payment');
  }
});

router.get('/terminal/test-payment/:paymentIntentId', async (req: Request, res: Response) => {
  const shopId = shopIdOf(req);
  if (!shopId) return res.status(401).json({ success: false, error: 'Shop authentication required' });

  try {
    const result = await getStripeTerminalService().getTestPaymentStatus(
      shopId,
      req.params.paymentIntentId
    );
    return res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Failed to read Terminal test payment', {
      shopId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return fail(res, error, 'Failed to read test payment status');
  }
});

router.post('/terminal/test-payment/cancel', async (req: Request, res: Response) => {
  const shopId = shopIdOf(req);
  if (!shopId) return res.status(401).json({ success: false, error: 'Shop authentication required' });

  const paymentIntentId = String(req.body?.paymentIntentId ?? '').trim();
  if (!paymentIntentId) {
    return res.status(400).json({ success: false, error: 'paymentIntentId is required' });
  }

  try {
    await getStripeTerminalService().cancelTestPayment(shopId, paymentIntentId);
    return res.json({ success: true });
  } catch (error) {
    logger.error('Failed to cancel Terminal test payment', {
      shopId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return fail(res, error, 'Failed to cancel test payment');
  }
});

export default router;
