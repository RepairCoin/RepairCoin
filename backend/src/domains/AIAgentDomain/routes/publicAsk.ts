// The homepage AI assistant — PUBLIC and unauthenticated.
//
// Treat every request here as hostile. This is the only AI surface on the platform with no shop, no
// tier and no account behind it, which means none of the existing protection applies: canSpend(),
// tier gates and per-shop budgets all key on shopId, and there is no shopId here.
//
// P1 calls NO MODEL. Answers come from `backend/help-prospect/` via ProspectCorpusMatcher, so the
// worst case on launch day is a static site rather than a bill. The guards below are in place from the
// start anyway, because the moment a model is added in P3 they are what stands between the homepage
// and an unbounded spend.

import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { verifyCaptcha } from '../../../middleware/captcha';
import { getProspectCorpusMatcher } from '../services/ProspectCorpusMatcher';
import { getSharedPool } from '../../../utils/database-pool';
import { logger } from '../../../utils/logger';

const router = Router();

/** Free answers before an account is required. The limit IS the call to action. */
export const FREE_ANSWERS = 3;
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
  latencyMs: number
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
         (session_id, question, answered_by, matched_article, match_score, latency_ms)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [sessionIdValue, stripPii(question), answeredBy, matched, score, latencyMs]
    );
    return convo.rows[0].message_count as number;
  } catch (err) {
    logger.error('homepage AI: failed to record message', { error: (err as Error)?.message });
    return 0;
  }
}

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
      const count = await record(sid, ipHash, question, 'refused', null, null, Date.now() - started);
      return res.json({
        success: true,
        data: { answeredBy: 'refused', ...OFF_TOPIC, remaining: Math.max(0, FREE_ANSWERS - count), gated: false },
      });
    }

    const hit = getProspectCorpusMatcher().match(question);
    const answeredBy = hit ? 'corpus' : 'fallback';
    const count = await record(
      sid, ipHash, question, answeredBy,
      hit?.article.filename ?? null, hit?.score ?? null, Date.now() - started
    );
    const remaining = Math.max(0, FREE_ANSWERS - count);

    return res.json({
      success: true,
      data: {
        answeredBy,
        answer: hit ? hit.article.answer : FALLBACK.answer,
        nextStep: hit ? hit.article.nextStep : FALLBACK.nextStep,
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

async function currentCount(sid: string): Promise<number> {
  try {
    const r = await getSharedPool().query(
      `SELECT message_count FROM homepage_ai_conversations WHERE session_id = $1`,
      [sid]
    );
    return r.rows[0]?.message_count ?? 0;
  } catch {
    // Unknown count → let them through. Failing open costs one corpus lookup; failing closed makes the
    // homepage look broken during a database blip.
    return 0;
  }
}

export default router;
