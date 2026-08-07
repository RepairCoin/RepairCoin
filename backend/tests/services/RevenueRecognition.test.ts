import { describe, it, expect } from '@jest/globals';
import { revenueRecognized, ledgerRevenueCents } from '../../src/utils/sqlFragments';
import * as fs from 'fs';
import * as path from 'path';

/**
 * The arithmetic evaluated by hand, in the same order Postgres does it. Not a substitute for
 * running the SQL — it is a statement of what the expression is supposed to mean, so a future
 * edit that changes the meaning has to change this too and say why.
 */
const revenueOf = (grossCents: number, taxCents: number, refundedCents: number): number =>
  grossCents === 0
    ? 0
    : Math.round(((grossCents - refundedCents) * (grossCents - taxCents)) / grossCents);

describe('ledgerRevenueCents', () => {
  it('scales tax down with a refund instead of subtracting all of it', () => {
    // The bug this replaced: `gross - tax - refunded` on a fully refunded counter sale gave
    // 10825 - 825 - 10825 = -825, so a refund cost the shop more revenue than the sale ever
    // earned. Invisible until S6d, because only bookings could be refunded and they carry no tax.
    expect(10825 - 825 - 10825).toBe(-825);
    expect(revenueOf(10825, 825, 10825)).toBe(0);
  });

  it('is unchanged for a sale nobody refunded', () => {
    expect(revenueOf(10825, 825, 0)).toBe(10000);
  });

  it('leaves the untouched share of a partial refund', () => {
    // $50 off a $108.25 sale returns goods and their tax together, so $53.81 of goods remain.
    expect(revenueOf(10825, 825, 5000)).toBe(5381);
  });

  it('still answers correctly for a booking, which carries no tax', () => {
    expect(revenueOf(12000, 0, 0)).toBe(12000);
    expect(revenueOf(12000, 0, 12000)).toBe(0);
    expect(revenueOf(12000, 0, 6000)).toBe(6000);
  });

  it('survives a zero-gross row rather than nulling the whole SUM', () => {
    expect(ledgerRevenueCents('p')).toContain('NULLIF(p.gross_cents, 0)');
    expect(ledgerRevenueCents('p')).toContain('COALESCE');
    expect(revenueOf(0, 0, 0)).toBe(0);
  });

  it('qualifies every column with the alias, and none without one', () => {
    const aliased = ledgerRevenueCents('x');
    expect(aliased).toContain('x.gross_cents');
    expect(aliased).toContain('x.tax_cents');
    expect(aliased).toContain('x.refunded_cents');
    expect(ledgerRevenueCents('')).not.toContain('.gross_cents');
  });
});

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
    'src/services/ShopMetricsService.ts',
  ])('%s does not inline the ledger revenue expression', (rel) => {
    expect(read(rel)).not.toContain('gross_cents - tax_cents');
    // The dashboard tile's own drift was this shape, not the one above: `gross - refunded` with
    // the tax never taken out at all, which read higher than every other revenue surface.
    expect(read(rel)).not.toContain('gross_cents - p.refunded_cents');
  });

  // Revenue is three separate questions — did the money arrive, whose money is it, how much counts
  // — and a site that answers only the first two counts a shop's own rcn_purchase spending and its
  // held deposits as earnings. The tile did exactly that until S6d.
  //
  // Only the tile is checked directly. CustomerRepository reaches the same restriction through
  // CUSTOMER_SPEND_FROM_LEDGER, which is the point of that constant.
  it('the dashboard tile restricts the ledger to money a customer paid this shop', () => {
    expect(read('src/services/ShopMetricsService.ts')).toContain('ledgerCustomerRevenue');
  });

  it('the dashboard tile reads the ledger, not service_orders', () => {
    // Counter sales exist only in the ledger, so a tile sourced from service_orders can never
    // show them however the predicate is written.
    const source = read('src/services/ShopMetricsService.ts');
    expect(source).toContain('FROM payments p');
    expect(source).toContain('captured_at');
  });
});
