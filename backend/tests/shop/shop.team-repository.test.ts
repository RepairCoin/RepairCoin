import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Skip BaseRepository's async connection probe so the repo can be constructed
// against a pure mock pool with no open handles.
process.env.SKIP_DB_CONNECTION_TESTS = 'true';

// Mock the shared pool. getSharedPool returns an object whose `query` is a single
// shared jest.fn (captured in the factory closure) so every repo instance and the
// test share the same mock.
jest.mock('../../src/utils/database-pool', () => {
  const query = jest.fn();
  return {
    getSharedPool: () => ({ query, connect: jest.fn() }),
  };
});

import { getSharedPool } from '../../src/utils/database-pool';
import { ShopTeamRepository } from '../../src/repositories/ShopTeamRepository';

const mockPool = getSharedPool() as any;
const mockQuery = mockPool.query as jest.MockedFunction<(...args: any[]) => Promise<any>>;

// A representative DB row (snake_case, as PostgreSQL returns it).
const dbRow = (overrides: Record<string, any> = {}) => ({
  id: 'member-1',
  shop_id: 'shop-1',
  wallet_address: '0xabc',
  email: 'staff@example.com',
  name: 'Staff Person',
  role: 'staff',
  permissions: ['bookings:view', 'customers:view'],
  status: 'invited',
  invite_token: 'hashed-token',
  invite_expires_at: '2026-07-01T00:00:00.000Z',
  invited_by: '0xowner',
  invited_at: '2026-06-26T00:00:00.000Z',
  accepted_at: null,
  created_at: '2026-06-26T00:00:00.000Z',
  updated_at: '2026-06-26T00:00:00.000Z',
  ...overrides,
});

