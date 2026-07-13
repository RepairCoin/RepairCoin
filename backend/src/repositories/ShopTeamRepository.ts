import { BaseRepository } from './BaseRepository';
import { PoolClient } from 'pg';
import { permissionsForRole, sanitizePermissions } from '../domains/shop/permissions';

export interface ShopTeamMember {
  id: string;
  shopId: string;
  walletAddress: string | null;
  email: string;
  name: string | null;
  role: string;
  permissions: string[];
  commissionPercent: number | null;
  status: 'invited' | 'active' | 'suspended' | 'removed';
  inviteToken: string | null;
  inviteExpiresAt: string | null;
  invitedBy: string | null;
  invitedAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeamMemberInput {
  shopId: string;
  email: string;
  name?: string | null;
  walletAddress?: string | null;
  role?: string;
  /** Explicit permission set; if omitted, derived from the role template. */
  permissions?: string[];
  status?: ShopTeamMember['status'];
  inviteToken?: string | null;
  inviteExpiresAt?: string | null;
  invitedBy?: string | null;
}

/**
 * Data access for shop team members (docs/TEAM_MANAGEMENT_PLAN.md §3).
 * Wallet addresses are always lowercased, consistent with the rest of the platform.
 */
export class ShopTeamRepository extends BaseRepository {
  private mapRow(row: any): ShopTeamMember {
    return {
      id: row.id,
      shopId: row.shop_id,
      walletAddress: row.wallet_address,
      email: row.email,
      name: row.name,
      role: row.role,
      permissions: Array.isArray(row.permissions) ? row.permissions : [],
      commissionPercent: row.commission_percent != null ? parseFloat(row.commission_percent) : null,
      status: row.status,
      inviteToken: row.invite_token,
      inviteExpiresAt: row.invite_expires_at,
      invitedBy: row.invited_by,
      invitedAt: row.invited_at,
      acceptedAt: row.accepted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async createMember(input: CreateTeamMemberInput, client?: PoolClient): Promise<ShopTeamMember> {
    const role = input.role || 'staff';
    const permissions =
      input.permissions !== undefined
        ? sanitizePermissions(input.permissions)
        : permissionsForRole(role);

    const query = `
      INSERT INTO shop_team_members (
        shop_id, wallet_address, email, name, role, permissions, status,
        invite_token, invite_expires_at, invited_by, accepted_at
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const values = [
      input.shopId,
      input.walletAddress ? input.walletAddress.toLowerCase() : null,
      input.email,
      input.name ?? null,
      role,
      JSON.stringify(permissions),
      input.status || 'invited',
      input.inviteToken ?? null,
      input.inviteExpiresAt ?? null,
      input.invitedBy ? input.invitedBy.toLowerCase() : null,
      input.status === 'active' ? new Date().toISOString() : null,
    ];

    const runner = client ?? this.pool;
    const result = await runner.query(query, values);
    return this.mapRow(result.rows[0]);
  }

  /**
   * Idempotently ensure an 'owner' member exists for a shop. Used by createShop()
   * for new shops and re-runnable for backfill. Returns true if a row was inserted.
   */
  async seedOwner(
    params: { shopId: string; walletAddress: string; email: string; name?: string | null },
    client?: PoolClient
  ): Promise<boolean> {
    const query = `
      INSERT INTO shop_team_members (
        shop_id, wallet_address, email, name, role, permissions, status, accepted_at
      ) VALUES ($1, $2, $3, $4, 'owner', '["*"]'::jsonb, 'active', NOW())
      ON CONFLICT (shop_id, wallet_address) DO NOTHING
      RETURNING id
    `;
    const runner = client ?? this.pool;
    const result = await runner.query(query, [
      params.shopId,
      params.walletAddress.toLowerCase(),
      params.email,
      params.name ?? null,
    ]);
    return (result.rowCount ?? 0) > 0;
  }

  async getMembersByShop(shopId: string): Promise<ShopTeamMember[]> {
    const result = await this.pool.query(
      `SELECT * FROM shop_team_members
       WHERE shop_id = $1 AND status <> 'removed'
       ORDER BY (role = 'owner') DESC, created_at ASC`,
      [shopId]
    );
    return result.rows.map((r) => this.mapRow(r));
  }

  async getMemberById(id: string): Promise<ShopTeamMember | null> {
    const result = await this.pool.query(`SELECT * FROM shop_team_members WHERE id = $1`, [id]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async getByShopAndEmail(shopId: string, email: string): Promise<ShopTeamMember | null> {
    const result = await this.pool.query(
      `SELECT * FROM shop_team_members WHERE shop_id = $1 AND LOWER(email) = LOWER($2) LIMIT 1`,
      [shopId, email]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /** Look up a pending, unexpired invite by its hashed token. */
  async getByInviteTokenHash(tokenHash: string): Promise<ShopTeamMember | null> {
    const result = await this.pool.query(
      `SELECT * FROM shop_team_members
       WHERE invite_token = $1 AND status = 'invited'
         AND (invite_expires_at IS NULL OR invite_expires_at > NOW())
       LIMIT 1`,
      [tokenHash]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /** Active member by wallet — login resolution step 2 (§5.1). */
  async getActiveMemberByWallet(walletAddress: string): Promise<ShopTeamMember | null> {
    const result = await this.pool.query(
      `SELECT * FROM shop_team_members
       WHERE LOWER(wallet_address) = LOWER($1) AND status = 'active'
       LIMIT 1`,
      [walletAddress]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /** Active member by email — login resolution step 3 fallback (§5.1). */
  async getActiveMemberByEmail(email: string): Promise<ShopTeamMember | null> {
    const result = await this.pool.query(
      `SELECT * FROM shop_team_members
       WHERE LOWER(email) = LOWER($1) AND status = 'active'
       LIMIT 1`,
      [email]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /** Count active owners — used by the last-owner guard in Phase 3. */
  async countActiveOwners(shopId: string): Promise<number> {
    const result = await this.pool.query(
      `SELECT COUNT(*)::int AS count FROM shop_team_members
       WHERE shop_id = $1 AND role = 'owner' AND status = 'active'`,
      [shopId]
    );
    return result.rows[0]?.count ?? 0;
  }

  async updateMember(
    id: string,
    updates: Partial<Pick<ShopTeamMember,
      'name' | 'role' | 'permissions' | 'commissionPercent' | 'status' | 'walletAddress' | 'inviteToken' | 'inviteExpiresAt' | 'acceptedAt'
    >>,
    client?: PoolClient
  ): Promise<ShopTeamMember | null> {
    const sets: string[] = [];
    const values: any[] = [];
    let i = 1;

    const push = (col: string, val: any, cast = '') => {
      sets.push(`${col} = $${i}${cast}`);
      values.push(val);
      i++;
    };

    if (updates.name !== undefined) push('name', updates.name);
    if (updates.role !== undefined) push('role', updates.role);
    if (updates.permissions !== undefined) push('permissions', JSON.stringify(sanitizePermissions(updates.permissions)), '::jsonb');
    if (updates.commissionPercent !== undefined) push('commission_percent', updates.commissionPercent);
    if (updates.status !== undefined) push('status', updates.status);
    if (updates.walletAddress !== undefined) push('wallet_address', updates.walletAddress ? updates.walletAddress.toLowerCase() : null);
    if (updates.inviteToken !== undefined) push('invite_token', updates.inviteToken);
    if (updates.inviteExpiresAt !== undefined) push('invite_expires_at', updates.inviteExpiresAt);
    if (updates.acceptedAt !== undefined) push('accepted_at', updates.acceptedAt);

    if (sets.length === 0) return this.getMemberById(id);

    sets.push(`updated_at = NOW()`);
    values.push(id);

    const runner = client ?? this.pool;
    const result = await runner.query(
      `UPDATE shop_team_members SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async removeMember(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE shop_team_members SET status = 'removed', updated_at = NOW() WHERE id = $1`,
      [id]
    );
  }
}
