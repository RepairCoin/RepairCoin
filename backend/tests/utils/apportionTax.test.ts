import { apportionTax } from '../../src/utils/apportionTax';

const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
const t = (id: string, amountCents: number) => ({ id, amountCents });

describe('apportionTax', () => {
  it('puts the whole tax on a single tender', () => {
    const out = apportionTax(800, [t('a', 10800)]);
    expect(out.get('a')).toBe(800);
  });

  it('splits evenly when the tenders are equal', () => {
    const out = apportionTax(800, [t('a', 5400), t('b', 5400)]);
    expect([...out.values()]).toEqual([400, 400]);
  });

  it('splits pro rata by tender size', () => {
    const out = apportionTax(100, [t('a', 300), t('b', 700)]);
    expect(out.get('a')).toBe(30);
    expect(out.get('b')).toBe(70);
  });

  // The reason this helper exists: three-way integer division loses cents, and a ledger that
  // loses a cent per split sale stops reconciling with the sale it came from.
  it('gives the rounding remainder to the largest leg so the total is exact', () => {
    const out = apportionTax(7, [t('a', 100), t('b', 100), t('c', 100)]);
    expect(sum(out)).toBe(7);
    expect([...out.values()].sort()).toEqual([2, 2, 3]);
  });

  it('is exact across a range of awkward splits', () => {
    for (let tax = 0; tax <= 250; tax += 7) {
      for (const legs of [
        [t('a', 333), t('b', 333), t('c', 334)],
        [t('a', 1), t('b', 9999)],
        [t('a', 4321), t('b', 8765), t('c', 13)],
      ]) {
        expect(sum(apportionTax(tax, legs))).toBe(tax);
      }
    }
  });

  // RCN covering more than the pre-tax value of the goods. Zero revenue is defensible;
  // negative revenue, which is what an unclamped gross - tax would produce, is not.
  it('clamps to the tenders total so revenue can never go negative', () => {
    const out = apportionTax(800, [t('a', 300)]);
    expect(out.get('a')).toBe(300);
  });

  it('returns zeros when there is no tax', () => {
    const out = apportionTax(0, [t('a', 5000), t('b', 2500)]);
    expect([...out.values()]).toEqual([0, 0]);
  });

  it('handles no tenders and zero-value tenders without dividing by zero', () => {
    expect(apportionTax(500, []).size).toBe(0);
    const out = apportionTax(500, [t('a', 0), t('b', 0)]);
    expect(sum(out)).toBe(0);
  });

  it('never returns a negative share', () => {
    const out = apportionTax(-100, [t('a', 500)]);
    expect(out.get('a')).toBe(0);
  });
});
