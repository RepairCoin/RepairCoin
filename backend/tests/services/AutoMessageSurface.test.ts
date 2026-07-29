// D7 — surface ownership. AI Campaigns (Advanced) and Custom Workflows are two pricing bullets over
// ONE engine and ONE table. `surface` records which screen owns a rule so each list shows only its own.
//
// The property worth protecting is the NEGATIVE one: the scheduler must never filter by surface. A
// workflow that stopped firing because of which screen created it would be absurd, and the failure
// would be silent — the rule sits there looking active while nothing happens.

import * as fs from 'fs';
import * as path from 'path';

const REPO = path.join(__dirname, '..', '..', 'src', 'repositories', 'AutoMessageRepository.ts');
const src = fs.readFileSync(REPO, 'utf8');

/** Body of a method, from its signature to the next method at the same indent. */
function methodBody(name: string): string {
  const start = src.indexOf(`async ${name}(`);
  expect(start).toBeGreaterThan(-1);
  const rest = src.slice(start);
  const end = rest.indexOf('\n  async ', 1);
  return end === -1 ? rest : rest.slice(0, end);
}

describe("D7 — which queries may filter by surface", () => {
  it("the UI list filters by surface", () => {
    expect(methodBody('getByShopId')).toContain('surface');
  });

  // These two are what the scheduler calls every tick.
  it.each(['getActiveScheduleRules', 'getActiveEventRules'])(
    "the engine query %s does NOT filter by surface",
    (fn) => {
      expect(methodBody(fn)).not.toContain('surface');
    }
  );

  it("defaults to 'campaign' — the only surface that has ever existed", () => {
    expect(methodBody('getByShopId')).toContain("surface: AutoMessageSurface | null = 'campaign'");
  });
});
