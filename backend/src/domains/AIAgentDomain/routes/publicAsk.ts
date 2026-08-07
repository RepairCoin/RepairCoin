// The homepage AI assistant — PUBLIC and unauthenticated.
//
// Treat every request here as hostile. This is the only AI surface on the platform with no shop, no
// tier and no account behind it, which means none of the existing protection applies: canSpend(),
// tier gates and per-shop budgets all key on shopId, and there is no shopId here.
//
// P3: a model answers, grounded in `backend/help-prospect/`. P1 matched keywords against those
// articles instead, and the first three real questions showed why that could not work — "normally we
// only get few customer during monday" is not a question, it is someone describing their business,
// and there is nothing to match on. The corpus is now what the model may SAY, not how it is chosen.
//
// Three degradations, each still a useful reply:
//   model over budget / unusable / ungrounded → corpus match (right topic, canned wording)
//   corpus miss                               → the static fallback
//   off-topic                                 → refusal, and no model call at all
//
// The spend guard is the one thing standing between this and an unbounded bill, because there is no
// shop to attribute a cost to. See HomepageAiSpendGuard.

import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { verifyCaptcha } from '../../../middleware/captcha';
import { getProspectCorpusMatcher } from '../services/ProspectCorpusMatcher';
import { getHomepageAiAnswerer } from '../services/HomepageAiAnswerer';
import { getHomepageAiSpendGuard } from '../services/HomepageAiSpendGuard';
import { getSharedPool } from '../../../utils/database-pool';
import { logger } from '../../../utils/logger';

const router = Router();

/**
 * Free answers before an account is required. The limit IS the call to action.
 *
 * Five rather than three. At ~0.2c an answer the cost argument is nothing — five answers is a cent —
 * and the limit exists to create a signup moment, not to save money. Three arrived before a visitor
 * had seen the assistant do anything impressive, which spends the wall on the wrong moment.
 */
export const FREE_ANSWERS = 5;
/** Long enough for a real question, short enough that nobody pastes a document into it. */
export const MAX_QUESTION_CHARS = 300;
const SESSION_COOKIE = 'ff_ai_sid';
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Shown when we have no answer — over budget, rate limited, or nothing cleared the score floor.
 *
 * Deliberately the SAME text in all three cases. A visitor must not be able to tell "we chose not to
 * answer" from "it broke", and a broken box on the homepage is worse than no box at all.
 */
const FALLBACK = {
  answer:
    "I don't have a good answer for that one yet. FixFlow helps local service businesses take " +
    'bookings, keep customers coming back, and handle the follow-up automatically.',
  nextStep: 'Start a 14-day free trial and have a look around — no card needed to begin.',
};

/** Off-topic: answered without a model, and without a lecture. */
const OFF_TOPIC = {
  answer:
    "I can only help with running a local service business on FixFlow — bookings, customers, " +
    'rewards and marketing.',
  nextStep: 'Ask me what FixFlow would do for your business, and I can be more useful.',
};

/**
 * Cheap topical gate, applied BEFORE any matching.
 *
 * Its job is not to be clever, it is to make "write me a Python script" cost nothing. In P1 a
 * mismatch already costs nothing, so this earns its keep in P3 — and having it live from the start
 * means the refusal wording is tested by real traffic before it is load-bearing.
 */
const OFF_TOPIC_SIGNALS = [
  /\b(write|generate|code|script|program|debug)\b.*\b(python|javascript|java|c\+\+|sql|html)\b/i,
  /\b(essay|homework|poem|story|recipe|translate)\b/i,
  /\bignore (all |your |previous )?(instructions|rules|prompt)/i,
  /\byou are (now|actually)\b/i,
  /\bsystem prompt\b/i,
];
const isOffTopic = (q: string) => OFF_TOPIC_SIGNALS.some((re) => re.test(q));

/** Strip anything person-shaped before a question is stored. Consented addresses live in `waitlist`. */
const stripPii = (q: string) =>
  q
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[phone]')
    .slice(0, MAX_QUESTION_CHARS);

const hashIp = (ip: string) =>
  crypto.createHash('sha256').update(`${ip}:${process.env.JWT_SECRET ?? 'ff'}`).digest('hex').slice(0, 64);

/**
 * Per-IP limits, separate from the app-wide limiter.
 *
 * The session cap in `FREE_ANSWERS` is a conversion mechanic and is trivially reset by clearing a
 * cookie; that is fine and expected. THIS is the guard that a script meets.
 */
const askLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many questions — give it a moment.' },
});
const askDailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Daily limit reached.' },
});

