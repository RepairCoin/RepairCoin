// Matches a homepage visitor's question to a prospect-corpus article — WITHOUT a model.
//
// This is the whole of P1. The homepage box answers from `backend/help-prospect/` and calls no model
// at all, which means the worst case on launch day is a static site rather than a bill. A model
// fallback for the long tail comes later, and only once the logs say what the tail actually is.
//
// Why a plain scorer rather than embeddings: with ~9 articles and a curated list of real phrasings per
// article, lexical scoring is both good enough and *inspectable*. When it gets an answer wrong you can
// see why in one line, and fix it by editing a markdown file rather than re-indexing anything.

import { HelpCorpusLoader, type ArticleEntry } from './HelpCorpusLoader';
import * as path from 'path';
import { logger } from '../../../utils/logger';

/** Where the prospect corpus lives. Sibling of `backend/help/`, copied to dist by the postbuild step. */
export const PROSPECT_CORPUS_DIR = path.join(__dirname, '..', '..', '..', '..', 'help-prospect');

export interface ProspectArticle {
  filename: string;
  /** The `# heading` — the question the article answers. */
  title: string;
  /** Everything above `## Next step`, which is what gets shown as the answer. */
  answer: string;
  /** The `## Next step` line — this article's own call to action. */
  nextStep: string;
  /** Phrasings from `## People ask this as`, lower-cased. */
  phrasings: string[];
}

export interface MatchResult {
  article: ProspectArticle;
  score: number;
}

/**
 * Words carrying no signal. Deliberately short: an aggressive stop-list starts removing the words that
 * distinguish articles ("free", "cost", "work") and the matcher quietly gets worse.
 */
const STOP = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'can', 'do', 'does', 'for', 'from', 'get',
  'have', 'how', 'i', 'if', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'that', 'the', 'this',
  'to', 'was', 'what', 'when', 'where', 'which', 'will', 'with', 'you', 'your',
]);

const normalise = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

const tokens = (s: string): string[] =>
  normalise(s).split(' ').filter((w) => w.length > 2 && !STOP.has(w));

/**
 * Below this, we do not have an answer — say so and offer the fallback rather than serving the
 * least-bad article. A confidently wrong answer on the homepage is worse than "I don't know that one",
 * because the visitor cannot tell it is wrong and we have spent their trust finding out.
 *
 * MEASURED, not guessed (`scripts/_qa_matcher_scores.ts`, 2026-08-07). Against the real corpus, 16
 * genuine questions scored 7–29 and 9 junk ones scored 0–4, so 6 sits in the gap. It started at 2,
 * which let "write me a python script" reach the marketing article on the strength of the word
 * "write" alone.
 *
 * Re-run that script after any substantial corpus edit. The gap is real but not enormous — the
 * weakest genuine question scored 7 — and adding articles narrows it. A wrong call errs toward the
 * fallback, which is a friendly answer rather than a broken one.
 */
export const MIN_SCORE = 6;

export class ProspectCorpusMatcher {
  private readonly articles: ProspectArticle[];

  constructor(corpusDir: string = PROSPECT_CORPUS_DIR) {
    // Reuses the existing loader — it already takes a corpusDir, so a second corpus needs no second
    // loader and inherits the same file-reading and title-extraction behaviour.
    const entries = new HelpCorpusLoader(corpusDir).getArticleIndex();
    this.articles = entries
      .filter((e) => e.filename.toLowerCase() !== 'readme.md')
      .map((e) => ProspectCorpusMatcher.parse(e));
    logger.info('ProspectCorpusMatcher loaded', { articles: this.articles.length });
  }

  /** Split an article into the answer body, its CTA, and the phrasings that should reach it. */
  private static parse(entry: ArticleEntry): ProspectArticle {
    const body = entry.body;

    const phrasings = (body.match(/##\s*People ask this as\s*\n([\s\S]*?)(?=\n##\s|\n*$)/i)?.[1] ?? '')
      .split('\n')
      .map((l) => l.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean)
      .map((l) => l.toLowerCase());

    const nextStep = (body.match(/##\s*Next step\s*\n([\s\S]*?)$/i)?.[1] ?? '').trim();

    // The answer is everything before the two meta sections — a visitor should never be shown the
    // phrasing list, which reads as a list of questions they did not ask.
    const answer = body
      .replace(/##\s*People ask this as\s*\n[\s\S]*?(?=\n##\s|$)/i, '')
      .replace(/##\s*Next step\s*\n[\s\S]*$/i, '')
      .trim();

    return { filename: entry.filename, title: entry.title, answer, nextStep, phrasings };
  }

  /**
   * Score every article and return the best, or null when nothing clears MIN_SCORE.
   *
   * Scoring, in order of weight:
   *   +6  the question is essentially one of the curated phrasings
   *   +3  per distinct word shared with a phrasing — where the curated list does the work
   *   +2  per distinct word shared with the title
   *   +1  per distinct word appearing in the body
   *
   * The phrasing list outweighs the body on purpose. Body text is long and repeats generic product
   * words, so unweighted body matching makes every article look plausible for every question.
   */
  match(question: string): MatchResult | null {
    const qNorm = normalise(question);
    const qTokens = new Set(tokens(question));
    if (qTokens.size === 0) return null;

    let best: MatchResult | null = null;

    for (const article of this.articles) {
      let score = 0;

      for (const p of article.phrasings) {
        const pNorm = normalise(p);
        // Near-exact: the visitor asked a question we explicitly anticipated.
        if (pNorm === qNorm || (qNorm.length > 8 && (pNorm.includes(qNorm) || qNorm.includes(pNorm)))) {
          score += 6;
        }
      }

      const phraseWords = new Set(article.phrasings.flatMap((p) => tokens(p)));
      const titleWords = new Set(tokens(article.title));
      const bodyWords = new Set(tokens(article.answer));

      for (const w of qTokens) {
        if (phraseWords.has(w)) score += 3;
        if (titleWords.has(w)) score += 2;
        else if (bodyWords.has(w)) score += 1;
      }

      if (!best || score > best.score) best = { article, score };
    }

    if (!best || best.score < MIN_SCORE) return null;
    return best;
  }

  /** Exposed for the admin/debug view and for tests. */
  listArticles(): ProspectArticle[] {
    return this.articles;
  }
}

let _instance: ProspectCorpusMatcher | null = null;
export function getProspectCorpusMatcher(): ProspectCorpusMatcher {
  if (!_instance) _instance = new ProspectCorpusMatcher();
  return _instance;
}

/** Tests only. */
export function __resetProspectCorpusMatcher(): void {
  _instance = null;
}
