// P3 — the model answers homepage questions, grounded in the prospect corpus.
//
// P1 matched keywords against articles. The first three real questions showed why that cannot work
// here: "normally we only get few customer during monday" is not a question, it is someone telling us
// about their business, and there are no keywords to match. You cannot enumerate the ways a person
// describes their own shop. On a conversational surface, corpus-as-matcher is the wrong shape.
//
// So the corpus changes job: it stops being the matcher and becomes the FACTS the model is allowed to
// use. That is the same shape as the in-dashboard How-To Assistant, and it keeps the reason the corpus
// existed — a model that can only speak from approved copy cannot invent a price or a feature.
//
// The whole corpus goes in the system prompt with cache_control, because it is identical on every
// call. Cached reads are $0.08/M against $0.80/M, so the grounding is nearly free after the first hit.

import { AnthropicClient } from './AnthropicClient';
import { getProspectCorpusMatcher } from './ProspectCorpusMatcher';
import { HelpCorpusLoader } from './HelpCorpusLoader';
import { PROSPECT_CORPUS_DIR } from './ProspectCorpusMatcher';
import { cheapModel, modelFor } from '../../../config/aiModels';
import { logger } from '../../../utils/logger';

/** Short answers convert better, and this renders in a card on a phone. */
const MAX_TOKENS = 320;

export interface AnsweredResult {
  answer: string;
  nextStep: string;
  costUsd: number;
  model: string;
}

const SYSTEM = `You are the assistant on FixFlow's marketing homepage, talking to a local service
business owner who has never used FixFlow — a barber, gym owner, phone repair shop, pet groomer.

WHAT YOU KNOW
Everything you may say about FixFlow is in the reference material below. It is the complete and only
source of truth about the product.

HARD RULES
- Never state a price, percentage or figure that is not in the reference material.
- Never claim a feature, integration or capability that is not in the reference material. If you are
  not sure FixFlow does something, say you are not sure and offer what it does do.
- Never promise anything ("we can build...", "we'll integrate with..."). You do not speak for the team.
- You have no access to their account or data. Do not imply you can see anything about their business.
- If asked about something unrelated to running a service business, say that is not what you are for.

HOW TO ANSWER
- Two or three short sentences. This renders in a small card on a phone.
- Answer the person, not the keyword. If they describe a problem ("Mondays are quiet"), respond to the
  problem and name the part of FixFlow that addresses it.
- Plain words. No jargon, no blockchain talk, no marketing voice.
- If they have told you about their business, use it. If they have not, it is fine to ask one short
  question back — that is more useful than a generic answer.
- Never invent a shop name or pretend to know their trade.

FORMAT
Return exactly two lines and nothing else:
ANSWER: <your answer>
NEXT: <one specific next step, max 15 words, that follows from what they asked>`;

/**
 * Blocks the two claims that are expensive to get wrong.
 *
 * Same shape as the invented-offer guard on AI campaigns. A hallucinated price on a public page is a
 * sales and legal problem rather than an accuracy one, and a hallucinated integration is a promise
 * somebody will hold us to.
 */
export function violatesGrounding(answer: string, corpus: string): string | null {
  const corpusLower = corpus.toLowerCase();

  // Any money figure must appear verbatim in the corpus.
  for (const m of answer.matchAll(/\$\s?\d[\d,]*(?:\.\d+)?/g)) {
    const figure = m[0].replace(/\s/g, '');
    if (!corpusLower.includes(figure.toLowerCase())) return `invented figure ${figure}`;
  }
  // Percentages are the other number people quote back at you.
  for (const m of answer.matchAll(/\b\d{1,3}\s?%/g)) {
    if (!corpusLower.includes(m[0].replace(/\s/g, '').toLowerCase())) return `invented percentage ${m[0]}`;
  }
  // Forward commitments. The assistant does not speak for the roadmap.
  if (/\b(we (can|will|could) (build|add|integrate|develop)|coming soon|in the roadmap)\b/i.test(answer)) {
    return 'forward commitment';
  }
  return null;
}

export class HomepageAiAnswerer {
  private corpusBlock: string | null = null;

  constructor(private readonly anthropic?: AnthropicClient) {}

  /** Lazy: the loader reads the filesystem, and the client throws when no API key is configured. */
  private corpus(): string {
    if (this.corpusBlock === null) {
      this.corpusBlock = new HelpCorpusLoader(PROSPECT_CORPUS_DIR).getCorpusBlock();
    }
    return this.corpusBlock;
  }

  async answer(question: string): Promise<AnsweredResult | null> {
    try {
      const client = this.anthropic ?? new AnthropicClient();
      const corpus = this.corpus();

      const res = await client.complete({
        // Two blocks: the instructions and the corpus, both cached. Identical on every call, so after
        // the first request the grounding is charged at the cache-read rate.
        systemPrompt: [
          { text: SYSTEM, cache: true },
          { text: `REFERENCE MATERIAL\n\n${corpus}`, cache: true },
        ],
        messages: [{ role: 'user', content: question }],
        model: modelFor('HOMEPAGE', cheapModel()),
        maxTokens: MAX_TOKENS,
        temperature: 0.3,
      });

      const text = res.text ?? '';
      const answer = (text.match(/ANSWER:\s*([\s\S]*?)(?=\nNEXT:|$)/i)?.[1] ?? '').trim();
      const next = (text.match(/NEXT:\s*(.*)/i)?.[1] ?? '').trim();
      const costUsd = res.costUsd ?? 0;

      if (!answer) {
        logger.warn('Homepage AI: model returned nothing usable', { question: question.slice(0, 80) });
        return null;
      }

      const violation = violatesGrounding(`${answer} ${next}`, corpus);
      if (violation) {
        // Discarded, not repaired. A half-corrected claim is still a claim, and the corpus answer
        // below is a perfectly good thing to say instead.
        logger.warn('Homepage AI: answer discarded for grounding violation', {
          violation, question: question.slice(0, 80),
        });
        return null;
      }

      return {
        answer,
        nextStep: next || 'Start a 14-day free trial and have a look around.',
        costUsd,
        model: res.model,
      };
    } catch (err) {
      // Never throws to the caller — the route falls back to the corpus match, which is what P1 built.
      logger.error('Homepage AI model call failed', { error: (err as Error)?.message });
      return null;
    }
  }

  /** The degraded answer when the model is unavailable, over budget, or ungrounded. */
  corpusFallback(question: string): { answer: string; nextStep: string } | null {
    const hit = getProspectCorpusMatcher().match(question);
    return hit ? { answer: hit.article.answer, nextStep: hit.article.nextStep } : null;
  }
}

let _instance: HomepageAiAnswerer | null = null;
export function getHomepageAiAnswerer(): HomepageAiAnswerer {
  if (!_instance) _instance = new HomepageAiAnswerer();
  return _instance;
}
