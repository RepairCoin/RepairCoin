import { ProspectCorpusMatcher } from '../src/domains/AIAgentDomain/services/ProspectCorpusMatcher';
const m = new ProspectCorpusMatcher();
const qs = process.argv.slice(2);
qs.forEach(q => {
  const r = m.match(q);
  console.log(`${String(r?.score ?? 0).padStart(3)}  ${r?.article.filename ?? '(NO MATCH → fallback)'}   ← "${q}"`);
});
