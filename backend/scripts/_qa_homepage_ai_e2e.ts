// Verifies the PUBLIC homepage AI endpoint against the DEPLOYED API.
//
// No auth by design — that is the whole point of the surface and the whole risk. So this checks the
// guards as hard as it checks the answers: the free-answer gate must hold server-side (it is the only
// thing standing between a visitor and unlimited use once a model is added), and the corpus must
// answer real questions while refusing junk.
//
// Uses a fresh cookie jar per run so the session count starts clean. That is also the honest caveat:
// clearing cookies buys another three answers, which is accepted in the plan — the per-IP limiter is
// the guard that a script actually meets.

import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API = process.env.QA_API_BASE || 'https://api-staging.repaircoin.ai';

const ok = (c: boolean, s: string) => console.log(`  ${c ? 'PASS' : 'FAIL'}  ${s}`);
const line = (s: string) => console.log(s);

/**
 * Cookie jar for the session cookie, and ONLY that one.
 *
 * The first version used `headers.get('set-cookie')`, which returns a single header. Staging sits
 * behind Cloudflare, which sets `__cf_bm` on the same response — so as soon as that one came back
 * first, the jar overwrote the session cookie with it and the session was silently lost. The symptom
 * was the free-answer gate appearing not to hold, i.e. a QA script reporting a product bug that did
 * not exist. `getSetCookie()` returns all of them; pick ours by name.
 */
const SESSION_COOKIE = 'ff_ai_sid';
function jar() {
  let cookie = '';
  return {
    get: () => cookie,
    absorb: (res: Response) => {
      const all: string[] = (res.headers as any).getSetCookie?.() ?? [];
      const mine = all.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
      // Only overwrite when ours was actually re-sent — the server sets it once, on the first request.
      if (mine) cookie = mine.split(';')[0];
    },
  };
}

async function ask(j: ReturnType<typeof jar>, question: string) {
  const res = await fetch(`${API}/api/public/ai/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(j.get() ? { Cookie: j.get() } : {}) },
    body: JSON.stringify({ question }),
  });
  j.absorb(res);
  const body = (await res.json().catch(() => null)) as any;
  return { status: res.status, data: body?.data, error: body?.error };
}

async function main() {
  const db = new Client({
    host: process.env.DB_HOST, port: +(process.env.DB_PORT || 25060),
    database: process.env.DB_NAME, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false },
  });
  await db.connect();

  const sessionsBefore = (await db.query(`SELECT COUNT(*)::int n FROM homepage_ai_conversations`)).rows[0].n;

  try {
    line('\n=== 1. a real question is answered from the corpus ===');
    const j = jar();
    const a = await ask(j, 'how much does it cost');
    ok(a.status === 200, `200 (${a.status}) ${a.error ?? ''}`);
    ok(a.data?.answeredBy === 'corpus', `answered from the corpus (${a.data?.answeredBy})`);
    ok(/\$80|\$299|\$599/.test(a.data?.answer ?? ''), 'the answer carries the real prices');
    ok(!!a.data?.nextStep, 'carries the article\'s own next step');
    ok(!/People ask this as/i.test(a.data?.answer ?? ''), 'no phrasing list leaked into the answer');
    line(`  remaining: ${a.data?.remaining}`);

    line('\n=== 2. a different question reaches a different article ===');
    const b = await ask(j, 'does this work for a barbershop');
    ok(b.data?.answeredBy === 'corpus', `answered from the corpus (${b.data?.answeredBy})`);
    ok(
      /barber|gym|salon|nail/i.test(b.data?.answer ?? ''),
      'answered with the "is it right for my business" article'
    );

    line('\n=== 3. junk does not get a confident answer ===');
    const c = await ask(j, 'write me a python script');
    ok(
      c.data?.answeredBy === 'refused' || c.data?.answeredBy === 'fallback',
      `refused or fell back, never "corpus" (${c.data?.answeredBy})`
    );
    ok(!!c.data?.nextStep, 'still offers a next step rather than a dead end');

    line('\n=== 4. the free-answer gate holds SERVER-SIDE ===');
    // Three answers used above. The fourth must be gated by the server, not by the browser.
    const d = await ask(j, 'can customers book online');
    ok(d.data?.gated === true || d.data?.answeredBy === 'gated', `4th question gated (${d.data?.answeredBy})`);
    ok(d.data?.remaining === 0, `remaining is 0 (got ${d.data?.remaining})`);

    line('\n=== 5. a NEW session gets its own three ===');
    // Without this, step 4 proves nothing — a broken endpoint that gates everyone would also pass.
    const j2 = jar();
    const e = await ask(j2, 'what is fixflow');
    ok(e.data?.answeredBy === 'corpus', `fresh session answered (${e.data?.answeredBy})`);
    ok(e.data?.gated === false, 'fresh session is not gated');

    line('\n=== 6. empty input is refused without burning an answer ===');
    const f = await ask(j2, '   ');
    ok(f.status === 400, `400 on empty input (${f.status})`);

    line('\n=== 7. it was all recorded — the point of P1 ===');
    await new Promise((r) => setTimeout(r, 1000));
    const msgs = await db.query(
      `SELECT answered_by, COUNT(*)::int n FROM homepage_ai_messages
        WHERE created_at > NOW() - INTERVAL '5 minutes' GROUP BY 1 ORDER BY 1`
    );
    line(`  by answered_by: ${JSON.stringify(msgs.rows)}`);
    ok(msgs.rows.some((r: any) => r.answered_by === 'corpus'), 'corpus answers logged');
    const sessionsAfter = (await db.query(`SELECT COUNT(*)::int n FROM homepage_ai_conversations`)).rows[0].n;
    ok(sessionsAfter >= sessionsBefore + 2, `two sessions recorded (${sessionsBefore} → ${sessionsAfter})`);

    const pii = await db.query(
      `SELECT COUNT(*)::int n FROM homepage_ai_messages
        WHERE created_at > NOW() - INTERVAL '5 minutes' AND question ~ '[[:alnum:]._%+-]+@[[:alnum:].-]+'`
    );
    ok(pii.rows[0].n === 0, 'no email-shaped text stored in the logged questions');

    line('\n=== 8. no model was called — cost is null on every row ===');
    const cost = await db.query(
      `SELECT COUNT(*)::int n FROM homepage_ai_messages
        WHERE created_at > NOW() - INTERVAL '5 minutes' AND cost_usd IS NOT NULL`
    );
    ok(cost.rows[0].n === 0, 'P1 spent nothing, by construction');
  } finally {
    line('\ncleanup');
    const del = await db.query(
      `DELETE FROM homepage_ai_messages WHERE created_at > NOW() - INTERVAL '10 minutes' RETURNING id`
    );
    const delC = await db.query(
      `DELETE FROM homepage_ai_conversations WHERE created_at > NOW() - INTERVAL '10 minutes' RETURNING id`
    );
    line(`  removed ${del.rowCount} QA messages, ${delC.rowCount} QA sessions`);
    await db.end();
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
