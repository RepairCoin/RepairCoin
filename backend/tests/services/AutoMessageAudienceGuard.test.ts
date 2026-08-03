// An EMPTY target audience used to pass validation and then mean two different things.
//
// The guard was `if (targetAudience && !VALID_TARGET_AUDIENCES.includes(targetAudience))`. An empty
// string is falsy, so the one value a form submits by accident was the one value never checked. What
// happened next depended on which write path you were on:
//
//   create() — `params.targetAudience || 'all'` coerced it, so the rule messaged EVERY customer.
//   update() — stored '' verbatim, and the scheduler's audience switch fell to `default: return []`,
//              so the rule messaged NOBODY and said nothing about it.
//
// Found walking the win-back template, where the audience arrived at the builder unset. That template
// runs on `inactive_30_days`, one of only two events that reads the audience at all — so the blast
// radius was "message this shop's entire customer list" on the flagship template.

import * as fs from 'fs';
import * as path from 'path';

/**
 * Assert against CODE, not prose.
 *
 * Both of these comment blocks quote the old broken guard verbatim so the next reader knows what to
 * avoid — which made the first version of this suite match its own explanation and fail. Strip
 * comments first; a test that reads source has to be told where the source ends.
 */
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const controller = stripComments(
  fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'domains', 'messaging', 'controllers', 'AutoMessageController.ts'),
    'utf8'
  )
);
const scheduler = stripComments(
  fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'services', 'AutoMessageSchedulerService.ts'),
    'utf8'
  )
);

describe('target audience validation', () => {
  // Mirrors the guard: reject anything explicitly provided that is not in the allow-list, but let an
  // omitted field through so "leave it alone" / "take the column default" still work.
  const VALID = ['all', 'active', 'inactive_30d', 'has_balance', 'completed_booking'];
  const rejects = (v: unknown) => v !== undefined && !VALID.includes(v as string);

  it('rejects the empty string that used to slip through', () => {
    expect(rejects('')).toBe(true);
  });

  it('rejects null, which is also not a decision the caller made', () => {
    expect(rejects(null)).toBe(true);
  });

  it('rejects an unknown audience', () => {
    expect(rejects('everyone')).toBe(true);
  });

  it('still allows the field to be omitted entirely', () => {
    expect(rejects(undefined)).toBe(false);
  });

  it('allows every audience the engine can actually resolve', () => {
    for (const v of VALID) expect(rejects(v)).toBe(false);
  });

  // The regression is one character wide, and a truthiness check reads as correct at a glance — which
  // is exactly why it survived. Both write paths carry the guard.
  it('guards on undefined rather than truthiness, on both create and update', () => {
    expect((controller.match(/targetAudience !== undefined/g) ?? []).length).toBe(2);
    expect(controller).not.toMatch(/if \(targetAudience &&/);
  });
});

describe('unresolvable audience in the scheduler', () => {
  /**
   * The whole `default:` arm, matched as one unit.
   *
   * An earlier version sliced from the first `default:` to the next `return [];`, which swept in the
   * preceding `case 'all'` block and then asserted against its SQL. Anchoring the arm as a single
   * pattern is both stricter and honest about what it covers.
   */
  const DEFAULT_ARM = /default:\s*logger\.error\(([\s\S]*?)\);\s*return \[\];/;

  // Falling back to 'all' would turn "I could not work out who you meant" into "so I messaged
  // everybody". Enrolling nobody is the safe direction and must stay — and the arm doing NOTHING but
  // log and return [] is what proves there is no fallback hiding in it.
  it('enrols nobody rather than guessing the widest audience', () => {
    expect(scheduler).toMatch(DEFAULT_ARM);
  });

  // The bug was never the empty result, it was that a rule could sit published and active, enrolling
  // nobody forever, with no error and no failed send to find.
  it('logs the rule instead of failing silently', () => {
    const args = scheduler.match(DEFAULT_ARM)?.[1] ?? '';
    expect(args).toMatch(/ruleId/);
    expect(args).toMatch(/shopId/);
    expect(args).toMatch(/targetAudience/);
  });
});
