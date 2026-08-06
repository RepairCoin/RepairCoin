// Shop to-do items — see migrations/265_create_shop_tasks.sql for why this table exists at all.
//
// The workflow action writes here; the Tasks card on the shop dashboard reads and completes. Both
// halves have to ship together: an action that files tasks nobody can see reports success while
// nothing gets actioned, which is worse than not having the action.

import { BaseRepository } from './BaseRepository';
import { logger } from '../utils/logger';

export type ShopTaskStatus = 'open' | 'done' | 'dismissed';
export type ShopTaskSource = 'workflow' | 'manual';

export interface ShopTask {
  id: string;
  shopId: string;
  title: string;
  body: string | null;
  source: ShopTaskSource;
  sourceRuleId: string | null;
  customerAddress: string | null;
  orderId: string | null;
  status: ShopTaskStatus;
  dueAt: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface CreateShopTaskParams {
  shopId: string;
  title: string;
  body?: string | null;
  source?: ShopTaskSource;
  sourceRuleId?: string | null;
  customerAddress?: string | null;
  orderId?: string | null;
  dueAt?: Date | null;
}

const row = (r: any): ShopTask => ({
  id: r.id,
  shopId: r.shop_id,
  title: r.title,
  body: r.body ?? null,
  source: r.source,
  sourceRuleId: r.source_rule_id ?? null,
  customerAddress: r.customer_address ?? null,
  orderId: r.order_id ?? null,
  status: r.status,
  dueAt: r.due_at ? new Date(r.due_at).toISOString() : null,
  createdAt: new Date(r.created_at).toISOString(),
  completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : null,
});

export class ShopTaskRepository extends BaseRepository {
  async create(params: CreateShopTaskParams): Promise<ShopTask> {
    const res = await this.pool.query(
      `INSERT INTO shop_tasks
         (shop_id, title, body, source, source_rule_id, customer_address, order_id, due_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        params.shopId,
        params.title,
        params.body ?? null,
        params.source ?? 'workflow',
        params.sourceRuleId ?? null,
        params.customerAddress ? params.customerAddress.toLowerCase() : null,
        params.orderId ?? null,
        params.dueAt ?? null,
      ]
    );
    return row(res.rows[0]);
  }

  /**
   * Is there already an OPEN task from this rule about this thing?
   *
   * The dedup that stops a recurring trigger stacking ten copies of the same reminder. Scoped to open
   * on purpose: once the shop has completed or dismissed it, the same trigger firing again is a new
   * occurrence and deserves a new task — a monthly "chase the supplier" that could only ever be
   * created once would be useless after the first month.
   *
   * `IS NOT DISTINCT FROM` rather than `=` because both subject columns are nullable, and `= NULL` is
   * never true — a task about nothing in particular would dedup against nothing and stack forever.
   */
  async hasOpenTaskFromRule(
    ruleId: string,
    subject: { customerAddress?: string | null; orderId?: string | null }
  ): Promise<boolean> {
    const res = await this.pool.query(
      `SELECT 1 FROM shop_tasks
        WHERE source_rule_id = $1
          AND status = 'open'
          AND customer_address IS NOT DISTINCT FROM $2
          AND order_id IS NOT DISTINCT FROM $3
        LIMIT 1`,
      [
        ruleId,
        subject.customerAddress ? subject.customerAddress.toLowerCase() : null,
        subject.orderId ?? null,
      ]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async list(
    shopId: string,
    opts: { status?: ShopTaskStatus; limit?: number; offset?: number } = {}
  ): Promise<{ tasks: ShopTask[]; total: number }> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
    const offset = Math.max(opts.offset ?? 0, 0);
    const params: any[] = [shopId];
    let where = 'shop_id = $1';
    if (opts.status) {
      params.push(opts.status);
      where += ` AND status = $${params.length}`;
    }

    const [rows, count] = await Promise.all([
      this.pool.query(
        `SELECT * FROM shop_tasks WHERE ${where}
          ORDER BY status = 'open' DESC, created_at DESC
          LIMIT ${limit} OFFSET ${offset}`,
        params
      ),
      this.pool.query(`SELECT COUNT(*)::int n FROM shop_tasks WHERE ${where}`, params),
    ]);
    return { tasks: rows.rows.map(row), total: count.rows[0].n };
  }

  async countOpen(shopId: string): Promise<number> {
    const res = await this.pool.query(
      `SELECT COUNT(*)::int n FROM shop_tasks WHERE shop_id = $1 AND status = 'open'`,
      [shopId]
    );
    return res.rows[0].n;
  }

  /**
   * Shop-scoped by design: the id alone is not enough to authorise a write. Returns null when the task
   * does not exist OR belongs to someone else, so a caller cannot tell the two apart.
   */
  async setStatus(
    shopId: string,
    taskId: string,
    status: Exclude<ShopTaskStatus, 'open'> | 'open',
    memberId?: string | null
  ): Promise<ShopTask | null> {
    try {
      const res = await this.pool.query(
        `UPDATE shop_tasks
            SET status = $3,
                completed_at = CASE WHEN $3 = 'open' THEN NULL ELSE NOW() END,
                completed_by_member_id = CASE WHEN $3 = 'open' THEN NULL ELSE $4 END
          WHERE id = $2 AND shop_id = $1
          RETURNING *`,
        [shopId, taskId, status, memberId ?? null]
      );
      return res.rows[0] ? row(res.rows[0]) : null;
    } catch (error) {
      logger.error('ShopTaskRepository.setStatus failed', {
        shopId, taskId, status, error: (error as Error)?.message,
      });
      throw error;
    }
  }

  async delete(shopId: string, taskId: string): Promise<boolean> {
    const res = await this.pool.query(
      `DELETE FROM shop_tasks WHERE id = $2 AND shop_id = $1`,
      [shopId, taskId]
    );
    return (res.rowCount ?? 0) > 0;
  }
}

let _instance: ShopTaskRepository | null = null;
export function getShopTaskRepository(): ShopTaskRepository {
  if (!_instance) _instance = new ShopTaskRepository();
  return _instance;
}
