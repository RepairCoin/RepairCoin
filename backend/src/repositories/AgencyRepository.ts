import { v4 as uuidv4 } from 'uuid';
import { BaseRepository } from './BaseRepository';
import { logger } from '../utils/logger';

export type AgencyStatus = 'pending' | 'active' | 'past_due' | 'cancelled';

export interface Agency {
  id: string;
  name: string;
  ownerShopId: string;
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
  ownerShopId: string;
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

export type AgencyInviteStatus = 'pending' | 'accepted' | 'revoked';

export interface AgencyInvite {
  token: string;
  agencyId: string;
  label: string | null;
  status: AgencyInviteStatus;
  usedByShopId: string | null;
  createdAt: string;
  acceptedAt: string | null;
}

export class AgencyRepository extends BaseRepository {
  private mapAgency(row: any): Agency {
    return {
      id: row.id,
      name: row.name,
      ownerShopId: row.owner_shop_id,
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
           id, name, owner_shop_id, contact_email, contact_phone,
           account_manager_address, client_limit, per_client_price_cents, status
         ) VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 10), COALESCE($8, 5000), 'pending')
         RETURNING *`,
        [
          id,
          input.name,
          input.ownerShopId,
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

  /**
   * Provision/activate the agency owned by a shop from a completed Stripe checkout. Upserts on
   * the owner shop (one agency per shop, enforced by idx_agencies_owner_shop): inserts it as
   * `active` if new, or flips an existing `pending`/`cancelled` agency to `active` and attaches
   * the Stripe ids. The chosen agency name only fills a previously-empty name.
   */
  async activateFromCheckout(input: {
    ownerShopId: string;
    name: string;
    contactEmail?: string | null;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
  }): Promise<Agency> {
    try {
      const id = `agency_${uuidv4()}`;
      const result = await this.pool.query(
        `INSERT INTO agencies (
           id, name, owner_shop_id, contact_email,
           stripe_customer_id, stripe_subscription_id, status
         ) VALUES ($1, $2, $3, $4, $5, $6, 'active')
         ON CONFLICT (owner_shop_id) DO UPDATE SET
           status = 'active',
           name = COALESCE(NULLIF(agencies.name, ''), EXCLUDED.name),
           contact_email = COALESCE(agencies.contact_email, EXCLUDED.contact_email),
           stripe_customer_id = EXCLUDED.stripe_customer_id,
           stripe_subscription_id = EXCLUDED.stripe_subscription_id,
           updated_at = NOW()
         RETURNING *`,
        [
          id,
          input.name || 'My Agency',
          input.ownerShopId,
          input.contactEmail ?? null,
          input.stripeCustomerId,
          input.stripeSubscriptionId,
        ]
      );
      return this.mapAgency(result.rows[0]);
    } catch (error) {
      logger.error('Error activating agency from checkout:', error);
      throw new Error('Failed to activate agency');
    }
  }

  /**
   * Sync agency lifecycle status from a Stripe subscription event. A no-op (returns null) when
   * the subscription isn't an agency subscription, so it's safe to call for every sub event.
   */
  async updateStatusByStripeSubscriptionId(
    stripeSubscriptionId: string,
    status: AgencyStatus
  ): Promise<string | null> {
    try {
      const result = await this.pool.query(
        `UPDATE agencies SET status = $2, updated_at = NOW()
          WHERE stripe_subscription_id = $1
          RETURNING id`,
        [stripeSubscriptionId, status]
      );
      return result.rows[0]?.id ?? null;
    } catch (error) {
      logger.error('Error updating agency status by subscription:', error);
      throw new Error('Failed to update agency status');
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

  /** The agency owned by a given shop (the shop that activated the add-on), if any. */
  async getAgencyByOwnerShop(shopId: string): Promise<Agency | null> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM agencies WHERE owner_shop_id = $1',
        [shopId]
      );
      return result.rows[0] ? this.mapAgency(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error fetching agency by owner shop:', error);
      throw new Error('Failed to fetch agency');
    }
  }

  /** Agencies whose account manager is the given admin wallet (admin "assigned" view). */
  async getAgenciesByAccountManager(managerAddress: string): Promise<Array<{
    id: string;
    name: string;
    ownerShopId: string;
    status: AgencyStatus;
    contactEmail: string | null;
    contactPhone: string | null;
    activeClientCount: number;
    clientLimit: number;
  }>> {
    try {
      const result = await this.pool.query(
        `SELECT a.id, a.name, a.owner_shop_id, a.status, a.contact_email, a.contact_phone, a.client_limit,
                (SELECT COUNT(*)::int FROM agency_clients ac
                  WHERE ac.agency_id = a.id AND ac.status = 'active') AS active_client_count
           FROM agencies a
          WHERE LOWER(a.account_manager_address) = LOWER($1)
          ORDER BY a.name ASC`,
        [managerAddress]
      );
      return result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        ownerShopId: row.owner_shop_id,
        status: row.status,
        contactEmail: row.contact_email,
        contactPhone: row.contact_phone,
        activeClientCount: row.active_client_count,
        clientLimit: row.client_limit,
      }));
    } catch (error) {
      logger.error('Error fetching agencies by account manager:', error);
      throw new Error('Failed to fetch assigned agencies');
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

  /** All agencies with display stats for the admin roster (owner shop, client count, AM). */
  async listAgenciesWithStats(): Promise<Array<{
    id: string;
    name: string;
    ownerShopId: string;
    ownerShopName: string | null;
    status: AgencyStatus;
    contactEmail: string | null;
    contactPhone: string | null;
    activeClientCount: number;
    clientLimit: number;
    accountManagerAddress: string | null;
    accountManagerName: string | null;
    createdAt: string;
  }>> {
    try {
      const result = await this.pool.query(
        `SELECT a.id, a.name, a.owner_shop_id, os.name AS owner_shop_name,
                a.status, a.contact_email, a.contact_phone, a.client_limit,
                a.account_manager_address, adm.name AS account_manager_name, a.created_at,
                (SELECT COUNT(*)::int FROM agency_clients ac
                  WHERE ac.agency_id = a.id AND ac.status = 'active') AS active_client_count
           FROM agencies a
           LEFT JOIN shops os ON os.shop_id = a.owner_shop_id
           LEFT JOIN admins adm ON LOWER(adm.wallet_address) = LOWER(a.account_manager_address)
          ORDER BY a.created_at DESC`
      );
      return result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        ownerShopId: row.owner_shop_id,
        ownerShopName: row.owner_shop_name,
        status: row.status,
        contactEmail: row.contact_email,
        contactPhone: row.contact_phone,
        activeClientCount: row.active_client_count,
        clientLimit: row.client_limit,
        accountManagerAddress: row.account_manager_address,
        accountManagerName: row.account_manager_name,
        createdAt: row.created_at,
      }));
    } catch (error) {
      logger.error('Error listing agencies with stats:', error);
      throw new Error('Failed to list agencies');
    }
  }

  /** Assign or clear an agency's account manager (admin wallet, or null to unassign). */
  async updateAccountManager(agencyId: string, address: string | null): Promise<Agency | null> {
    try {
      const result = await this.pool.query(
        `UPDATE agencies SET account_manager_address = $2, updated_at = NOW()
          WHERE id = $1 RETURNING *`,
        [agencyId, address ? address.toLowerCase() : null]
      );
      return result.rows[0] ? this.mapAgency(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error updating agency account manager:', error);
      throw new Error('Failed to update agency account manager');
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
      // Agency coverage entitles the client to operate without its own subscription — mark it
      // subscription_qualified so operational_status consumers (dashboard gate, service creation)
      // treat it as active. Don't override an admin 'paused'.
      await client.query(
        `UPDATE shops
            SET agency_id = $1,
                operational_status = CASE WHEN operational_status = 'paused' THEN operational_status ELSE 'subscription_qualified' END,
                updated_at = NOW()
          WHERE shop_id = $2`,
        [agencyId, shopId]
      );
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
      // Losing agency coverage de-qualifies the shop — it needs its own subscription to operate.
      await client.query(
        `UPDATE shops
            SET agency_id = NULL,
                operational_status = CASE WHEN operational_status = 'paused' THEN operational_status ELSE 'not_qualified' END,
                updated_at = NOW()
          WHERE shop_id = $1 AND agency_id = $2`,
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

  /** Cascade an operational_status to all of an agency's active client shops (used when the
   *  agency's own subscription changes: active/past_due → subscription_qualified, cancelled →
   *  not_qualified). Skips admin-paused shops. */
  async setActiveClientsOperationalStatus(agencyId: string, status: string): Promise<number> {
    try {
      const result = await this.pool.query(
        `UPDATE shops SET operational_status = $2, updated_at = NOW()
          WHERE agency_id = $1 AND operational_status <> 'paused'`,
        [agencyId, status]
      );
      return result.rowCount ?? 0;
    } catch (error) {
      logger.error('Error cascading agency client operational status:', error);
      throw new Error('Failed to update agency client statuses');
    }
  }

  private mapInvite(row: any): AgencyInvite {
    return {
      token: row.token,
      agencyId: row.agency_id,
      label: row.label,
      status: row.status,
      usedByShopId: row.used_by_shop_id,
      createdAt: row.created_at,
      acceptedAt: row.accepted_at,
    };
  }

  async createInvite(agencyId: string, label?: string | null): Promise<AgencyInvite> {
    try {
      const token = uuidv4().replace(/-/g, '');
      const result = await this.pool.query(
        `INSERT INTO agency_invites (token, agency_id, label, status)
         VALUES ($1, $2, $3, 'pending') RETURNING *`,
        [token, agencyId, label ?? null]
      );
      return this.mapInvite(result.rows[0]);
    } catch (error) {
      logger.error('Error creating agency invite:', error);
      throw new Error('Failed to create agency invite');
    }
  }

  async getInvite(token: string): Promise<AgencyInvite | null> {
    try {
      const result = await this.pool.query('SELECT * FROM agency_invites WHERE token = $1', [token]);
      return result.rows[0] ? this.mapInvite(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error fetching agency invite:', error);
      throw new Error('Failed to fetch agency invite');
    }
  }

  /** Pending invites for an agency (the roster of unused invite links). */
  async listPendingInvites(agencyId: string): Promise<AgencyInvite[]> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM agency_invites WHERE agency_id = $1 AND status = 'pending' ORDER BY created_at DESC`,
        [agencyId]
      );
      return result.rows.map((r) => this.mapInvite(r));
    } catch (error) {
      logger.error('Error listing agency invites:', error);
      throw new Error('Failed to list agency invites');
    }
  }

  /** Revoke a pending invite owned by the agency. Returns true if a pending invite was revoked. */
  async revokeInvite(agencyId: string, token: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        `UPDATE agency_invites SET status = 'revoked'
          WHERE token = $1 AND agency_id = $2 AND status = 'pending' RETURNING token`,
        [token, agencyId]
      );
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      logger.error('Error revoking agency invite:', error);
      throw new Error('Failed to revoke agency invite');
    }
  }

  /** Mark an invite accepted by a shop. Returns true only if it was still pending. */
  async acceptInvite(token: string, shopId: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        `UPDATE agency_invites SET status = 'accepted', used_by_shop_id = $2, accepted_at = NOW()
          WHERE token = $1 AND status = 'pending' RETURNING token`,
        [token, shopId]
      );
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      logger.error('Error accepting agency invite:', error);
      throw new Error('Failed to accept agency invite');
    }
  }
}
