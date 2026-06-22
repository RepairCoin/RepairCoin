// backend/src/domains/AdsDomain/repositories/MetaConnectionRepository.ts
//
// Reads/writes the shop's Meta connection on the `shops` table (migrations 148 + 162):
// the encrypted user token + expiry, the selected ad account + Page (+ encrypted Page
// token), and the §9.6 `ads_account_connected` gate flag. Tokens are stored ENCRYPTED by
// the caller (tokenCrypto) — this layer never encrypts/decrypts, only persists strings.

import { BaseRepository } from '../../../repositories/BaseRepository';

export interface MetaConnection {
  shopId: string;
  userTokenEnc: string | null;
  refreshTokenEnc: string | null;
  expiresAt: Date | null;
  adAccountId: string | null;
  pageId: string | null;
  pageTokenEnc: string | null;
  businessId: string | null;
  pixelId: string | null;
  connected: boolean;
}

export class MetaConnectionRepository extends BaseRepository {
  /** Store the (encrypted) long-lived user token + expiry + Meta user id after OAuth exchange. */
  async saveUserToken(shopId: string, userTokenEnc: string, expiresAt: Date | null, metaUserId: string | null = null): Promise<void> {
    await this.pool.query(
      `UPDATE shops
          SET meta_oauth_token = $2, meta_oauth_expires_at = $3, meta_user_id = COALESCE($4, meta_user_id)
        WHERE shop_id = $1`,
      [shopId, userTokenEnc, expiresAt, metaUserId]
    );
  }

  /** Flip just the §9.6 gate flag (used by the nightly refresh on failure). */
  async setConnected(shopId: string, connected: boolean): Promise<void> {
    await this.pool.query(`UPDATE shops SET ads_account_connected = $2 WHERE shop_id = $1`, [shopId, connected]);
  }

  /** Map a Meta user id → shop (deauthorize / data-deletion callbacks carry only the user id). */
  async findShopByMetaUserId(metaUserId: string): Promise<string | null> {
    const res = await this.pool.query(`SELECT shop_id FROM shops WHERE meta_user_id = $1 LIMIT 1`, [metaUserId]);
    return res.rows[0]?.shop_id ?? null;
  }

  /** Re-store a refreshed user token (nightly refresh). */
  async updateUserToken(shopId: string, userTokenEnc: string, expiresAt: Date | null): Promise<void> {
    await this.pool.query(
      `UPDATE shops SET meta_oauth_token = $2, meta_oauth_expires_at = $3 WHERE shop_id = $1`,
      [shopId, userTokenEnc, expiresAt]
    );
  }

  /** Persist the shop's ad-account/Page selection + flip the §9.6 gate on. */
  async saveSelection(shopId: string, adAccountId: string, pageId: string, pageTokenEnc: string, businessId: string | null = null): Promise<void> {
    await this.pool.query(
      `UPDATE shops
          SET meta_ad_account_id = $2, meta_page_id = $3, meta_page_token = $4,
              meta_business_id = $5, ads_account_connected = true
        WHERE shop_id = $1`,
      [shopId, adAccountId, pageId, pageTokenEnc, businessId]
    );
  }

  /** Store the shop's Meta Pixel id (resolved/created at account selection). */
  async savePixelId(shopId: string, pixelId: string): Promise<void> {
    await this.pool.query(`UPDATE shops SET meta_pixel_id = $2 WHERE shop_id = $1`, [shopId, pixelId]);
  }

  async getConnection(shopId: string): Promise<MetaConnection | null> {
    const res = await this.pool.query(
      `SELECT meta_oauth_token, meta_oauth_refresh_token, meta_oauth_expires_at,
              meta_ad_account_id, meta_page_id, meta_page_token, meta_business_id, meta_pixel_id, ads_account_connected
         FROM shops WHERE shop_id = $1`,
      [shopId]
    );
    const r = res.rows[0];
    if (!r) return null;
    return {
      shopId,
      userTokenEnc: r.meta_oauth_token ?? null,
      refreshTokenEnc: r.meta_oauth_refresh_token ?? null,
      expiresAt: r.meta_oauth_expires_at ?? null,
      adAccountId: r.meta_ad_account_id ?? null,
      pageId: r.meta_page_id ?? null,
      pageTokenEnc: r.meta_page_token ?? null,
      businessId: r.meta_business_id ?? null,
      pixelId: r.meta_pixel_id ?? null,
      connected: r.ads_account_connected === true,
    };
  }

  /** Clear all Meta connection state + drop the gate flag (disconnect / deauthorize). */
  async clearConnection(shopId: string): Promise<void> {
    await this.pool.query(
      `UPDATE shops
          SET meta_oauth_token = NULL, meta_oauth_refresh_token = NULL, meta_oauth_expires_at = NULL,
              meta_ad_account_id = NULL, meta_page_id = NULL, meta_page_token = NULL,
              meta_business_id = NULL, meta_pixel_id = NULL, ads_account_connected = false
        WHERE shop_id = $1`,
      [shopId]
    );
  }

  /** Shop geo for ad targeting (Stage-4 push). Null lat/lng → caller falls back to city/zip. */
  async getShopGeo(shopId: string): Promise<{ lat: number | null; lng: number | null; city: string | null; zip: string | null }> {
    const res = await this.pool.query(
      `SELECT location_lat, location_lng, location_city, location_zip_code FROM shops WHERE shop_id = $1`,
      [shopId]
    );
    const r = res.rows[0];
    return {
      lat: r?.location_lat != null ? Number(r.location_lat) : null,
      lng: r?.location_lng != null ? Number(r.location_lng) : null,
      city: r?.location_city ?? null,
      zip: r?.location_zip_code ?? null,
    };
  }

  /** Connected shops whose user token expires before `before` — the nightly refresh set. */
  async listExpiring(before: Date): Promise<Array<{ shopId: string; userTokenEnc: string }>> {
    const res = await this.pool.query(
      `SELECT shop_id, meta_oauth_token
         FROM shops
        WHERE ads_account_connected = true
          AND meta_oauth_token IS NOT NULL
          AND meta_oauth_expires_at IS NOT NULL
          AND meta_oauth_expires_at < $1`,
      [before]
    );
    return res.rows.map((r) => ({ shopId: r.shop_id, userTokenEnc: r.meta_oauth_token }));
  }
}