describe('ShopTeamRepository', () => {
  let repo: ShopTeamRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ShopTeamRepository();
  });

  describe('mapRow', () => {
    it('maps snake_case DB columns to a camelCase ShopTeamMember', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [dbRow()], rowCount: 1 });
      const member = await repo.getMemberById('member-1');

      expect(member).toEqual({
        id: 'member-1',
        shopId: 'shop-1',
        walletAddress: '0xabc',
        email: 'staff@example.com',
        name: 'Staff Person',
        role: 'staff',
        permissions: ['bookings:view', 'customers:view'],
        status: 'invited',
        inviteToken: 'hashed-token',
        inviteExpiresAt: '2026-07-01T00:00:00.000Z',
        invitedBy: '0xowner',
        invitedAt: '2026-06-26T00:00:00.000Z',
        acceptedAt: null,
        createdAt: '2026-06-26T00:00:00.000Z',
        updatedAt: '2026-06-26T00:00:00.000Z',
      });
    });

    it('defaults a non-array permissions column to an empty array', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [dbRow({ permissions: null })], rowCount: 1 });
      const member = await repo.getMemberById('member-1');
      expect(member!.permissions).toEqual([]);
    });

    it('returns null when no row is found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      expect(await repo.getMemberById('missing')).toBeNull();
    });
  });

  describe('createMember', () => {
    it('derives permissions from the role template when none are provided', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [dbRow({ role: 'manager' })], rowCount: 1 });
      await repo.createMember({ shopId: 'shop-1', email: 'm@example.com', role: 'manager' });

      const [, values] = mockQuery.mock.calls[0];
      // values[5] is the JSON-stringified permissions
      const persisted = JSON.parse(values[5]);
      expect(persisted).not.toContain('billing:manage');
      expect(persisted).not.toContain('team:manage');
      expect(persisted).toContain('rewards:issue');
    });

    it('sanitizes explicitly-supplied permissions, stripping unknown entries', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [dbRow()], rowCount: 1 });
      await repo.createMember({
        shopId: 'shop-1',
        email: 'm@example.com',
        role: 'custom',
        permissions: ['bookings:view', 'totally:fake'],
      });

      const [, values] = mockQuery.mock.calls[0];
      expect(JSON.parse(values[5])).toEqual(['bookings:view']);
    });

    it('lowercases wallet and invitedBy addresses', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [dbRow()], rowCount: 1 });
      await repo.createMember({
        shopId: 'shop-1',
        email: 'm@example.com',
        walletAddress: '0xAbCdEf',
        invitedBy: '0xOWNER',
      });

      const [, values] = mockQuery.mock.calls[0];
      expect(values[1]).toBe('0xabcdef'); // wallet_address
      expect(values[9]).toBe('0xowner'); // invited_by
    });

    it('defaults status to invited with no accepted_at', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [dbRow()], rowCount: 1 });
      await repo.createMember({ shopId: 'shop-1', email: 'm@example.com' });

      const [, values] = mockQuery.mock.calls[0];
      expect(values[6]).toBe('invited'); // status
      expect(values[10]).toBeNull(); // accepted_at
    });

    it('stamps accepted_at when the member is created already active', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [dbRow({ status: 'active' })], rowCount: 1 });
      await repo.createMember({ shopId: 'shop-1', email: 'm@example.com', status: 'active' });

      const [, values] = mockQuery.mock.calls[0];
      expect(values[6]).toBe('active');
      expect(values[10]).not.toBeNull(); // accepted_at set
    });
  });

  describe('seedOwner', () => {
    it('lowercases the wallet and reports true when a row is inserted', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'owner-1' }], rowCount: 1 });
      const inserted = await repo.seedOwner({
        shopId: 'shop-1',
        walletAddress: '0xABCDEF',
        email: 'owner@example.com',
        name: 'Owner',
      });

      expect(inserted).toBe(true);
      const [sql, values] = mockQuery.mock.calls[0];
      expect(sql).toContain('ON CONFLICT');
      expect(values[1]).toBe('0xabcdef');
    });

    it('reports false when the owner already exists (ON CONFLICT DO NOTHING)', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const inserted = await repo.seedOwner({
        shopId: 'shop-1',
        walletAddress: '0xabc',
        email: 'owner@example.com',
      });
      expect(inserted).toBe(false);
    });
  });

  describe('getMembersByShop', () => {
    it('excludes removed members and orders owners first', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [dbRow({ id: 'o', role: 'owner' }), dbRow({ id: 's', role: 'staff' })],
        rowCount: 2,
      });
      const members = await repo.getMembersByShop('shop-1');

      const [sql, values] = mockQuery.mock.calls[0];
      expect(sql).toContain("status <> 'removed'");
      expect(sql).toContain("(role = 'owner') DESC");
      expect(values).toEqual(['shop-1']);
      expect(members).toHaveLength(2);
      expect(members[0].role).toBe('owner');
    });
  });

  describe('getByInviteTokenHash', () => {
    it('queries by hash and excludes expired/non-pending invites', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [dbRow()], rowCount: 1 });
      await repo.getByInviteTokenHash('hashed-token');

      const [sql, values] = mockQuery.mock.calls[0];
      expect(sql).toContain("status = 'invited'");
      expect(sql).toContain('invite_expires_at IS NULL OR invite_expires_at > NOW()');
      expect(values).toEqual(['hashed-token']);
    });

    it('returns null for an unknown or expired token', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      expect(await repo.getByInviteTokenHash('nope')).toBeNull();
    });
  });

  describe('getActiveMemberByWallet / getActiveMemberByEmail', () => {
    it('only matches active members by wallet', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [dbRow({ status: 'active' })], rowCount: 1 });
      await repo.getActiveMemberByWallet('0xABC');

      const [sql, values] = mockQuery.mock.calls[0];
      expect(sql).toContain("status = 'active'");
      expect(sql).toContain('LOWER(wallet_address) = LOWER($1)');
      expect(values).toEqual(['0xABC']);
    });

    it('only matches active members by email', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const member = await repo.getActiveMemberByEmail('staff@example.com');

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain("status = 'active'");
      expect(sql).toContain('LOWER(email) = LOWER($1)');
      expect(member).toBeNull();
    });
  });

  describe('countActiveOwners', () => {
    it('returns the integer count', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 2 }], rowCount: 1 });
      expect(await repo.countActiveOwners('shop-1')).toBe(2);
    });

    it('defaults to 0 when the count row is absent', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      expect(await repo.countActiveOwners('shop-1')).toBe(0);
    });
  });

  describe('updateMember', () => {
    it('builds a partial UPDATE with only the changed columns', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [dbRow({ name: 'New Name' })], rowCount: 1 });
      await repo.updateMember('member-1', { name: 'New Name' });

      const [sql, values] = mockQuery.mock.calls[0];
      expect(sql).toContain('name = $1');
      expect(sql).toContain('updated_at = NOW()');
      expect(values[0]).toBe('New Name');
      expect(values[values.length - 1]).toBe('member-1'); // id is the last param
    });

    it('sanitizes permissions and casts the column to jsonb', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [dbRow()], rowCount: 1 });
      await repo.updateMember('member-1', { permissions: ['bookings:view', 'evil:perm'] });

      const [sql, values] = mockQuery.mock.calls[0];
      expect(sql).toContain('permissions = $1::jsonb');
      expect(JSON.parse(values[0])).toEqual(['bookings:view']);
    });

    it('lowercases a wallet address and nulls it when cleared', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [dbRow()], rowCount: 1 });
      await repo.updateMember('member-1', { walletAddress: '0xDEADBEEF' });
      expect(mockQuery.mock.calls[0][1][0]).toBe('0xdeadbeef');

      mockQuery.mockResolvedValueOnce({ rows: [dbRow()], rowCount: 1 });
      await repo.updateMember('member-1', { walletAddress: null });
      expect(mockQuery.mock.calls[1][1][0]).toBeNull();
    });

    it('falls back to a plain lookup when there are no updates', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [dbRow()], rowCount: 1 });
      const member = await repo.updateMember('member-1', {});

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('SELECT * FROM shop_team_members WHERE id = $1');
      expect(member!.id).toBe('member-1');
    });
  });

  describe('removeMember', () => {
    it('soft-deletes by setting status to removed', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      await repo.removeMember('member-1');

      const [sql, values] = mockQuery.mock.calls[0];
      expect(sql).toContain("status = 'removed'");
      expect(values).toEqual(['member-1']);
    });
  });
});
