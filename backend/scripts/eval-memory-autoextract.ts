// AX-5 eval harness for AI Memory auto-extract (Phase 3). Measures extraction precision on REAL
// orchestrate conversations — the gate that decides whether AI_MEMORY_AUTOEXTRACT is safe to turn on.
//
//   npx ts-node scripts/eval-memory-autoextract.ts [--limit 40]     # generate a labeling worksheet
//   npx ts-node scripts/eval-memory-autoextract.ts --score <file>   # score a labeled worksheet
//
// GENERATE: pulls recent orchestrate turns, keeps the directive-signal owner messages (the only ones
// that would trigger extraction), runs the REAL extractor (Haiku, no-op spend metering, no DB write),
// and writes each candidate to autoextract-eval-worksheet.md with a blank "LABEL:" line.
//   → The worksheet contains real conversation snippets. Do NOT commit it.
//
// SCORE: reads the labeled worksheet. Label each candidate:
//   c = correct standing intent | f = DB FACT (leak!) | o = one-off request | w = wrong/other
// GATE to turn the flag on: precision (c / total) >= 0.85 AND zero 'f' (a single DB-fact leak fails —
// storing facts as memory is exactly what D0 forbids).

import * as path from 'path'; import * as fs from 'fs'; import * as dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '.env') });
import { Pool } from 'pg';
import { AiMemoryExtractor, hasDirectiveSignal } from '../src/domains/AIAgentDomain/services/AiMemoryExtractor';
import { AnthropicClient } from '../src/domains/AIAgentDomain/services/AnthropicClient';

const WORKSHEET = path.join(__dirname, '..', 'autoextract-eval-worksheet.md');
const newPool = () => new Pool({ host: process.env.DB_HOST, port: +(process.env.DB_PORT || '5432'), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false } });

function lastUserMessage(payload: any): string {
  const msgs = payload?.messages;
  if (!Array.isArray(msgs)) return '';
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m?.role === 'user' && typeof m.content === 'string') return m.content;
  }
  return '';
}

async function generate(limit: number): Promise<void> {
  const pool = newPool();
  // Real Anthropic (we want true extractor behaviour) + a no-op spend cap so the eval doesn't
  // pollute cost data or write ai_misc_usage rows. extract() does NOT write memories — it just
  // returns candidates — so nothing is persisted.
  const extractor = new AiMemoryExtractor(new AnthropicClient(), { recordSpend: async () => {} } as any);

  // response_payload->>'text' is the assistant's reply. Production passes it to the extractor
  // (UnifiedAssistantController), so the eval must too — without it the extractor cannot tell a fix to
  // the artifact it just produced from a standing rule, and the eval measures a harsher extractor than
  // the one that actually runs.
  const rows = (await pool.query(
    `SELECT shop_id, request_payload, response_payload->>'text' AS reply FROM ai_orchestrate_messages
      WHERE request_payload IS NOT NULL ORDER BY created_at DESC LIMIT 800`
  )).rows;

  const seen = new Set<string>();
  const turns: { shopId: string; owner: string; reply: string }[] = [];
  for (const r of rows) {
    const owner = lastUserMessage(r.request_payload).trim();
    if (!owner || seen.has(owner) || !hasDirectiveSignal(owner)) continue;
    seen.add(owner);
    turns.push({ shopId: r.shop_id, owner, reply: (r.reply || '').trim() });
    if (turns.length >= limit) break;
  }
  console.log(`scanned ${rows.length} orchestrate turns → ${turns.length} directive-signal turns to evaluate`);

  const blocks: string[] = [];
  let n = 0;
  for (const t of turns) {
    const cands = await extractor.extract(t.shopId, { ownerMessage: t.owner, assistantReply: t.reply || undefined });
    for (const c of cands) {
      n++;
      blocks.push(
        `### ${n}. [${c.kind}] confidence ${c.confidence}\n` +
        `- Owner said: ${JSON.stringify(t.owner)}\n` +
        (t.reply ? `- Assistant had replied: ${JSON.stringify(t.reply.slice(0, 300))}\n` : '') +
        `- Extracted: ${JSON.stringify(c.content)}\n` +
        `- LABEL: \n`
      );
    }
  }

  const header =
    `# AI Memory auto-extract — eval worksheet\n\n` +
    `Label each candidate's LABEL line with one letter:\n` +
    `  c = correct standing intent · f = DB FACT (leak!) · o = one-off request · w = wrong/other\n\n` +
    `GATE (to turn AI_MEMORY_AUTOEXTRACT on): precision (c / total) >= 0.85 AND zero 'f'.\n` +
    `Then score:  npx ts-node scripts/eval-memory-autoextract.ts --score autoextract-eval-worksheet.md\n\n` +
    `Directive turns evaluated: ${turns.length} · candidates extracted: ${n}\n` +
    `⚠ Contains real conversation snippets — do NOT commit this file.\n\n---\n\n`;

  fs.writeFileSync(WORKSHEET, header + blocks.join('\n'));
  console.log(`candidates extracted: ${n}`);
  console.log(`worksheet written: ${WORKSHEET}`);
  await pool.end();
}

