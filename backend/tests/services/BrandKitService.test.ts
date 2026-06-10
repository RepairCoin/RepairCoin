// backend/tests/services/BrandKitService.test.ts
//
// Branding Studio (onboarding AI) — Phase 1 unit tests for BrandKitService.
// Covers the pure save-path validator the wizard relies on, plus the two
// onboarding-specific behaviours: getBrandKit mapping onboarding_completed_at to
// an ISO string, and markOnboardingComplete upserting + re-reading the kit.
// The Pool is injected (constructor arg) so we mock it directly — no jest.mock.

import { Pool } from 'pg';
import {
  BrandKitService,
  validateBrandKitUpdate,
} from '../../src/domains/AIAgentDomain/services/BrandKitService';

// A minimal mock pool — only .query is used. Cast through unknown to Pool.
const makePool = () => {
  const query = jest.fn();
  return { pool: { query } as unknown as Pool, query };
};

// A getBrandKit SELECT row (snake_case, as pg returns it).
const kitRow = (overrides: Record<string, any> = {}) => ({
  shop_logo_url: 'https://cdn/shop-logo.png',
  shop_banner_url: 'https://cdn/shop-banner.png',
  override_logo_url: null,
  primary_color_hex: '#FFCC00',
  secondary_color_hex: '#1A1A1A',
  tone_notes: 'Friendly neighborhood shop',
  marketing_style: 'Modern & Tech',
  brand_voice: 'Professional but Friendly',
  headline: 'Fast Repairs. Trusted Service.',
  brand_personality: 'Professional • Friendly • Trustworthy',
  industry_style: 'Repair & Service Business',
  heading_font: 'Space Grotesk',
  body_font: 'Inter',
  onboarding_completed_at: null,
  ...overrides,
});

describe('validateBrandKitUpdate', () => {
  it('accepts valid hex colors, tone, and logo url', () => {
    const { value, error } = validateBrandKitUpdate({
      primaryColorHex: '#FFCC00',
      secondaryColorHex: '#abc123',
      toneNotes: 'Warm and trustworthy',
      logoUrl: 'https://cdn/logo.png',
    });
    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      primaryColorHex: '#FFCC00',
      secondaryColorHex: '#abc123',
      toneNotes: 'Warm and trustworthy',
      logoUrl: 'https://cdn/logo.png',
    });
  });

  it('rejects a malformed hex color', () => {
    const { error } = validateBrandKitUpdate({ primaryColorHex: 'red' });
    expect(error).toMatch(/hex color/i);
  });

  it('rejects tone over 500 characters', () => {
    const { error } = validateBrandKitUpdate({ toneNotes: 'x'.repeat(501) });
    expect(error).toMatch(/500 characters/i);
  });

  it('normalizes empty strings to null (full-replace semantics)', () => {
    const { value, error } = validateBrandKitUpdate({
      primaryColorHex: '',
      secondaryColorHex: '   ',
      toneNotes: '',
      logoUrl: '',
    });
    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      primaryColorHex: null,
      secondaryColorHex: null,
      toneNotes: null,
      logoUrl: null,
    });
    // The new profile fields are also normalized to null when absent.
    expect(value).toMatchObject({
      marketingStyle: null,
      brandVoice: null,
      headline: null,
      brandPersonality: null,
      industryStyle: null,
    });
  });

  it('rejects a non-object body', () => {
    expect(validateBrandKitUpdate(null).error).toBeTruthy();
    expect(validateBrandKitUpdate('nope').error).toBeTruthy();
  });

  it('accepts the Branding Studio profile fields', () => {
    const { value, error } = validateBrandKitUpdate({
      marketingStyle: 'Modern & Tech',
      brandVoice: 'Professional but Friendly',
      headline: 'Fast Repairs. Trusted Service.',
      brandPersonality: 'Professional • Friendly • Trustworthy',
      industryStyle: 'Repair & Service Business',
    });
    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      marketingStyle: 'Modern & Tech',
      brandVoice: 'Professional but Friendly',
      headline: 'Fast Repairs. Trusted Service.',
    });
  });

  it('rejects an over-long profile field', () => {
    const { error } = validateBrandKitUpdate({ headline: 'x'.repeat(201) });
    expect(error).toMatch(/headline exceeds/i);
  });
});

describe('BrandKitService.getBrandKit', () => {
  it('maps onboarding_completed_at to an ISO string when set', async () => {
    const { pool, query } = makePool();
    const when = new Date('2026-06-10T12:00:00.000Z');
    query.mockResolvedValueOnce({ rows: [kitRow({ onboarding_completed_at: when })] });

    const kit = await new BrandKitService(pool).getBrandKit('shop_test');

    expect(kit?.onboardingCompletedAt).toBe(when.toISOString());
    // Effective logo = override ?? shop logo (no override here).
    expect(kit?.logoUrl).toBe('https://cdn/shop-logo.png');
  });

  it('returns null onboardingCompletedAt when the column is null', async () => {
    const { pool, query } = makePool();
    query.mockResolvedValueOnce({ rows: [kitRow({ onboarding_completed_at: null })] });

    const kit = await new BrandKitService(pool).getBrandKit('shop_test');

    expect(kit?.onboardingCompletedAt).toBeNull();
  });

  it('returns null when the shop row is missing', async () => {
    const { pool, query } = makePool();
    query.mockResolvedValueOnce({ rows: [] });

    expect(await new BrandKitService(pool).getBrandKit('ghost')).toBeNull();
  });
});

describe('BrandKitService.markOnboardingComplete', () => {
  it('upserts the stamp then re-reads and returns the kit', async () => {
    const { pool, query } = makePool();
    const when = new Date('2026-06-10T12:00:00.000Z');
    // 1st query = the INSERT ... ON CONFLICT upsert; 2nd = getBrandKit SELECT.
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [kitRow({ onboarding_completed_at: when })] });

    const kit = await new BrandKitService(pool).markOnboardingComplete('shop_test');

    expect(query).toHaveBeenCalledTimes(2);
    // The upsert targets onboarding_completed_at, NOT the full-replace columns
    // (a settings save must never clear it).
    const upsertSql = query.mock.calls[0][0] as string;
    expect(upsertSql).toMatch(/INSERT INTO shop_brand_kits/i);
    expect(upsertSql).toMatch(/onboarding_completed_at/i);
    expect(upsertSql).not.toMatch(/primary_color_hex/i);
    expect(kit?.onboardingCompletedAt).toBe(when.toISOString());
  });
});
