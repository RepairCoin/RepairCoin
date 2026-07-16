import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { requireAnyShopPermission } from '../../src/middleware/permissions';
import { permissionsForRole } from '../../src/domains/shop/permissions';

// Unit test for the requireAnyShopPermission middleware — the guard that lets a
// staff member LIST shop locations (bookings:manage) without granting the
// shop:manage needed to EDIT them. Driven directly with mocked req/res/next so
// it stays a pure unit (no app boot, no DB), matching shop.team-permissions.test.ts.
//
// Permission sets are pulled from the real permissionsForRole() so the test
// tracks the actual role templates — if the staff template loses bookings:manage,
// these assertions break, which is the coupling we want.

// The exact guard applied to GET /api/shops/locations.
const LOCATION_READ = ['shop:manage', 'bookings:manage'];

interface MockRes {
  status: jest.Mock;
  json: jest.Mock;
  statusCode?: number;
  body?: unknown;
}

function makeRes(): MockRes {
  const res: MockRes = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json.mockImplementation((payload: unknown) => {
    res.body = payload;
    return res;
  });
  return res;
}

function run(
  permissions: string[],
  user: Partial<{ role: string; permissions: string[] }> | null = {}
): { nextCalled: boolean; res: MockRes } {
  const req = { user: user === null ? undefined : user } as unknown as Request;
  const res = makeRes();
  const next = jest.fn() as unknown as NextFunction;
  requireAnyShopPermission(permissions)(req, res, next);
  return { nextCalled: (next as unknown as jest.Mock).mock.calls.length > 0, res };
}

describe('requireAnyShopPermission', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('location read guard (shop:manage OR bookings:manage)', () => {
    it('lets a staff member through — they carry bookings:manage', () => {
      const { nextCalled, res } = run(LOCATION_READ, {
        role: 'shop',
        permissions: permissionsForRole('staff'),
      });
      expect(nextCalled).toBe(true);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('lets a manager through — they carry shop:manage', () => {
      const { nextCalled } = run(LOCATION_READ, {
        role: 'shop',
        permissions: permissionsForRole('manager'),
      });
      expect(nextCalled).toBe(true);
    });

    it('lets an owner through via the wildcard', () => {
      const { nextCalled } = run(LOCATION_READ, {
        role: 'shop',
        permissions: permissionsForRole('owner'), // ['*']
      });
      expect(nextCalled).toBe(true);
    });

    it('denies a member holding none of the listed permissions', () => {
      const { nextCalled, res } = run(LOCATION_READ, {
        role: 'shop',
        permissions: ['customers:view'],
      });
      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(403);
      expect((res.body as { error: string }).error).toContain('shop:manage');
      expect((res.body as { error: string }).error).toContain('bookings:manage');
    });
  });

  describe('semantics', () => {
    it('is any-of, not all-of — one matching permission suffices', () => {
      // Requires two perms the member does NOT both hold; having just one passes.
      const { nextCalled } = run(['rewards:issue', 'team:manage'], {
        role: 'shop',
        permissions: ['rewards:issue'], // has the first, not the second
      });
      expect(nextCalled).toBe(true);
    });

    it('does not grant a permission outside the listed set', () => {
      // Staff can read locations, but the same staff perms must NOT satisfy an
      // edit-level guard — proves the helper genuinely checks membership.
      const { nextCalled, res } = run(['shop:manage'], {
        role: 'shop',
        permissions: permissionsForRole('staff'),
      });
      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(403);
    });

    it('treats a missing permissions claim as owner (wildcard) — legacy shop tokens', () => {
      const { nextCalled } = run(LOCATION_READ, { role: 'shop' }); // no permissions field
      expect(nextCalled).toBe(true);
    });

    it('lets an admin bypass regardless of permissions', () => {
      const { nextCalled } = run(LOCATION_READ, { role: 'admin', permissions: [] });
      expect(nextCalled).toBe(true);
    });

    it('rejects an unauthenticated request with 401', () => {
      const { nextCalled, res } = run(LOCATION_READ, null); // no req.user
      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(401);
    });
  });
});
