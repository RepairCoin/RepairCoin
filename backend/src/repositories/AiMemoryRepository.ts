// backend/src/repositories/AiMemoryRepository.ts
//
// Data access for ai_memories (migration 175) — the unified assistant's store of
// the shop owner's STANDING INTENT (preferences/instructions/decisions/
// corrections). Owner-supplied facts-about-behavior, NOT DB-held data facts.
// Small per-shop sets (a handful to a few dozen rows), so reads pull the whole
// active set and rank in-memory (see AiMemoryService).

import { BaseRepository } from './BaseRepository';

export type AiMemoryKind = 'preference' | 'instruction' | 'decision' | 'correction';
export type AiMemorySource = 'explicit' | 'auto';

export interface AiMemory {
  id: string;
  shopId: string;
  scope: string;
  kind: AiMemoryKind;
  customerId: string | null;
  content: string;
  tags: string[];
  source: AiMemorySource;
  pinned: boolean;
  sourceConversationId: string | null;
  confidence: number | null;
  lastReferencedAt: Date | null;
  createdAt: Date;
}

export interface CreateAiMemoryInput {
  shopId: string;
  kind: AiMemoryKind;
  content: string;
  tags?: string[];
  source?: AiMemorySource;
  pinned?: boolean;
  sourceConversationId?: string | null;
  confidence?: number | null;
}

export interface UpdateAiMemoryInput {
  content?: string;
  tags?: string[];
  pinned?: boolean;
}

export class AiMemoryRepository extends BaseRepository {
  async create(input: CreateAiMemoryInput): Promise<AiMemory> {
    const res = await this.pool.query(
      `INSERT INTO ai_memories
         (shop_id, kind, content, tags, source, pinned, source_conversation_id, confidence)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.shopId,
        input.kind,
        input.content,
        input.tags ?? [],
        input.source ?? 'explicit',
        input.pinned ?? false,
        input.sourceConversationId ?? null,
        input.confidence ?? null,
      ]
    );
    return this.mapRow(res.rows[0]);
  }

  /** All non-deleted memories for a shop (small set — ranked in-memory by the service). */
  async listActive(shopId: string): Promise<AiMemory[]> {
    const res = await this.pool.query(
      `SELECT * FROM ai_memories
        WHERE shop_id = $1 AND deleted_at IS NULL
        ORDER BY pinned DESC, COALESCE(last_referenced_at, created_at) DESC`,
      [shopId]
    );
    return res.rows.map((r) => this.mapRow(r));
  }

  /** Bump last_referenced_at for recalled memories (recency + aging signal). */
  async touch(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.pool.query(
      `UPDATE ai_memories SET last_referenced_at = NOW() WHERE id = ANY($1::uuid[])`,
      [ids]
    );
  }

  async update(id: string, shopId: string, fields: UpdateAiMemoryInput): Promise<AiMemory | null> {
    const sets: string[] = [];
    const params: any[] = [];
    if (fields.content !== undefined) { params.push(fields.content); sets.push(`content = $${params.length}`); }
    if (fields.tags !== undefined) { params.push(fields.tags); sets.push(`tags = $${params.length}`); }
    if (fields.pinned !== undefined) { params.push(fields.pinned); sets.push(`pinned = $${params.length}`); }
    if (sets.length === 0) {
      const cur = await this.pool.query(`SELECT * FROM ai_memories WHERE id = $1 AND shop_id = $2`, [id, shopId]);
      return cur.rows[0] ? this.mapRow(cur.rows[0]) : null;
    }
    params.push(id);
    params.push(shopId);
    const res = await this.pool.query(
      `UPDATE ai_memories SET ${sets.join(', ')}
        WHERE id = $${params.length - 1} AND shop_id = $${params.length} AND deleted_at IS NULL
        RETURNING *`,
      params
    );
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  async softDelete(id: string, shopId: string): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE ai_memories SET deleted_at = NOW()
        WHERE id = $1 AND shop_id = $2 AND deleted_at IS NULL`,
      [id, shopId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  /** Soft-delete AUTO + unpinned memories never referenced within the window
   *  (Q2 / Phase 6). Explicit/pinned owner intent is exempt. */
  async purgeStale(staleDays: number): Promise<number> {
    const res = await this.pool.query(
      `UPDATE ai_memories SET deleted_at = NOW()
        WHERE deleted_at IS NULL
          AND source = 'auto'
          AND pinned = false
          AND COALESCE(last_referenced_at, created_at) < NOW() - make_interval(days => $1)`,
      [staleDays]
    );
    return res.rowCount ?? 0;
  }

  private mapRow(r: any): AiMemory {
    return {
      id: r.id,
      shopId: r.shop_id,
      scope: r.scope,
      kind: r.kind,
      customerId: r.customer_id ?? null,
      content: r.content,
      tags: r.tags ?? [],
      source: r.source,
      pinned: r.pinned === true,
      sourceConversationId: r.source_conversation_id ?? null,
      confidence: r.confidence != null ? Number(r.confidence) : null,
      lastReferencedAt: r.last_referenced_at ?? null,
      createdAt: r.created_at,
    };
  }
}
