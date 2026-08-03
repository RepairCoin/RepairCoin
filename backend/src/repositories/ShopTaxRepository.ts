import { BaseRepository } from './BaseRepository';

export interface ShopTaxRate {
  id: string;
  shopId: string;
  locationId: string | null;
  name: string;
  rateBps: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertShopTaxRateInput {
  shopId: string;
  locationId?: string | null;
  name?: string;
  rateBps: number;
}

export class ShopTaxRepository extends BaseRepository {
  private mapRow(row: any): ShopTaxRate {
    return {
      id: row.id,
      shopId: row.shop_id,
      locationId: row.location_id,
      name: row.name,
      rateBps: Number(row.rate_bps),
      active: row.active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async listByShop(shopId: string): Promise<ShopTaxRate[]> {
    const result = await this.pool.query(
      `SELECT * FROM shop_tax_rates
       WHERE shop_id = $1 AND active
       ORDER BY location_id NULLS FIRST, created_at ASC`,
      [shopId]
    );
    return result.rows.map((r) => this.mapRow(r));
  }

  /**
   * The rate a sale at this location charges: the branch override if one exists, otherwise the
   * shop default, otherwise nothing. A shop that has never set a rate charges no tax rather
   * than guessing one.
   */
  async resolveRateBps(shopId: string, locationId?: string | null): Promise<number> {
    const result = await this.pool.query(
      `SELECT rate_bps FROM shop_tax_rates
       WHERE shop_id = $1 AND active AND (location_id = $2 OR location_id IS NULL)
       ORDER BY location_id NULLS LAST
       LIMIT 1`,
      [shopId, locationId ?? null]
    );
    return result.rows[0] ? Number(result.rows[0].rate_bps) : 0;
  }

  async upsert(input: UpsertShopTaxRateInput): Promise<ShopTaxRate> {
    const result = await this.pool.query(
      `INSERT INTO shop_tax_rates (shop_id, location_id, name, rate_bps)
       VALUES ($1, $2, COALESCE($3, 'Sales tax'), $4)
       ON CONFLICT (shop_id, location_id) WHERE location_id IS NOT NULL AND active
       DO UPDATE SET rate_bps = EXCLUDED.rate_bps, name = EXCLUDED.name, updated_at = now()
       RETURNING *`,
      [input.shopId, input.locationId ?? null, input.name ?? null, input.rateBps]
    );
    return this.mapRow(result.rows[0]);
  }

  async upsertDefault(input: UpsertShopTaxRateInput): Promise<ShopTaxRate> {
    const result = await this.pool.query(
      `INSERT INTO shop_tax_rates (shop_id, location_id, name, rate_bps)
       VALUES ($1, NULL, COALESCE($2, 'Sales tax'), $3)
       ON CONFLICT (shop_id) WHERE location_id IS NULL AND active
       DO UPDATE SET rate_bps = EXCLUDED.rate_bps, name = EXCLUDED.name, updated_at = now()
       RETURNING *`,
      [input.shopId, input.name ?? null, input.rateBps]
    );
    return this.mapRow(result.rows[0]);
  }

  async deactivate(shopId: string, id: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE shop_tax_rates SET active = false, updated_at = now()
       WHERE id = $1 AND shop_id = $2 AND active
       RETURNING id`,
      [id, shopId]
    );
    return result.rowCount ? result.rowCount > 0 : false;
  }
}
