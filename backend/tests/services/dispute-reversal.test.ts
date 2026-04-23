/**
 * DisputeController.reverseNoShowPenalty — regression guard
 *
 * Context: a typo (`nocctes` instead of `notes`) was shipped in the
 * reversal SQL at DisputeController.ts:696. It caused every dispute
 * approval to throw `column "nocctes" does not exist` at runtime.
 * The function is module-private, so we guard with a static check on
 * the source file rather than a direct unit call.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

const CONTROLLER_PATH = join(
  __dirname,
  '../../src/domains/ServiceDomain/controllers/DisputeController.ts'
);

describe('DisputeController.reverseNoShowPenalty SQL', () => {
  const source = readFileSync(CONTROLLER_PATH, 'utf8');

  it('does not reference the historical `nocctes` typo', () => {
    expect(source).not.toMatch(/nocctes/);
  });

  it('references `notes NOT LIKE` in the effective-count query', () => {
    expect(source).toMatch(/notes\s+NOT\s+LIKE\s+'%\[DISPUTE_REVERSED\]%'/);
  });

  it('marks reversed records with [DISPUTE_REVERSED] in notes (not deletion)', () => {
    expect(source).toMatch(/\[DISPUTE_REVERSED\]/);
  });
});
