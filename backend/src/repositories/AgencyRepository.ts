import { v4 as uuidv4 } from 'uuid';
import { BaseRepository } from './BaseRepository';
import { logger } from '../utils/logger';

export type AgencyStatus = 'pending' | 'active' | 'past_due' | 'cancelled';

export interface Agency {
  id: string;
  name: string;
  ownerWalletAddress: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  status: AgencyStatus;
  clientLimit: number;
  perClientPriceCents: number;
  accountManagerAddress: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgencyInput {
  name: string;
  ownerWalletAddress?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  accountManagerAddress?: string | null;
  clientLimit?: number;
  perClientPriceCents?: number;
}

export interface AgencyClientShop {
  shopId: string;
  name: string;
  email: string | null;
  active: boolean;
  city: string | null;
  country: string | null;
  addedAt: string;
}

export class AgencyRepository extends BaseRepository {
  private mapAgency(row: any): Agency {
    return {
      id: row.id,
      name: row.name,
      ownerWalletAddress: row.owner_wallet_address,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      stripeCustomerId: row.stripe_customer_id,
      stripeSubscriptionId: row.stripe_subscription_id,
      status: row.status,
      clientLimit: row.client_limit,
      perClientPriceCents: row.per_client_price_cents,
      accountManagerAddress: row.account_manager_address,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async createAgency(input: CreateAgencyInput): Promise<Agency> {
    try {
      const id = `agency_${uuidv4()}`;
      const result = await this.pool.query(
        `INSERT INTO agencies (
           id, name, owner_wallet_address, contact_email, contact_phone,
           account_manager_address, client_limit, per_client_price_cents, status
         ) VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 10), COALESCE($8, 5000), 'pending')
         RETURNING *`,
        [
          id,
          input.name,
          input.ownerWalletAddress ? input.ownerWalletAddress.toLowerCase() : null,
          input.contactEmail ?? null,
          input.contactPhone ?? null,
          input.accountManagerAddress ? input.accountManagerAddress.toLowerCase() : null,
          input.clientLimit ?? null,
          input.perClientPriceCents ?? null,
        ]
      );
      return this.mapAgency(result.rows[0]);
    } catch (error) {
      logger.error('Error creating agency:', error);
      throw new Error('Failed to create agency');
    }
  }

  async getAgency(id: string): Promise<Agency | null> {
    try {
      const result = await this.pool.query('SELECT * FROM agencies WHERE id = $1', [id]);
      return result.rows[0] ? this.mapAgency(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error fetching agency:', error);
      throw new Error('Failed to fetch agency');
    }
  }

  async getAgencyByOwner(walletAddress: string): Promise<Agency | null> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM agencies WHERE LOWER(owner_wallet_address) = LOWER($1)',
        [walletAddress]
      );
      return result.rows[0] ? this.mapAgency(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error fetching agency by owner:', error);
      throw new Error('Failed to fetch agency');
    }
  }

  async listAgencies(): Promise<Agency[]> {
    try {
      const result = await this.pool.query('SELECT * FROM agencies ORDER BY created_at DESC');
      return result.rows.map((r) => this.mapAgency(r));
    } catch (error) {
      logger.error('Error listing agencies:', error);
      throw new Error('Failed to list agencies');
    }
  }

  /** Active client shops for an agency (joined to shops for display). */
  async listClients(agencyId: string): Promise<AgencyClientShop[]> {
    try {
      const result = await this.pool.query(
        `SELECT s.shop_id, s.name, s.email, s.active, s.location_city, s.country, ac.added_at
           FROM agency_clients ac
           JOIN shops s ON s.shop_id = ac.shop_id
          WHERE ac.agency_id = $1 AND ac.status = 'active'
          ORDER BY s.name ASC`,
        [agencyId]
      );
      return result.rows.map((row) => ({
        shopId: row.shop_id,
        name: row.name,
        email: row.email,
        active: row.active,
        city: row.location_city,
        country: row.country,
        addedAt: row.added_at,
      }));
    } catch (error) {
      logger.error('Error listing agency clients:', error);
      throw new Error('Failed to list agency clients');
    }
  }

  async getActiveClientCount(agencyId: string): Promise<number> {
    try {
      const result = await this.pool.query(
        `SELECT COUNT(*)::int AS count FROM agency_clients WHERE agency_id = $1 AND status = 'active'`,
        [agencyId]
      );
      return result.rows[0]?.count ?? 0;
    } catch (error) {
      logger.error('Error counting agency clients:', error);
      throw new Error('Failed to count agency clients');
    }
  }

  /** True when `shopId` is an active client of `agencyId` (used by the act-as-client guard). */
  async isClientOfAgency(agencyId: string, shopId: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        `SELECT 1 FROM agency_clients WHERE agency_id = $1 AND shop_id = $2 AND status = 'active' LIMIT 1`,
        [agencyId, shopId]
      );
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error checking agency client:', error);
      throw new Error('Failed to check agency client');
    }
  }

  /** Link a shop to an agency (transactional: agency_clients + shops.agency_id pointer). */
  async addClient(agencyId: string, shopId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO agency_clients (id, agency_id, shop_id, status)
         VALUES ($1, $2, $3, 'active')
         ON CONFLICT (agency_id, shop_id)
         DO UPDATE SET status = 'active', removed_at = NULL`,
        [`ac_${uuidv4()}`, agencyId, shopId]
      );
      await client.query('UPDATE shops SET agency_id = $1, updated_at = NOW() WHERE shop_id = $2', [
        agencyId,
        shopId,
      ]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error adding agency client:', error);
      throw new Error('Failed to add agency client');
    } finally {
      client.release();
    }
  }

  /** Unlink a shop from an agency (soft): clears the pointer and marks the link removed. */
  async removeClient(agencyId: string, shopId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE agency_clients SET status = 'removed', removed_at = NOW()
          WHERE agency_id = $1 AND shop_id = $2`,
        [agencyId, shopId]
      );
      await client.query(
        `UPDATE shops SET agency_id = NULL, updated_at = NOW() WHERE shop_id = $1 AND agency_id = $2`,
        [shopId, agencyId]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error removing agency client:', error);
      throw new Error('Failed to remove agency client');
    } finally {
      client.release();
    }
  }
}
