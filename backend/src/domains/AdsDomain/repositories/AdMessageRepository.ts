// backend/src/domains/AdsDomain/repositories/AdMessageRepository.ts
//
// Durable shop↔admin message thread (lifecycle Phase 2, decision #4). Per-SHOP,
// two-way, append-only; 'system' rows are auto-posted lifecycle events. This is the
// money audit trail — nothing is overwritten or deleted.

import { BaseRepository } from '../../../repositories/BaseRepository';

export type AdMessageAuthor = 'shop' | 'admin' | 'system';
export type AdMessageKind = 'message' | 'event';

export interface AdMessage {
  id: string;
  shopId: string;
  author: AdMessageAuthor;
  body: string;
  kind: AdMessageKind;
  createdAt: Date;
}

/** One row per shop that has any messages — powers the admin inbox.
 *  `awaitingReply` = the latest non-event message is from the shop (admin owes a reply). */
export interface AdInboxEntry {
  shopId: string;
  shopName: string | null;
  total: number;
  lastBody: string;
  lastAuthor: AdMessageAuthor;
  lastAt: Date;
  awaitingReply: boolean;
  adsAccountConnected: boolean; // §9.6 gate — lets the admin connect a shop pre-request
}

export class AdMessageRepository extends BaseRepository {
  async append(shopId: string, author: AdMessageAuthor, body: string, kind: AdMessageKind = 'message'): Promise<AdMessage> {
    const res = await this.pool.query(
      `INSERT INTO ad_messages (shop_id, author, body, kind) VALUES ($1,$2,$3,$4) RETURNING *`,
      [shopId, author, body.slice(0, 4000), kind]
    );
    return this.mapRow(res.rows[0]);
  }

  /** Auto-post a lifecycle event (subscribe, tier change, request decided, invoice).
   *  Best-effort — callers wrap in try/catch so a thread write never breaks a flow. */
  async postEvent(shopId: string, body: string): Promise<void> {
    await this.append(shopId, 'system', body, 'event');
  }

  async listByShop(shopId: string, limit = 200): Promise<AdMessage[]> {
    const res = await this.pool.query(
      `SELECT * FROM ad_messages WHERE shop_id = $1 ORDER BY created_at ASC LIMIT $2`,
      [shopId, limit]
    );
    return res.rows.map((r) => this.mapRow(r));
  }

  /** Admin inbox: every shop with at least one message, newest activity first.
   *  Single pass — DISTINCT ON for the latest row, aggregates folded in via window funcs. */
  async inboxSummary(): Promise<AdInboxEntry[]> {
    const res = await this.pool.query(
      `SELECT DISTINCT ON (m.shop_id)
         m.shop_id,
         s.name AS shop_name,
         s.ads_account_connected,
         COUNT(*)            OVER (PARTITION BY m.shop_id) AS total,
         m.body              AS last_body,
         m.author           AS last_author,
         m.created_at       AS last_at,
         ( SELECT x.author = 'shop'
             FROM ad_messages x
            WHERE x.shop_id = m.shop_id AND x.kind = 'message'
            ORDER BY x.created_at DESC LIMIT 1 ) AS awaiting_reply
       FROM ad_messages m
       LEFT JOIN shops s ON s.shop_id = m.shop_id
       ORDER BY m.shop_id, m.created_at DESC`
    );
    return res.rows
      .map((r) => ({
        shopId: r.shop_id,
        shopName: r.shop_name ?? null,
        total: Number(r.total),
        lastBody: r.last_body,
        lastAuthor: r.last_author as AdMessageAuthor,
        lastAt: r.last_at,
        awaitingReply: r.awaiting_reply === true,
        adsAccountConnected: r.ads_account_connected === true,
      }))
      .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
  }

  private mapRow(r: any): AdMessage {
    return {
      id: r.id,
      shopId: r.shop_id,
      author: r.author,
      body: r.body,
      kind: r.kind,
      createdAt: r.created_at,
    };
  }
}
