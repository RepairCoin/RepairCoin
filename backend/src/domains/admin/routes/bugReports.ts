import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../../middleware/errorHandler';
import { getSharedPool } from '../../../utils/database-pool';
import { logger } from '../../../utils/logger';

const router = Router();

// GET /admin/bug-reports - List all bug reports with filtering
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const {
      status,
      category,
      search,
      page = '1',
      limit = '20',
      sort = 'created_at',
      order = 'desc',
    } = req.query;

    const pool = getSharedPool();
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (status && status !== 'all') {
      conditions.push(`br.status = $${paramIndex++}`);
      params.push(status);
    }

    if (category && category !== 'all') {
      conditions.push(`br.category = $${paramIndex++}`);
      params.push(category);
    }

    if (search) {
      conditions.push(`(br.title ILIKE $${paramIndex} OR br.description ILIKE $${paramIndex} OR br.wallet_address ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const allowedSorts = ['created_at', 'status', 'category'];
    const sortColumn = allowedSorts.includes(sort as string) ? sort : 'created_at';
    const sortOrder = (order as string).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM bug_reports br ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT br.id, br.wallet_address, br.role, br.category, br.title, br.description,
              br.status, br.admin_notes, br.created_at, br.updated_at
       FROM bug_reports br
       ${whereClause}
       ORDER BY ${sortColumn} ${sortOrder}
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limitNum, offset]
    );

    res.json({
      success: true,
      data: {
        reports: result.rows,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  })
);

// GET /admin/bug-reports/stats - Bug report statistics
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const pool = getSharedPool();

    const result = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'open') as open,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
        COUNT(*) FILTER (WHERE status = 'closed') as closed
      FROM bug_reports
    `);

    const categoryResult = await pool.query(`
      SELECT category, COUNT(*) as count
      FROM bug_reports
      WHERE status IN ('open', 'in_progress')
      GROUP BY category
      ORDER BY count DESC
    `);

    res.json({
      success: true,
      data: {
        ...result.rows[0],
        categories: categoryResult.rows,
      },
    });
  })
);

// PATCH /admin/bug-reports/:id - Update bug report status/notes
router.patch(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, admin_notes } = req.body;

    const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const pool = getSharedPool();

    const updates: string[] = ['updated_at = NOW()'];
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      updates.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    if (admin_notes !== undefined) {
      updates.push(`admin_notes = $${paramIndex++}`);
      params.push(admin_notes);
    }

    params.push(id);

    const result = await pool.query(
      `UPDATE bug_reports SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Bug report not found' });
    }

    logger.info('Bug report updated by admin', {
      bugReportId: id,
      status,
      adminAddress: (req as any).user?.address,
    });

    res.json({ success: true, data: result.rows[0] });
  })
);

export default router;
