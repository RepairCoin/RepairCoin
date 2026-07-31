// A4 — draft vs published.
//
// Before this, a rule went LIVE the moment it was saved: is_active defaults to true and the engine only
// checked is_active. Harmless when the only action was a message. Not harmless once a shop can pick the
// "Post-repair follow-up" template, press Save, and begin issuing 25 RCN on every completed booking —
// having never pressed anything called "activate".
//
// The load-bearing rule is the negative one: a draft must NEVER fire. A draft that still ran would be
// worse than having no draft state, because it reads as "not live yet" while quietly sending.

import * as fs from 'fs';
import * as path from 'path';

const repo = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'repositories', 'AutoMessageRepository.ts'),
  'utf8'
);

/** Every query the ENGINE uses to decide what runs. */
const ENGINE_QUERIES = ['getActiveEventRules', 'getActiveScheduleRules', 'getAllActiveEventRulesByType'];

function methodBody(name: string): string {
  const start = repo.indexOf(`async ${name}(`);
  expect(start).toBeGreaterThan(-1);
  const rest = repo.slice(start);
  const end = rest.indexOf('\n  async ', 1);
  return end === -1 ? rest : rest.slice(0, end);
}

describe('A4 — a draft never runs', () => {
  it.each(ENGINE_QUERIES)('%s requires status=published', (fn) => {
    expect(methodBody(fn)).toContain("status = 'published'");
  });

  // Draft is not the same as paused, and conflating them would lose the distinction between
  // "never been live" and "was live, owner stopped it".
  it.each(ENGINE_QUERIES)('%s still requires is_active as well', (fn) => {
    expect(methodBody(fn)).toContain('is_active = true');
  });

  it('defaults to published so every existing rule stays live', () => {
    expect(repo).toContain("params.status ?? 'published'");
    // and rows written before the column existed
    expect(repo).toContain("status: (row.status as AutoMessageStatus) || 'published'");
  });

  it('publishing is shop-scoped — one shop can never publish another\'s workflow', () => {
    const body = methodBody('publish');
    expect(body).toContain('shop_id = $2');
    expect(body).toContain("status = 'published'");
  });
});
