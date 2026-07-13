// Phase 3 — service/catalog import parity (Square migration). Covers the parser mapping override
// and the category coercion (unrecognized categories default to other_local_services instead of
// failing the row — the key unblocker for an external catalog).

import { parseServiceExcel } from '../src/utils/excelParser';
import { ImportExportService } from '../src/domains/ServiceDomain/services/ImportExportService';

describe('service excelParser — explicit mapping override', () => {
  it('maps non-standard catalog headers via override', async () => {
    const csv = 'Item Title,Item Price,Item Group\nDeep Clean,49.99,Detailing\n';
    const rows = await parseServiceExcel(Buffer.from(csv), 'csv', {
      serviceName: 'Item Title', priceUsd: 'Item Price', category: 'Item Group',
    });
    expect(rows.length).toBe(1);
    expect(rows[0].serviceName).toBe('Deep Clean');
    expect(rows[0].priceUsd).toBe(49.99);
  });
});

describe('service validateImportData — category coercion + skip-invalid', () => {
  const svc = new ImportExportService();

  it('defaults an unrecognized category to other_local_services and keeps the row', async () => {
    const rows = await parseServiceExcel(Buffer.from('Service Name,Price,Category\nMassage,80,Spa Treatments\n'), 'csv');
    const report = await svc.validateImportData(rows, 'shop1');
    expect(report.validServices.length).toBe(1);
    expect(report.validServices[0].category).toBe('other_local_services');
    expect(report.invalidRows).toBe(0);
  });

  it('keeps a recognized category as-is', async () => {
    const rows = await parseServiceExcel(Buffer.from('Service Name,Price,Category\nOil Change,40,automotive_services\n'), 'csv');
    const report = await svc.validateImportData(rows, 'shop1');
    expect(report.validServices[0].category).toBe('automotive_services');
  });

  it('keeps a $0 "variable" price row with a ZERO_PRICE warning (quote-on-request)', async () => {
    const rows = await parseServiceExcel(Buffer.from('Service Name,Price,Category\nFreebie,0,repairs\n'), 'csv');
    const report = await svc.validateImportData(rows, 'shop1');
    expect(report.validServices.length).toBe(1);
    expect(report.invalidRows).toBe(0);
    expect(report.warnings.some((w) => w.code === 'ZERO_PRICE')).toBe(true);
  });

  it('skips (does not import) a row with a negative price', async () => {
    const rows = await parseServiceExcel(Buffer.from('Service Name,Price,Category\nBadRow,-5,repairs\n'), 'csv');
    const report = await svc.validateImportData(rows, 'shop1');
    expect(report.validServices.length).toBe(0);
    expect(report.invalidRows).toBe(1);
  });
});