// A precision ratio over a handful of candidates is noise, not evidence — the 2026-07-28 run scored
// 100% on FOUR candidates, two of which were our own QA strings. Sample size is part of the gate.
const MIN_SAMPLE = 30;

function score(file: string): void {
  const txt = fs.readFileSync(file, 'utf8');
  const labels = [...txt.matchAll(/LABEL:\s*([cfow])\b/gi)].map((m) => m[1].toLowerCase());
  const total = labels.length;
  const count = (l: string) => labels.filter((x) => x === l).length;
  const c = count('c'), f = count('f'), o = count('o'), w = count('w');
  const precision = total ? c / total : 0;
  console.log(`labeled: ${total}   correct(c): ${c}   FACT-LEAK(f): ${f}   one-off(o): ${o}   wrong(w): ${w}`);
  console.log(`precision (c/total): ${(precision * 100).toFixed(1)}%`);

  const qualityOk = total > 0 && precision >= 0.85 && f === 0;
  const sampleOk = total >= MIN_SAMPLE;

  if (qualityOk && sampleOk) {
    console.log(`GATE: PASS ✅ — precision ≥ 85%, zero fact-leak, n=${total} ≥ ${MIN_SAMPLE}. Safe to turn AI_MEMORY_AUTOEXTRACT on.`);
  } else if (qualityOk) {
    console.log(
      `GATE: INCONCLUSIVE ⚠ — quality bar met (precision ${(precision * 100).toFixed(1)}%, zero fact-leak) but the sample is too small: ` +
      `n=${total}, need ≥ ${MIN_SAMPLE}. Keep the flag OFF and re-run when the corpus has grown. ` +
      `See docs/tasks/strategy/ai-memory/ai-memory-autoextract-eval.md.`
    );
  } else {
    console.log(
      `GATE: FAIL ❌ — ${f > 0 ? `${f} DB-fact leak(s); ` : ''}precision ${(precision * 100).toFixed(1)}%. ` +
      `Tune the prompt / threshold / pre-filter and re-run; keep the flag OFF.`
    );
  }
}

// Importing the extractor pulls in the shared database pool + every repository health check, which
// keeps the event loop alive forever — exit explicitly rather than hanging after the work is done.
(async () => {
  const args = process.argv.slice(2);
  const si = args.indexOf('--score');
  if (si >= 0) {
    const file = args[si + 1];
    if (!file) { console.error('usage: --score <worksheet.md>'); process.exit(1); }
    score(file);
    return;
  }
  const li = args.indexOf('--limit');
  const limit = li >= 0 ? Math.max(1, parseInt(args[li + 1] || '40', 10)) : 40;
  await generate(limit);
})()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e.message); process.exit(1); });
