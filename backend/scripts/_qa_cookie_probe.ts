// Is the session cookie actually round-tripping? The e2e's jar takes the FIRST set-cookie header,
// which is only correct if ours is the only cookie the response sets.
const API = process.env.QA_API_BASE || 'https://api-staging.repaircoin.ai';
(async () => {
  const r = await fetch(`${API}/api/public/ai/ask`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'how much does it cost' }),
  });
  const all = (r.headers as any).getSetCookie?.() ?? [];
  console.log('set-cookie headers returned:', all.length);
  all.forEach((c: string) => console.log('  ', c.split(';')[0]));
  console.log('headers.get("set-cookie") =', (r.headers.get('set-cookie') ?? '').slice(0, 120));
  const d = (await r.json()).data;
  console.log('remaining:', d.remaining, 'answeredBy:', d.answeredBy);
})();
