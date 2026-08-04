// Any route that generates an image server-side has to be in SLOW_AI_PATHS, or the 30s default
// timeout kills the socket mid-generation and the platform returns its own error page — which is
// exactly what happened to /campaigns/ai-draft: 40s, then a 504, and a toast saying nothing useful.
//
// gpt-image-1 has been observed up to ~81s. Anything slower than a database call and an LLM round
// trip does not fit in 30 seconds, and finding that out in production costs a deploy cycle.

import * as fs from 'fs';
import * as path from 'path';

const app = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'app.ts'), 'utf8');

const slowPaths = (() => {
  const start = app.indexOf('const SLOW_AI_PATHS');
  const block = app.slice(start, app.indexOf('];', start));
  return [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
})();

describe('routes that generate images server-side', () => {
  it('exempts the workflow builder\'s AI campaign drafter', () => {
    expect(slowPaths).toContain('/campaigns/ai-draft');
  });

  // The matcher is `req.path.includes(p)`, so a near-miss silently fails to match. '/draft' does NOT
  // cover '/campaigns/ai-draft' — the substring is '-draft'.
  it('matches the real path, not one that merely looks similar', () => {
    const realPath = '/api/marketing/shops/peanut/campaigns/ai-draft';
    expect(slowPaths.some((p) => realPath.includes(p))).toBe(true);
  });

  it('still exempts the image and assistant routes it always did', () => {
    for (const p of ['/ai/images', '/ai/orchestrate', '/ai/brand-kit/generate-banner']) {
      expect(slowPaths).toContain(p);
    }
  });
});
