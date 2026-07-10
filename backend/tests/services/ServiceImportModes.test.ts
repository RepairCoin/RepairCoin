// Service import MODES — proves the add/merge/replace branching in processImportBatch by driving the
// real importShopServices with a fake DB client that records the SQL it receives. No live DB / AI:
// the pool + shopRepository are monkeypatched and the mapping service is module-mocked.

jest.mock('../../src/domains/customer/services/CustomerImportMappingService', () => ({
  serviceImportMappingService: { mapCategories: async () => ({ mapping: {}, costUsd: 0 }) },
}));

import { ImportExportService } from '../../src/domains/ServiceDomain/services/ImportExportService';

const CSV = [
  'Token,Item Name,Price,Categories,Square Online Item Visibility',
  'T1,Screen Repair,100,Repairs,visible',
  'T2,Battery Swap,50,Repairs,visible',
].join('\n');

// Fake pg client that records the first line of each SQL. `existing` controls whether the
// "find existing service" SELECT reports a match (merge/add) or nothing (post-replace / net-new).
function makeService(existing: boolean) {
  const queries: string[] = [];
  const client: any = {
    query: async (sql: string) => {
      const head = String(sql).trim().split('\n')[0].trim();
      queries.push(head);
      if (/SELECT service_id FROM shop_services/i.test(sql)) {
        return existing ? { rows: [{ service_id: 'existing-id' }], rowCount: 1 } : { rows: [], rowCount: 0 };
      }
      if (/DELETE FROM shop_services/i.test(sql)) return { rows: [], rowCount: 3 };
      return { rows: [], rowCount: 0 };
    },
    release: () => {},
  };
  const svc = new ImportExportService();
  (svc as any).pool = { connect: async () => client };
  (svc as any).shopRepository = { getShop: async () => ({ verified: true, active: true, subscriptionActive: true, rcg_balance: 0 }) };
  return { svc, queries };
}

const run = (svc: ImportExportService, mode: 'add' | 'merge' | 'replace') =>
  (svc as any).importShopServices('shop1', Buffer.from(CSV, 'utf8'), 'catalog.csv', 'csv', CSV.length, 'test', { mode, dryRun: false });

const has = (queries: string[], re: RegExp) => queries.some((q) => re.test(q));

describe('service import modes', () => {
  it('REPLACE deletes all the shop services first, then inserts', async () => {
    const { svc, queries } = makeService(false); // post-delete → nothing existing → inserts
    await run(svc, 'replace');
    expect(has(queries, /DELETE FROM shop_services/i)).toBe(true);
    expect(has(queries, /INSERT INTO shop_services/i)).toBe(true);
  });

  it('MERGE updates an existing service (no delete)', async () => {
    const { svc, queries } = makeService(true); // existing found → update path
    await run(svc, 'merge');
    expect(has(queries, /UPDATE shop_services SET/i)).toBe(true);
    expect(has(queries, /DELETE FROM shop_services/i)).toBe(false);
  });

  it('ADD skips existing services (no update, no delete, no insert of the dupes)', async () => {
    const { svc, queries } = makeService(true); // existing found → skipped
    await run(svc, 'add');
    expect(has(queries, /UPDATE shop_services SET/i)).toBe(false);
    expect(has(queries, /INSERT INTO shop_services/i)).toBe(false);
    expect(has(queries, /DELETE FROM shop_services/i)).toBe(false);
  });
});
