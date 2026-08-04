import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Repo hygiene, and it lives in the backend suite only because that is the one test runner this
 * project has — the thing being guarded is mostly frontend source.
 *
 * A literal Stripe key checked into a fallback is the specific failure this exists to stop:
 * `process.env.X || "pk_test_…"` reads as defensive, but the literal belongs to whichever account
 * it was copied from, so the branch that looks like a safety net is the one that sends card entry
 * to a stranger's account. In test mode against a live backend it takes card details that never
 * charge, and the customer sees success either way.
 */
const ROOTS = ['backend/src', 'frontend/src'];
const KEY_PATTERN = /\b(pk|sk|rk)_(test|live)_[A-Za-z0-9]{16,}/;

function sourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === 'node_modules' ? [] : sourceFiles(full);
    }
    return /\.(ts|tsx|js|jsx)$/.test(entry.name) ? [full] : [];
  });
}

describe('no hardcoded Stripe keys in source', () => {
  const repoRoot = path.join(__dirname, '../../..');

  it('finds source to scan', () => {
    const files = ROOTS.flatMap((r) => sourceFiles(path.join(repoRoot, r)));
    // Guards the guard: a wrong path would make every assertion below vacuously pass.
    expect(files.length).toBeGreaterThan(100);
  });

  it.each(ROOTS)('%s contains no literal key', (root) => {
    const offenders = sourceFiles(path.join(repoRoot, root))
      .filter((f) => KEY_PATTERN.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(repoRoot, f));

    expect(offenders).toEqual([]);
  });
});
