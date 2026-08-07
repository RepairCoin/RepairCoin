// The homepage matcher, run against the REAL corpus in `backend/help-prospect/`.
//
// Deliberately not a fixture. The thing that decides whether this feature works is whether the actual
// articles answer the actual questions, and a synthetic corpus would test the scorer while proving
// nothing about the corpus. When one of these fails, the fix is usually to add a phrasing to a
// markdown file — which is exactly the maintenance loop the feature is designed around.

import { ProspectCorpusMatcher, MIN_SCORE } from '../../src/domains/AIAgentDomain/services/ProspectCorpusMatcher';

const matcher = new ProspectCorpusMatcher();

const answers = (q: string) => matcher.match(q)?.article.filename ?? null;

describe('the corpus answers the questions people actually ask', () => {
  // One per article, phrased as a visitor would type it — not as the article titles it.
  it.each([
    ['how much does it cost', 'pricing-and-plans.md'],
    ['is there a free trial', 'pricing-and-plans.md'],
    ['whats the cheapest plan', 'pricing-and-plans.md'],
    ['what is fixflow', 'what-is-fixflow.md'],
    ['does this work for a barbershop', 'is-it-right-for-my-business.md'],
    ['i run a gym is this for me', 'is-it-right-for-my-business.md'],
    ['can customers book online', 'bookings-and-scheduling.md'],
    ['how do i stop double bookings', 'bookings-and-scheduling.md'],
    ['do you have a loyalty program', 'customer-rewards.md'],
    ['is this crypto', 'customer-rewards.md'],
    ['can ai answer my customers', 'ai-features.md'],
    ['can it write promotions', 'marketing-and-campaigns.md'],
    ['how do i bring back customers who stopped coming', 'marketing-and-campaigns.md'],
    ['how do i sign up', 'getting-started.md'],
    ['how long does setup take', 'getting-started.md'],
    ['i use another booking system why switch', 'switching-from-another-tool.md'],
  ])('%s → %s', (question, expected) => {
    expect(answers(question)).toBe(expected);
  });
});

describe('it refuses rather than guessing', () => {
  // A confidently wrong answer is worse than "I don't know that one": the visitor cannot tell it is
  // wrong, and we spend their trust while they find out.
  //
  // These are the questions that set MIN_SCORE. At the original floor of 2, "write me a python script"
  // reached the marketing article on the word "write" alone — a single body hit was enough to look
  // like an answer.
  it.each([
    'what is the capital of France',
    'write me a python script',
    'write an essay about dogs',
    'tell me a joke',
    'who won the world cup',
    'translate this to spanish',
    'what is the weather',
  ])('refuses: %s', (junk) => {
    expect(matcher.match(junk)).toBeNull();
  });

  it('returns null for input with no usable words', () => {
    expect(matcher.match('')).toBeNull();
    expect(matcher.match('?!?!')).toBeNull();
    expect(matcher.match('the a an of')).toBeNull();
  });

  it('never returns a match below the score floor', () => {
    for (const q of ['pricing', 'book', 'ai', 'hello there', 'thanks']) {
      const m = matcher.match(q);
      if (m) expect(m.score).toBeGreaterThanOrEqual(MIN_SCORE);
    }
  });
});

describe('what gets shown to a visitor', () => {
  const article = () => matcher.match('how much does it cost')!.article;

  it('never leaks the phrasing list into the answer', () => {
    // It reads as a list of questions the visitor did not ask, and gives away the matching mechanism.
    expect(article().answer).not.toMatch(/People ask this as/i);
    expect(article().answer).not.toMatch(/how much is it per month/i);
  });

  it('never leaks the CTA into the answer body — it is rendered separately', () => {
    expect(article().answer).not.toMatch(/## Next step/i);
  });

  it('carries a non-empty next step', () => {
    // The per-article CTA is the conversion mechanic. An article without one silently degrades to a
    // dead end, and nothing else would catch it.
    for (const a of matcher.listArticles()) {
      expect(a.nextStep.length).toBeGreaterThan(0);
    }
  });

  it('excludes the README, which is authoring guidance and not an answer', () => {
    expect(matcher.listArticles().map((a) => a.filename)).not.toContain('README.md');
  });
});

describe('every article is reachable', () => {
  it('each one wins for at least one of its own phrasings', () => {
    // Catches an article that exists but can never be returned, because another one outscores it on
    // every phrasing it lists — a silent hole that is invisible from reading the corpus.
    const unreachable: string[] = [];
    for (const a of matcher.listArticles()) {
      const reachable = a.phrasings.some((p) => matcher.match(p)?.article.filename === a.filename);
      if (!reachable) unreachable.push(a.filename);
    }
    expect({ unreachable }).toEqual({ unreachable: [] });
  });
});
