import { describe, it, expect } from '@jest/globals';
import { revenueRecognized } from '../../src/utils/sqlFragments';
import * as fs from 'fs';
import * as path from 'path';

describe('revenueRecognized', () => {
  it('requires the money to have arrived, not just the work to be done', () => {
    const sql = revenueRecognized();
    expect(sql).toContain("status IN ('paid', 'completed')");
    expect(sql).toContain("payment_status = 'paid'");
  });

  it('qualifies BOTH halves with the alias', () => {
    // Aliasing only the first half leaves a bare `payment_status` that is ambiguous the moment
    // the query joins anything else carrying that column — and it fails at runtime, not build.
    expect(revenueRecognized('o')).toBe(
      "o.status IN ('paid', 'completed') AND o.payment_status = 'paid'"
    );
    expect(revenueRecognized('so')).toBe(
      "so.status IN ('paid', 'completed') AND so.payment_status = 'paid'"
    );
  });

  it('leaves the columns unqualified when there is no alias', () => {
    expect(revenueRecognized()).toBe(
      "status IN ('paid', 'completed') AND payment_status = 'paid'"
    );
  });
});

/**
 * The predicate was duplicated 26 times across these files before it was extracted. A copy
 * reintroduced by hand would silently start counting unpaid work as revenue again, and no type
 * error would catch it — so the absence of the bare form is asserted directly.
 */
describe('no money query counts fulfilment status alone', () => {
  const read = (rel: string) => fs.readFileSync(path.join(__dirname, '../..', rel), 'utf8');

  const files = [
    'src/repositories/ServiceAnalyticsRepository.ts',
    'src/services/ShopMetricsService.ts',
    'src/repositories/CustomerRepository.ts',
  ];

  it.each(files)('%s has no bare fulfilment-status predicate', (rel) => {
    expect(read(rel)).not.toContain("status IN ('paid', 'completed')");
  });

  // Which shared fragment a file should be importing moved as revenue moved to the ledger.
  // ServiceAnalyticsRepository still needs `revenueRecognized` for the RCN and volume halves that
  // stayed on service_orders; CustomerRepository's money is now entirely ledger-derived (S9c-3),
  // so requiring `revenueRecognized` there would force back a predicate it no longer has any use
  // for. The invariant being protected is unchanged: import the fragment, never inline a copy.
  it.each([
    ['src/repositories/ServiceAnalyticsRepository.ts', 'revenueRecognized'],
    ['src/repositories/CustomerRepository.ts', 'CUSTOMER_SPEND_FROM_LEDGER'],
    ['src/repositories/ShopRepository.ts', 'ledgerRevenueCents'],
  ])('%s imports its money predicate instead of inlining one', (rel, fragment) => {
    expect(read(rel)).toContain(fragment);
  });

  // The ledger arithmetic is as copyable as the predicate was, and a hand-written variant that
  // forgets `- tax_cents` reports sales tax as revenue. It belongs in sqlFragments only.
  it.each([
    'src/repositories/ServiceAnalyticsRepository.ts',
    'src/repositories/CustomerRepository.ts',
    'src/repositories/ShopRepository.ts',
  ])('%s does not inline the ledger revenue expression', (rel) => {
    expect(read(rel)).not.toContain('gross_cents - tax_cents');
  });

  it('the dashboard tile reads the ledger, not service_orders', () => {
    // Counter sales exist only in the ledger, so a tile sourced from service_orders can never
    // show them however the predicate is written.
    const source = read('src/services/ShopMetricsService.ts');
    expect(source).toContain('FROM payments p');
    expect(source).toContain('captured_at');
  });
});
