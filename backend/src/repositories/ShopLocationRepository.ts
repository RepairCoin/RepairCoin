import { BaseRepository } from './BaseRepository';
import { PoolClient } from 'pg';

export interface ShopLocation {
  id: string;
  shopId: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  isPrimary: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateShopLocationInput {
  shopId: string;
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  lat?: number | null;
  lng?: number | null;
  phone?: string | null;
  active?: boolean;
}

export type UpdateShopLocationInput = Partial<
  Pick<ShopLocation, 'name' | 'address' | 'city' | 'state' | 'zipCode' | 'lat' | 'lng' | 'phone' | 'active'>
>;

/**
 * Data access for a shop's physical locations (multi-location management, Business tier).
 * The owning shop remains the single billing/wallet/subscription identity; a row here is one
 * physical site. At most one location per shop is primary (enforced by a partial unique index).
 */
export class ShopLocationRepository extends BaseRepository {
  private mapRow(row: any): ShopLocation {
    return {
      id: row.id,
      shopId: row.shop_id,
      name: row.name,
      address: row.address,
      city: row.location_city,
      state: row.location_state,
      zipCode: row.location_zip_code,
      lat: row.location_lat !== null ? Number(row.location_lat) : null,
      lng: row.location_lng !== null ? Number(row.location_lng) : null,
      phone: row.phone,
      isPrimary: row.is_primary,
      active: row.active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async listByShop(shopId: string): Promise<ShopLocation[]> {
    const result = await this.pool.query(
      `SELECT * FROM shop_locations
       WHERE shop_id = $1
       ORDER BY is_primary DESC, created_at ASC`,
      [shopId]
    );
    return result.rows.map((r) => this.mapRow(r));
  }

  async getById(id: string): Promise<ShopLocation | null> {
    const result = await this.pool.query(`SELECT * FROM shop_locations WHERE id = $1`, [id]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async countByShop(shopId: string): Promise<number> {
    const result = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM shop_locations WHERE shop_id = $1`,
      [shopId]
    );
    return result.rows[0]?.count ?? 0;
  }

  /**
   * Create a location. The shop's first location is automatically made primary so a shop always
   * has a primary once it has any location.
   */
  async create(input: CreateShopLocationInput): Promise<ShopLocation> {
    return this.withTransaction(async (client: PoolClient) => {
      const existing = await client.query(
        `SELECT COUNT(*)::int AS count FROM shop_locations WHERE shop_id = $1`,
        [input.shopId]
      );
      const isPrimary = (existing.rows[0]?.count ?? 0) === 0;

      const result = await client.query(
        `INSERT INTO shop_locations (
           shop_id, name, address, location_city, location_state, location_zip_code,
           location_lat, location_lng, phone, is_primary, active
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          input.shopId,
          input.name,
          input.address ?? null,
          input.city ?? null,
          input.state ?? null,
          input.zipCode ?? null,
          input.lat ?? null,
          input.lng ?? null,
          input.phone ?? null,
          isPrimary,
          input.active ?? true,
        ]
      );
      return this.mapRow(result.rows[0]);
    });
  }

  /**
   * Idempotently seed a shop's primary location from its own address. Inserts only when the shop
   * has no location yet, so it's safe to call on every registration and re-run for backfill.
   * Returns true if a row was inserted. Mirrors the migration-192 backfill for new shops.
   */
  async seedPrimary(input: CreateShopLocationInput, client?: PoolClient): Promise<boolean> {
    const runner = client ?? this.pool;
    const result = await runner.query(
      `INSERT INTO shop_locations (
         shop_id, name, address, location_city, location_state, location_zip_code,
         location_lat, location_lng, phone, is_primary, active
       )
       SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, true, true
       WHERE NOT EXISTS (SELECT 1 FROM shop_locations WHERE shop_id = $1)
       RETURNING id`,
      [
        input.shopId,
        input.name,
        input.address ?? null,
        input.city ?? null,
        input.state ?? null,
        input.zipCode ?? null,
        input.lat ?? null,
        input.lng ?? null,
        input.phone ?? null,
      ]
    );
    return (result.rowCount ?? 0) > 0;
  }

  // Mirror the primary location back onto the canonical `shops` columns (kept for shop profile
  // display and any consumer still reading shops.address). Address/phone preserved when blank.
  async syncShopCanonicalAddress(shopId: string, client?: PoolClient): Promise<void> {
    const runner = client ?? this.pool;
    await runner.query(
      `UPDATE shops s SET
         address = COALESCE(l.address, s.address),
         location_city = l.location_city,
         location_state = l.location_state,
         location_zip_code = l.location_zip_code,
         location_lat = l.location_lat,
         location_lng = l.location_lng,
         phone = COALESCE(l.phone, s.phone),
         updated_at = NOW()
       FROM shop_locations l
       WHERE l.shop_id = $1 AND l.is_primary = true AND s.shop_id = $1`,
      [shopId]
    );
  }

  async update(id: string, updates: UpdateShopLocationInput): Promise<ShopLocation | null> {
    const columnMap: Record<keyof UpdateShopLocationInput, string> = {
      name: 'name',
      address: 'address',
      city: 'location_city',
      state: 'location_state',
      zipCode: 'location_zip_code',
      lat: 'location_lat',
      lng: 'location_lng',
      phone: 'phone',
      active: 'active',
    };

    const sets: string[] = [];
    const values: any[] = [];
    let i = 1;

    (Object.keys(columnMap) as (keyof UpdateShopLocationInput)[]).forEach((key) => {
      if (updates[key] !== undefined) {
        sets.push(`${columnMap[key]} = $${i}`);
        values.push(updates[key]);
        i++;
      }
    });

    if (sets.length === 0) return this.getById(id);

    sets.push(`updated_at = NOW()`);
    values.push(id);

    const result = await this.pool.query(
      `UPDATE shop_locations SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Make one location the shop's primary, unsetting any current primary in the same transaction
   * (the partial unique index forbids two primaries at once).
   */
  async setPrimary(shopId: string, id: string): Promise<ShopLocation | null> {
    return this.withTransaction(async (client: PoolClient) => {
      await client.query(
        `UPDATE shop_locations SET is_primary = false, updated_at = NOW()
         WHERE shop_id = $1 AND is_primary = true AND id <> $2`,
        [shopId, id]
      );
      const result = await client.query(
        `UPDATE shop_locations SET is_primary = true, updated_at = NOW()
         WHERE id = $1 AND shop_id = $2 RETURNING *`,
        [id, shopId]
      );
      return result.rows[0] ? this.mapRow(result.rows[0]) : null;
    });
  }

  /**
   * Delete a location. If the primary was removed and other locations remain, the oldest is
   * promoted so the shop keeps a primary.
   */
  async delete(id: string): Promise<void> {
    await this.withTransaction(async (client: PoolClient) => {
      const deleted = await client.query(
        `DELETE FROM shop_locations WHERE id = $1 RETURNING shop_id, is_primary`,
        [id]
      );
      const row = deleted.rows[0];
      if (!row || !row.is_primary) return;

      await client.query(
        `UPDATE shop_locations
         SET is_primary = true, updated_at = NOW()
         WHERE id = (
           SELECT id FROM shop_locations WHERE shop_id = $1
           ORDER BY created_at ASC LIMIT 1
         )`,
        [row.shop_id]
      );
    });
  }
}