/** Read or mint the session id. Server-side, so the count cannot be edited in devtools. */
function sessionId(req: Request, res: Response): string {
  const existing = req.cookies?.[SESSION_COOKIE];
  if (typeof existing === 'string' && /^[a-f0-9]{32}$/.test(existing)) return existing;

  const fresh = crypto.randomBytes(16).toString('hex');
  res.cookie(SESSION_COOKIE, fresh, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE_MS,
    path: '/',
  });
  return fresh;
}

/** Never let logging failures break the answer — the visitor's experience outranks our analytics. */
async function record(
  sessionIdValue: string,
  ipHash: string,
  question: string,
  answeredBy: 'corpus' | 'model' | 'fallback' | 'refused',
  matched: string | null,
  score: number | null,
  latencyMs: number,
  costUsd: number | null = null,
  answerText: string | null = null,
  nextStepText: string | null = null
): Promise<number> {
  const pool = getSharedPool();
  try {
    const convo = await pool.query(
      `INSERT INTO homepage_ai_conversations (session_id, ip_hash, message_count)
            VALUES ($1, $2, 1)
       ON CONFLICT (session_id) DO UPDATE
            SET message_count = homepage_ai_conversations.message_count + 1,
                updated_at = NOW()
        RETURNING message_count`,
      [sessionIdValue, ipHash]
    );
    await pool.query(
      `INSERT INTO homepage_ai_messages
         (session_id, question, answered_by, matched_article, match_score, latency_ms, cost_usd,
          answer, next_step)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [sessionIdValue, stripPii(question), answeredBy, matched, score, latencyMs, costUsd,
       answerText, nextStepText]
    );
    return convo.rows[0].message_count as number;
  } catch (err) {
    logger.error('homepage AI: failed to record message', { error: (err as Error)?.message });
    return 0;
  }
}

/**
 * GET /api/public/ai/session
 *
 * Rebuilds the thread and the allowance after a refresh.
 *
 * Without it the browser was the only thing that knew a conversation had happened: a refresh emptied
 * the thread and re-enabled the input, while the server still (correctly) refused to answer. The
 * visitor was invited to type something that would then be declined — the UI contradicting the server
 * rather than reflecting it.
 *
 * Read-only and cheap. No captcha and no session is minted: a visitor who has never asked anything
 * gets an empty thread and a full allowance, which is exactly what a first-time load should see.
 */
router.get('/session', async (req: Request, res: Response) => {
  try {
    const sid = req.cookies?.[SESSION_COOKIE];
    if (typeof sid !== 'string' || !/^[a-f0-9]{32}$/.test(sid)) {
      return res.json({ success: true, data: { turns: [], remaining: FREE_ANSWERS, gated: false } });
    }

    const { rows } = await getSharedPool().query(
      `SELECT question, answer, next_step, answered_by
         FROM homepage_ai_messages
        WHERE session_id = $1
        ORDER BY created_at
        LIMIT 20`,
      [sid]
    );

    const spent = rows.filter((r: any) => r.answered_by === 'model' || r.answered_by === 'corpus').length;
    const remaining = Math.max(0, FREE_ANSWERS - spent);

    return res.json({
      success: true,
      data: {
        turns: rows.map((r: any) => ({
          question: r.question,
          answer: r.answer ?? '',
          nextStep: r.next_step ?? '',
          answeredBy: r.answered_by,
        })),
        remaining,
        gated: remaining === 0,
      },
    });
  } catch (error) {
    // An empty thread is a fine degradation — the visitor loses their history, not their allowance,
    // because /ask re-checks the count server-side regardless of what this returned.
    logger.error('homepage AI: session restore failed', { error: (error as Error)?.message });
    return res.json({ success: true, data: { turns: [], remaining: FREE_ANSWERS, gated: false } });
  }
});

/**
 * POST /api/public/ai/ask   { question, captchaToken? }
 *
 * Always 200 with an answer, unless rate limited or the input is unusable. A visitor should never see
 * this box error.
 */
router.post('/ask', askDailyLimiter, askLimiter, verifyCaptcha('homepage_ai'), async (req: Request, res: Response) => {
  const started = Date.now();
  try {
    const raw = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
    if (!raw) {
      return res.status(400).json({ success: false, error: 'Ask me something about your business.' });
    }
    const question = raw.slice(0, MAX_QUESTION_CHARS);

    const sid = sessionId(req, res);
    const ipHash = hashIp(req.ip ?? 'unknown');

    // The gate is checked BEFORE answering, so answer 4 costs nothing at all.
    const used = await currentCount(sid);
    if (used >= FREE_ANSWERS) {
      return res.json({
        success: true,
        data: {
          answeredBy: 'gated',
          answer: "That's the last of the free answers — create a free account and we can keep going.",
          nextStep: 'Start a 14-day free trial. No card needed to begin.',
          remaining: 0,
          gated: true,
        },
      });
    }

    if (isOffTopic(question)) {
      await record(
        sid, ipHash, question, 'refused', null, null, Date.now() - started, null,
        OFF_TOPIC.answer, OFF_TOPIC.nextStep
      );
      // `used`, not record()'s return. record() gives the TOTAL message count, so this branch was
      // still charging for a refusal while /session correctly reported it as free — the two endpoints
      // disagreeing about the same session, with this one wrong.
      return res.json({
        success: true,
        data: {
          answeredBy: 'refused',
          ...OFF_TOPIC,
          remaining: Math.max(0, FREE_ANSWERS - used),
          gated: false,
        },
      });
    }

    // P3 — the model answers, grounded in the corpus. It runs FIRST, not as a fallback: a homepage
    // visitor describing their business ("Mondays are quiet") has no keywords to match, and that is
    // most of the real traffic. The corpus is what the model is allowed to say, not how it is chosen.
    //
    // The order of the two degradations matters. Over budget or a bad answer falls back to the corpus
    // match, which is a real answer about the right topic; only when that misses too do we say we do
    // not know. Every step down is still a useful reply.
    const answerer = getHomepageAiAnswerer();
    let answeredBy: 'model' | 'corpus' | 'fallback' = 'fallback';
    let answer = FALLBACK.answer;
    let nextStep = FALLBACK.nextStep;
    let matched: string | null = null;
    let score: number | null = null;
    let costUsd: number | null = null;

    const spend = await getHomepageAiSpendGuard().check();
    if (spend.allowed) {
      const modelled = await answerer.answer(question);
      if (modelled) {
        answeredBy = 'model';
        answer = modelled.answer;
        nextStep = modelled.nextStep;
        costUsd = modelled.costUsd;
      }
    }

    if (answeredBy !== 'model') {
      const hit = getProspectCorpusMatcher().match(question);
      if (hit) {
        answeredBy = 'corpus';
        answer = hit.article.answer;
        nextStep = hit.article.nextStep;
        matched = hit.article.filename;
        score = hit.score;
      }
    }

    await record(
      sid, ipHash, question, answeredBy, matched, score, Date.now() - started, costUsd,
      answer, nextStep
    );

    // Computed from `used` (read before answering) rather than from record()'s return, which is the
    // TOTAL message count including fallbacks. Only a real answer spends an allowance — a fallback is
    // our corpus failing them, and charging for it moves someone closer to a paywall for asking
    // something we could not handle.
    const spent = used + (answeredBy === 'model' || answeredBy === 'corpus' ? 1 : 0);
    const remaining = Math.max(0, FREE_ANSWERS - spent);

    return res.json({
      success: true,
      data: {
        answeredBy,
        answer,
        nextStep,
        remaining,
        // The signal the UI needs to show the account card as the LAST answer rather than after it.
        gated: remaining === 0,
      },
    });
  } catch (error) {
    // Even an unexpected failure answers. The homepage does not get to look broken.
    logger.error('homepage AI ask failed', { error: (error as Error)?.message });
    return res.json({
      success: true,
      data: { answeredBy: 'fallback', ...FALLBACK, remaining: FREE_ANSWERS, gated: false },
    });
  }
});

/**
 * How many answers this visitor has actually HAD.
 *
 * Counts only 'model' and 'corpus'. A fallback ("I'm not sure that's covered") or a refusal is our
 * corpus failing them, and charging it against their free allowance punishes someone for our gap —
 * they get closer to a paywall by asking something we could not handle.
 *
 * Deliberately counted from the message rows rather than conversations.message_count, which stays a
 * true total so the two numbers can be compared: the difference IS the failure rate per session.
 */
async function currentCount(sid: string): Promise<number> {
  try {
    const r = await getSharedPool().query(
      `SELECT COUNT(*)::int n FROM homepage_ai_messages
        WHERE session_id = $1 AND answered_by IN ('model', 'corpus')`,
      [sid]
    );
    return r.rows[0]?.n ?? 0;
  } catch {
    // Unknown count → let them through. Failing open costs one corpus lookup; failing closed makes the
    // homepage look broken during a database blip.
    return 0;
  }
}

export default router;
