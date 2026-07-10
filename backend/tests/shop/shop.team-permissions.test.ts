import { describe, it, expect } from '@jest/globals';
import {
  SHOP_PERMISSIONS,
  ALL_PERMISSIONS,
  ROLE_TEMPLATES,
  permissionsForRole,
  hasPermission,
  sanitizePermissions,
} from '../../src/domains/shop/permissions';

describe('Shop Team — permission taxonomy & role templates', () => {
  describe('ROLE_TEMPLATES', () => {
    it('grants the owner the wildcard and nothing else', () => {
      expect(ROLE_TEMPLATES.owner).toEqual([ALL_PERMISSIONS]);
    });

    it('gives a manager everything except billing and team management', () => {
      expect(ROLE_TEMPLATES.manager).not.toContain('billing:manage');
      expect(ROLE_TEMPLATES.manager).not.toContain('team:manage');
      // Manager should still cover day-to-day operational permissions
      expect(ROLE_TEMPLATES.manager).toEqual(
        expect.arrayContaining(['inventory:manage', 'services:manage', 'rewards:issue', 'shop:manage'])
      );
    });

    it('manager never carries the wildcard (must be an explicit list)', () => {
      expect(ROLE_TEMPLATES.manager).not.toContain(ALL_PERMISSIONS);
    });

    it('limits staff to front-desk operational permissions', () => {
      expect(ROLE_TEMPLATES.staff).toEqual([
        'inventory:view',
        'bookings:view',
        'bookings:manage',
        'rewards:issue',
        'rewards:redeem',
        'customers:view',
      ]);
    });

    it('staff cannot view analytics, manage inventory, or touch billing/team', () => {
      expect(ROLE_TEMPLATES.staff).not.toContain('analytics:view');
      expect(ROLE_TEMPLATES.staff).not.toContain('inventory:manage');
      expect(ROLE_TEMPLATES.staff).not.toContain('billing:manage');
      expect(ROLE_TEMPLATES.staff).not.toContain('team:manage');
    });

    it('has no template for the custom role (owner defines it explicitly)', () => {
      expect(ROLE_TEMPLATES.custom).toBeUndefined();
    });
  });

  describe('permissionsForRole', () => {
    it('returns the template for a known role', () => {
      expect(permissionsForRole('manager')).toBe(ROLE_TEMPLATES.manager);
      expect(permissionsForRole('owner')).toEqual([ALL_PERMISSIONS]);
    });

    it('returns an empty array for the custom role', () => {
      expect(permissionsForRole('custom')).toEqual([]);
    });

    it('returns an empty array for an unknown role', () => {
      expect(permissionsForRole('superuser')).toEqual([]);
      expect(permissionsForRole('')).toEqual([]);
    });
  });

  describe('hasPermission', () => {
    it('grants any permission when the set contains the wildcard', () => {
      expect(hasPermission([ALL_PERMISSIONS], 'billing:manage')).toBe(true);
      expect(hasPermission(['*'], 'team:manage')).toBe(true);
    });

    it('grants a permission that is explicitly present', () => {
      expect(hasPermission(['bookings:view', 'customers:view'], 'customers:view')).toBe(true);
    });

    it('denies a permission that is absent', () => {
      expect(hasPermission(['bookings:view'], 'team:manage')).toBe(false);
    });

    it('denies when the permission set is empty', () => {
      expect(hasPermission([], 'bookings:view')).toBe(false);
    });

    it('denies when the permission set is undefined', () => {
      expect(hasPermission(undefined, 'bookings:view')).toBe(false);
    });
  });

  describe('sanitizePermissions', () => {
    it('keeps only recognized permission strings', () => {
      const result = sanitizePermissions(['bookings:view', 'not:a:permission', 'rewards:issue']);
      expect(result).toEqual(['bookings:view', 'rewards:issue']);
    });

    it('preserves the wildcard', () => {
      expect(sanitizePermissions(['*'])).toEqual(['*']);
    });

    it('drops non-string entries', () => {
      const result = sanitizePermissions(['bookings:view', 123, null, undefined, {}]);
      expect(result).toEqual(['bookings:view']);
    });

    it('returns an empty array for non-array input', () => {
      expect(sanitizePermissions('bookings:view')).toEqual([]);
      expect(sanitizePermissions(null)).toEqual([]);
      expect(sanitizePermissions(undefined)).toEqual([]);
      expect(sanitizePermissions({ 'bookings:view': true })).toEqual([]);
    });

    it('accepts every documented shop permission', () => {
      expect(sanitizePermissions([...SHOP_PERMISSIONS])).toEqual([...SHOP_PERMISSIONS]);
    });

    it('strips a forged elevated permission from an otherwise valid list', () => {
      // A custom role should not be able to smuggle in an unknown super-permission.
      const result = sanitizePermissions(['customers:view', 'admin:everything']);
      expect(result).toEqual(['customers:view']);
    });
  });
});
