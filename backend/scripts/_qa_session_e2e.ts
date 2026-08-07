// Verifies the three gate changes against the DEPLOYED API: fallbacks are free, the limit is 5, and a
// refresh restores the thread rather than resetting the box.
const API = process.env.QA_API_BASE || 'https://api-staging.repaircoin.ai';
const ok = (c: boolean, s: string) => console.log(`  ${c ? 'PASS' : 'FAIL'}  ${s}`);
const SESSION_COOKIE = 'ff_ai_sid';

function jar() {
  let cookie = '';
  return {
    get: () => cookie,
    absorb: (r: Response) => {
      const all: string[] = (r.headers as any).getSetCookie?.() ?? [];
      const mine = all.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
      if (mine) cookie = mine.split(';')[0];
    },
  };
}
const ask = async (j: any, q: string) => {
  const r = await fetch(`${API}/api/public/ai/ask`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(j.get() ? { Cookie: j.get() } : {}) },
    body: JSON.stringify({ question: q }),
  });
  j.absorb(r);
  return (await r.json().catch(() => null))?.data;
};
const session = async (j: any) => {
  const r = await fetch(`${API}/api/public/ai/session`, { headers: j.get() ? { Cookie: j.get() } : {} });
  j.absorb(r);
  return (await r.json().catch(() => null))?.data;
};

(async () => {
  console.log('\n=== 1. a fresh visitor has the full allowance and an empty thread ===');
  const j = jar();
  const s0 = await session(j);
  ok(s0?.remaining === 5, `remaining is 5, not 3 (got ${s0?.remaining})`);
  ok(Array.isArray(s0?.turns) && s0.turns.length === 0, 'thread starts empty');

  console.log('\n=== 2. a real answer spends one ===');
  const a = await ask(j, 'how much does it cost');
  ok(a?.answeredBy === 'model' || a?.answeredBy === 'corpus', `answered (${a?.answeredBy})`);
  ok(a?.remaining === 4, `remaining 4 (got ${a?.remaining})`);

  console.log('\n=== 3. an off-topic refusal is FREE ===');
  const b = await ask(j, 'write me a python script');
  ok(b?.answeredBy === 'refused', `refused (${b?.answeredBy})`);
  ok(b?.remaining === 4, `still 4 — our miss is not their cost (got ${b?.remaining})`);

  console.log('\n=== 4. refresh restores the thread and the allowance ===');
  const s1 = await session(j);
  ok(s1?.remaining === 4, `remaining survives a reload (got ${s1?.remaining})`);
  ok(s1?.turns?.length === 2, `both turns restored (got ${s1?.turns?.length})`);
  ok(!!s1?.turns?.[0]?.answer, 'the ANSWER text came back, not just the question');
  ok(s1?.gated === false, 'not gated at 4 remaining');

  console.log('\n=== 5. the gate still holds, now at 5 ===');
  for (const q of ['can customers book online', 'do you have a loyalty program', 'how do i sign up', 'what is fixflow']) {
    await ask(j, q);
  }
  const last = await ask(j, 'does it work for a gym');
  ok(last?.gated === true || last?.answeredBy === 'gated', `gated after 5 answers (${last?.answeredBy})`);
  const s2 = await session(j);
  ok(s2?.gated === true, 'a refresh at the limit comes back gated, not re-enabled');
})();
