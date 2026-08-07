// Does the DEPLOYED homepage box now reason, or is it still reciting articles?
// The tell is `answeredBy`: 'model' means P3 is live; 'corpus'/'fallback' means the key is missing
// or the model is failing, which looks identical to P1 from the outside.
const API = process.env.QA_API_BASE || 'https://api-staging.repaircoin.ai';
const QS = [
  'normally we only get few customer during monday',
  'does fixflow have sub account for my team?',
  'i run a small barbershop, would this help me?',
];
(async () => {
  for (const q of QS) {
    const r = await fetch(`${API}/api/public/ai/ask`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q }),
    });
    const d = (await r.json().catch(() => null))?.data;
    console.log(`\nQ: ${q}`);
    console.log(`   [${d?.answeredBy}]  ${d?.answer}`);
    console.log(`   NEXT: ${d?.nextStep}`);
  }
})();
