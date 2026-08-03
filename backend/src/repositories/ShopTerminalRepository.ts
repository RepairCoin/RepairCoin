import { BaseRepository } from './BaseRepository';
import { PoolClient } from 'pg';

export interface TerminalLocation {
  id: string;
  shopId: string;
  locationId: string;
  stripeAccountId: string;
  stripeLocationId: string;
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TerminalReader {
  id: string;
  shopId: string;
  terminalLocationId: string;
  stripeAccountId: string;
  stripeReaderId: string;
  label: string | null;
  deviceType: string | null;
  serialNumber: string | null;
  status: string | null;
  lastSeenAt: string | null;
  isDefault: boolean;
  shopLocationId: string | null;
  locationName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTerminalLocationInput {
  shopId: string;
  locationId: string;
  stripeAccountId: string;
  stripeLocationId: string;
  displayName?: string | null;
}

export interface CreateTerminalReaderInput {
  shopId: string;
  terminalLocationId: string;
  stripeAccountId: string;
  stripeReaderId: string;
  label?: string | null;
  deviceType?: string | null;
  serialNumber?: string | null;
  status?: string | null;
}

/**
 * Stripe Terminal locations and readers. Every read is scoped by the connected account the
 * rows were created under: a Stripe Location or Reader id only resolves on that account, so a
 * shop that has since repointed to a different account must not address the old ids.
 */
export class ShopTerminalRepository extends BaseRepository {
  private mapLocation(row: any): TerminalLocation {
    return {
      id: row.id,
      shopId: row.shop_id,
      locationId: row.location_id,
      stripeAccountId: row.stripe_account_id,
      stripeLocationId: row.stripe_location_id,
      displayName: row.display_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapReader(row: any): TerminalReader {
    return {
      id: row.id,
      shopId: row.shop_id,
      terminalLocationId: row.terminal_location_id,
      stripeAccountId: row.stripe_account_id,
      stripeReaderId: row.stripe_reader_id,
      label: row.label,
      deviceType: row.device_type,
      serialNumber: row.serial_number,
      status: row.status,
      lastSeenAt: row.last_seen_at,
      isDefault: row.is_default,
      shopLocationId: row.shop_location_id ?? null,
      locationName: row.location_name ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async listLocations(shopId: string, stripeAccountId: string): Promise<TerminalLocation[]> {
    const result = await this.pool.query(
      `SELECT * FROM shop_terminal_locations
       WHERE shop_id = $1 AND stripe_account_id = $2
       ORDER BY created_at ASC`,
      [shopId, stripeAccountId]
    );
    return result.rows.map((r) => this.mapLocation(r));
  }

  async findLocation(
    shopId: string,
    locationId: string,
    stripeAccountId: string
  ): Promise<TerminalLocation | null> {
    const result = await this.pool.query(
      `SELECT * FROM shop_terminal_locations
       WHERE shop_id = $1 AND location_id = $2 AND stripe_account_id = $3
       LIMIT 1`,
      [shopId, locationId, stripeAccountId]
    );
    return result.rows[0] ? this.mapLocation(result.rows[0]) : null;
  }

  async getLocationById(id: string, shopId: string): Promise<TerminalLocation | null> {
    const result = await this.pool.query(
      `SELECT * FROM shop_terminal_locations WHERE id = $1 AND shop_id = $2`,
      [id, shopId]
    );
    return result.rows[0] ? this.mapLocation(result.rows[0]) : null;
  }

  async createLocation(input: CreateTerminalLocationInput): Promise<TerminalLocation> {
    const result = await this.pool.query(
      `INSERT INTO shop_terminal_locations (
         shop_id, location_id, stripe_account_id, stripe_location_id, display_name
       ) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (stripe_account_id, location_id) DO UPDATE
         SET stripe_location_id = EXCLUDED.stripe_location_id,
             display_name = EXCLUDED.display_name,
             updated_at = now()
       RETURNING *`,
      [
        input.shopId,
        input.locationId,
        input.stripeAccountId,
        input.stripeLocationId,
        input.displayName ?? null,
      ]
    );
    return this.mapLocation(result.rows[0]);
  }

  async listReaders(shopId: string, stripeAccountId: string): Promise<TerminalReader[]> {
    const result = await this.pool.query(
      `SELECT r.*, tl.location_id AS shop_location_id, sl.name AS location_name
       FROM shop_terminal_readers r
       JOIN shop_terminal_locations tl ON tl.id = r.terminal_location_id
       LEFT JOIN shop_locations sl ON sl.id = tl.location_id
       WHERE r.shop_id = $1 AND r.stripe_account_id = $2
       ORDER BY sl.is_primary DESC NULLS LAST, sl.name ASC, r.is_default DESC, r.created_at ASC`,
      [shopId, stripeAccountId]
    );
    return result.rows.map((r) => this.mapReader(r));
  }

  async getReaderById(id: string, shopId: string): Promise<TerminalReader | null> {
    const result = await this.pool.query(
      `SELECT * FROM shop_terminal_readers WHERE id = $1 AND shop_id = $2`,
      [id, shopId]
    );
    return result.rows[0] ? this.mapReader(result.rows[0]) : null;
  }

  /**
   * A shop's first reader at a location becomes its default, so a location with readers always
   * has one selected.
   */
  async createReader(input: CreateTerminalReaderInput): Promise<TerminalReader> {
    return this.withTransaction(async (client: PoolClient) => {
      const existing = await client.query(
        `SELECT COUNT(*)::int AS count FROM shop_terminal_readers WHERE terminal_location_id = $1`,
        [input.terminalLocationId]
      );
      const isDefault = (existing.rows[0]?.count ?? 0) === 0;

      const result = await client.query(
        `INSERT INTO shop_terminal_readers (
           shop_id, terminal_location_id, stripe_account_id, stripe_reader_id,
           label, device_type, serial_number, status, last_seen_at, is_default
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), $9)
         RETURNING *`,
        [
          input.shopId,
          input.terminalLocationId,
          input.stripeAccountId,
          input.stripeReaderId,
          input.label ?? null,
          input.deviceType ?? null,
          input.serialNumber ?? null,
          input.status ?? null,
          isDefault,
        ]
      );
      return this.mapReader(result.rows[0]);
    });
  }

  async updateReaderStatus(id: string, status: string | null): Promise<void> {
    await this.pool.query(
      `UPDATE shop_terminal_readers
       SET status = $2, last_seen_at = now(), updated_at = now()
       WHERE id = $1`,
      [id, status]
    );
  }

  /**
   * Clearing the old default and setting the new one must be one transaction — the partial
   * unique index rejects a second default, so a non-atomic pair can leave the location with none.
   */
  async setDefaultReader(id: string, shopId: string): Promise<TerminalReader | null> {
    return this.withTransaction(async (client: PoolClient) => {
      const target = await client.query(
        `SELECT * FROM shop_terminal_readers WHERE id = $1 AND shop_id = $2`,
        [id, shopId]
      );
      if (!target.rows[0]) return null;

      await client.query(
        `UPDATE shop_terminal_readers SET is_default = false, updated_at = now()
         WHERE terminal_location_id = $1 AND is_default AND id <> $2`,
        [target.rows[0].terminal_location_id, id]
      );

      const updated = await client.query(
        `UPDATE shop_terminal_readers SET is_default = true, updated_at = now()
         WHERE id = $1 RETURNING *`,
        [id]
      );
      return this.mapReader(updated.rows[0]);
    });
  }

  /**
   * Promotes another reader at the same location when the default is removed, so deleting the
   * selected reader doesn't silently leave the location without one.
   */
  async deleteReader(id: string, shopId: string): Promise<boolean> {
    return this.withTransaction(async (client: PoolClient) => {
      const deleted = await client.query(
        `DELETE FROM shop_terminal_readers WHERE id = $1 AND shop_id = $2
         RETURNING terminal_location_id, is_default`,
        [id, shopId]
      );
      const row = deleted.rows[0];
      if (!row) return false;

      if (row.is_default) {
        await client.query(
          `UPDATE shop_terminal_readers SET is_default = true, updated_at = now()
           WHERE id = (
             SELECT id FROM shop_terminal_readers
             WHERE terminal_location_id = $1
             ORDER BY created_at ASC LIMIT 1
           )`,
          [row.terminal_location_id]
        );
      }
      return true;
    });
  }
}
