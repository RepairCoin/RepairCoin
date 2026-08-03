// The recommendation write path used `ON CONFLICT DO NOTHING` against a unique index on
// (shop_id, detector_key, presentation) WHERE acted_at IS NULL. Expiry and dismissal are not in that
// predicate, and nothing in the codebase ever deletes a row — so the first row a detector ever wrote
// for a shop could never be replaced.
//
// The failure was entirely silent. Nightly detection kept finding the condition, kept skipping the
// insert, and three things rotted:
//   - evidence froze (dc_shopu's card read "8 inactive customers" eleven days after it was true),
//   - once expires_at passed the card vanished for good, the dead row still blocking its replacement,
//   - the stored `action` froze, so M2's workflow deep-link never reached any shop whose detectors had
//     already fired — which is every shop with data.
//
// These assertions are on the SQL source because that is where the defect lived: the TypeScript around
// it was correct and a mocked pool would have happily accepted either statement.

import * as fs from 'fs';
import * as path from 'path';

const source = fs.readFileSync(
  path.join(
    __dirname, '..', '..', 'src', 'domains', 'AIAgentDomain', 'services',
    'recommendations', 'RecommendationService.ts'
  ),
  'utf8'
);

/** The INSERT ... ON CONFLICT statement, from INSERT to the end of the template literal. */
function upsertSql(): string {
  const start = source.indexOf('INSERT INTO ai_recommendations');
  expect(start).toBeGreaterThan(-1);
  return source.slice(start, source.indexOf('`,', start));
}

describe('recommendation upsert', () => {
  const sql = upsertSql();

  it('does not silently skip a conflicting row', () => {
    // The whole defect in one line.
    expect(sql).not.toMatch(/ON CONFLICT\s+DO NOTHING/i);
    expect(sql).toMatch(/DO UPDATE SET/i);
  });

  // Bare `ON CONFLICT DO UPDATE` is a syntax error, and naming the wrong columns would infer a
  // different index — the arbiter has to match the partial unique index that actually exists.
  it('infers the partial unique index that exists on the table', () => {
    expect(sql).toMatch(
      /ON CONFLICT\s*\(\s*shop_id\s*,\s*detector_key\s*,\s*presentation\s*\)\s*WHERE\s+acted_at IS NULL/i
    );
  });

  it('refreshes the stored action, so a card points where the current code says it should', () => {
    expect(sql).toMatch(/action\s*=\s*EXCLUDED\.action/i);
  });

  it('refreshes the evidence and copy, so the numbers on a card stay true', () => {
    expect(sql).toMatch(/evidence\s*=\s*EXCLUDED\.evidence/i);
    expect(sql).toMatch(/title\s*=\s*EXCLUDED\.title/i);
    expect(sql).toMatch(/description\s*=\s*EXCLUDED\.description/i);
  });

  it('re-arms an expired row instead of leaving it to block forever', () => {
    expect(sql).toMatch(/expires_at\s*=\s*EXCLUDED\.expires_at/i);
    expect(sql).toMatch(/ai_recommendations\.expires_at\s*<=\s*NOW\(\)/i);
  });

  // A permanent dismissal is the ONE case where a frozen row is the right answer. Resurrecting it
  // because a number moved would make "never show me this again" mean "until Tuesday".
  it('never resurrects a permanently dismissed recommendation', () => {
    expect(sql).toMatch(/ai_recommendations\.dismissed_at IS NULL/i);
  });

  // A snooze already lapses on its own via the read filter. Clearing it here would override the
  // shop's choice the moment nightly detection found a slightly different number.
  it('leaves a snooze alone', () => {
    expect(sql).not.toMatch(/snoozed_until\s*=/i);
  });

  // Without this the statement rewrites every row every night: an UPDATE per detector per shop, each
  // clearing phrased_at and sending the row back through the AI phraser. That is real money for no
  // change in what the shop sees.
  it('is a no-op when an unchanged condition is re-detected', () => {
    expect(sql).toMatch(/IS DISTINCT FROM EXCLUDED\.(title|description|action|evidence)/i);
  });

  // The AI rewrite narrates the numbers that were in the evidence when it ran. Keeping it across a
  // refresh would leave "8 inactive customers" sitting on top of an evidence blob that says 12.
  it('sends a refreshed row back through the phraser', () => {
    expect(sql).toMatch(/ai_title\s*=\s*NULL/i);
    expect(sql).toMatch(/ai_description\s*=\s*NULL/i);
    expect(sql).toMatch(/phrased_at\s*=\s*NULL/i);
  });
});
