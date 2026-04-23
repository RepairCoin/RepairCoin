/**
 * DisputeController.reverseNoShowPenalty — static sanity guard.
 *
 * The real coverage for this function lives in
 * `backend/tests/integration/no-show-sql.test.ts`, which runs the actual
 * SQL against Postgres. This file stays as a one-line cheap guard
 * against the specific `nocctes` typo that caused the original incident
 * — any future reintroduction fails fast without needing the integration
 * DB set up.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

const CONTROLLER_PATH = join(
  __dirname,
  '../../src/domains/ServiceDomain/controllers/DisputeController.ts'
);

describe('DisputeController — historical typo guard', () => {
  it('does not reference the `nocctes` column typo', () => {
    const source = readFileSync(CONTROLLER_PATH, 'utf8');
    // Match only as a standalone identifier to avoid false-positives on
    // comments like "historical typo: nocctes" — require a non-word
    // boundary immediately adjacent to column-position characters.
    expect(source).not.toMatch(/[\s."(]nocctes[\s."(]/);
  });
});
