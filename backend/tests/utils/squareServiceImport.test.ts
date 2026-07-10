// Square catalog → service import: the parser handling for a Square export (Token → externalRef,
// "variable" price → 0, visibility → active, Categories → category) + zero-price validation.
import { parseServiceExcel, validateServiceRow } from '../../src/utils/excelParser';

const SQUARE_CSV = [
  'Token,Item Name,Description,Categories,Price,Square Online Item Visibility',
  'ABC123,Screen Repair,Fix cracked screen,Repairs,140.00,visible',
  'XYZ789,PlayStation 5 Repair,,Game Console Repairs,variable,visible',
  'ARCH01,Old Accessory,,Accessories,20.00,unavailable',
].join('\n');

describe('Square service import — parser', () => {
  it('maps Square columns and handles variable price + visibility', async () => {
    const rows = await parseServiceExcel(Buffer.from(SQUARE_CSV, 'utf8'), 'csv');
    expect(rows).toHaveLength(3);

    const byName = Object.fromEntries(rows.map((r) => [r.serviceName, r]));

    // Normal item
    expect(byName['Screen Repair'].externalRef).toBe('ABC123');   // Token → externalRef
    expect(byName['Screen Repair'].priceUsd).toBe(140);
    expect(byName['Screen Repair'].active).toBe(true);            // visible → active
    expect(byName['Screen Repair'].category.toLowerCase()).toContain('repair');

    // Variable price → 0 (quote-on-request), still imported
    expect(byName['PlayStation 5 Repair'].priceUsd).toBe(0);
    expect(byName['PlayStation 5 Repair'].externalRef).toBe('XYZ789');

    // Unavailable → inactive
    expect(byName['Old Accessory'].active).toBe(false);
    expect(byName['Old Accessory'].priceUsd).toBe(20);
  });
});

describe('Square service import — zero (variable) price is valid', () => {
  const CATS = ['repairs'];
  it('validates a $0 (variable) service as a warning, not a price error', () => {
    const r = validateServiceRow({ rowIndex: 1, serviceName: 'PS5 Repair', priceUsd: 0, category: 'repairs', active: true } as any, 'shop1', CATS);
    expect(r.errors.some((e) => e.code === 'INVALID_PRICE')).toBe(false);
    expect(r.warnings.some((w) => w.code === 'ZERO_PRICE')).toBe(true);
  });
  it('still rejects a negative price', () => {
    const r = validateServiceRow({ rowIndex: 1, serviceName: 'X', priceUsd: -5, category: 'repairs', active: true } as any, 'shop1', CATS);
    expect(r.errors.some((e) => e.code === 'INVALID_PRICE')).toBe(true);
  });
});
