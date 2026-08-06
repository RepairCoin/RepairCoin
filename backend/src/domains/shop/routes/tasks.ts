// Shop to-do list — the surface half of the `create_task` workflow action.
//
// Shipped together with the action deliberately. An action that files tasks nobody can reach reports
// success while nothing gets actioned, which is worse than not having the action at all.
//
// Every write is scoped by shop_id in the query itself, not by checking ownership first and updating
// after — one statement, no window between the check and the write.

import { Router, Request, Response } from 'express';
import { getShopTaskRepository } from '../../../repositories/ShopTaskRepository';
import { logger } from '../../../utils/logger';

const router = Router();
const tasks = () => getShopTaskRepository();

interface AuthenticatedRequest extends Request {
  user?: { address: string; role: string; shopId?: string };
  body: any;
  params: any;
  query: any;
}

const VALID_STATUSES = ['open', 'done', 'dismissed'] as const;
const MAX_TITLE = 200;

/** GET /api/shops/tasks?status=open&limit=50 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) return res.status(401).json({ success: false, error: 'Shop authentication required' });

    const status = req.query.status as string | undefined;
    if (status && !VALID_STATUSES.includes(status as any)) {
      return res.status(400).json({ success: false, error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const { tasks: rows, total } = await tasks().list(shopId, {
      status: status as any,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
    });
    const openCount = await tasks().countOpen(shopId);

    res.json({ success: true, data: { tasks: rows, total, openCount } });
  } catch (error) {
    logger.error('Error listing shop tasks:', error);
    res.status(500).json({ success: false, error: 'Failed to load tasks' });
  }
});

/** POST /api/shops/tasks — a task added by hand, as opposed to by a workflow. */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) return res.status(401).json({ success: false, error: 'Shop authentication required' });

    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    if (!title) return res.status(400).json({ success: false, error: 'title is required' });
    if (title.length > MAX_TITLE) {
      return res.status(400).json({ success: false, error: `title must be ${MAX_TITLE} characters or fewer` });
    }

    const task = await tasks().create({
      shopId,
      title,
      body: typeof req.body?.body === 'string' ? req.body.body : null,
      // 'manual' is not cosmetic: the two age differently, and anything that ever prunes tasks must be
      // able to tell somebody's own note from a machine's suggestion.
      source: 'manual',
      customerAddress: req.body?.customerAddress ?? null,
      orderId: req.body?.orderId ?? null,
      dueAt: req.body?.dueAt ? new Date(req.body.dueAt) : null,
    });
    res.status(201).json({ success: true, data: task });
  } catch (error) {
    logger.error('Error creating shop task:', error);
    res.status(500).json({ success: false, error: 'Failed to create task' });
  }
});

/** PATCH /api/shops/tasks/:id — complete, dismiss, or reopen. */
router.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) return res.status(401).json({ success: false, error: 'Shop authentication required' });

    const status = req.body?.status;
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const updated = await tasks().setStatus(shopId, req.params.id, status);
    // 404 for both "no such task" and "not yours" — a shop must not be able to probe for the existence
    // of another shop's rows.
    if (!updated) return res.status(404).json({ success: false, error: 'Task not found' });

    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Error updating shop task:', error);
    res.status(500).json({ success: false, error: 'Failed to update task' });
  }
});

/** DELETE /api/shops/tasks/:id */
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) return res.status(401).json({ success: false, error: 'Shop authentication required' });

    const removed = await tasks().delete(shopId, req.params.id);
    if (!removed) return res.status(404).json({ success: false, error: 'Task not found' });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting shop task:', error);
    res.status(500).json({ success: false, error: 'Failed to delete task' });
  }
});

export default router;
