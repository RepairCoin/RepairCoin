// backend/src/domains/AdsDomain/repositories/GoogleConnectionRepository.ts
//
// Per-shop Google Ads connection (Google plan, Slice 1). Stores the OAuth refresh token (encrypted)
// + the selected customer id on the shops row (migration 194). Mirrors MetaConnectionRepository.

import { BaseRepository } from '../../../repositories/BaseRepository';

export interface GoogleConnection {
  refreshTokenEnc: string | null;
  customerId: string | null;
  managerId: string | null;
  connected: boolean;
}

export class GoogleConnectionRepository extends BaseRepository {
  /** Store the OAuth refresh token (encrypted). Not "connected" until a customer is selected. */
  async saveRefreshToken(shopId: string, refreshTokenEnc: string): Promise<void> {
    await this.pool.query(`UPDATE shops SET google_ads_refresh_token = $2 WHERE shop_id = $1`, [shopId, refreshTokenEnc]);
  }

  /** Store the selected customer + flip the connected gate on. */
  async saveSelection(shopId: string, customerId: string, managerId: string | null): Promise<void> {
    await this.pool.query(
      `UPDATE shops SET google_ads_customer_id = $2, google_ads_manager_id = $3, google_ads_connected = true WHERE shop_id = $1`,
      [shopId, customerId, managerId]
    );
  }

  async getConnection(shopId: string): Promise<GoogleConnection | null> {
    const res = await this.pool.query(
      `SELECT google_ads_refresh_token, google_ads_customer_id, google_ads_manager_id, google_ads_connected
         FROM shops WHERE shop_id = $1`,
      [shopId]
    );
    const r = res.rows[0];
    if (!r) return null;
    return {
      refreshTokenEnc: r.google_ads_refresh_token ?? null,
      customerId: r.google_ads_customer_id ?? null,
      managerId: r.google_ads_manager_id ?? null,
      connected: r.google_ads_connected === true,
    };
  }

  async clearConnection(shopId: string): Promise<void> {
    await this.pool.query(
      `UPDATE shops
          SET google_ads_refresh_token = NULL, google_ads_customer_id = NULL,
              google_ads_manager_id = NULL, google_ads_connected = false
        WHERE shop_id = $1`,
      [shopId]
    );
  }
}
