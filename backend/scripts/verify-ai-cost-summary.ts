// Verifies the admin AI cost summary (GET /api/ai/admin/cost-summary) is internally consistent.
//
//   npx ts-node scripts/verify-ai-cost-summary.ts        # exit 0 = pass, 1 = fail
//
// READ-ONLY: issues SELECTs only, never writes. Safe against any environment.
//
// Drives the real controller against the real database — no HTTP, no mocks — so it catches the
// class of bug unit tests cannot: a panel that silently stops matching the data underneath it.
//
// WHEN TO RUN. Whenever ai_usage_events gains a leg, or getAdminCostSummary changes. The failure
// this guards against is specific and easy to introduce: a new AI surface is added to the view but
// missed by one of the breakdowns, so the dashboard keeps showing a plausible — but wrong — total.
// That is exactly how the original bug went unnoticed, with the summary reading a single cost table
// out of ten and reporting ~30% of real spend as though it were the whole picture.
//
// Every breakdown must reconcile to the headline total, and every feature present in the view must
// appear in the by-feature panel.

import * as path from 'path'; import * as dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '.env') });
import { Pool } from 'pg';
const pool = new Pool({ host: process.env.DB_HOST, port: +(process.env.DB_PORT||'5432'), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false } });

const WINDOW_DAYS = 30;

(async () => {
  const { makeSpendControllers } = await import('../src/domains/AIAgentDomain/controllers/SpendController');
  const controllers = makeSpendControllers({ pool: pool as any });

  const run = (days?: number) => new Promise<any>((resolve, reject) => {
    const req: any = { query: days ? { days: String(days) } : {}, user: { role: 'admin' } };
    const res: any = {
      json: (b: any) => resolve(b),
      status: (c: number) => ({ json: (b: any) => reject(new Error(`HTTP ${c}: ${JSON.stringify(b)}`)) }),
    };
    controllers.getAdminCostSummary(req, res).catch(reject);
  });

  const body = await run(WINDOW_DAYS);
  if (!body.success) throw new Error('controller returned success:false');
  const { cogs, reconciliation, periodDays } = body.data;

  console.log(`=== COGS (last ${periodDays} days) ===`);
  console.log(`total $${cogs.totalCostUsd.toFixed(4)}  |  billable-to-shops $${cogs.billableCostUsd.toFixed(4)}  |  ads $${cogs.adsCostUsd.toFixed(4)}`);
  console.log(`calls ${cogs.totalCalls} (${cogs.failedCalls} failed, err ${(cogs.errorRate*100).toFixed(1)}%)  avg $${cogs.avgCostPerCallUsd.toFixed(5)}/call`);
  console.log(`tokens in ${cogs.totalInputTokens.toLocaleString()} / out ${cogs.totalOutputTokens.toLocaleString()}`);

  console.log('\n-- by feature --');
  for (const f of cogs.byFeature) console.log(`  ${f.feature.padEnd(15)} ${f.vendor.padEnd(10)} $${f.costUsd.toFixed(4).padStart(9)} (${f.calls}) billable=${f.billableToShop}`);
  console.log('\n-- by model --');
  for (const m of cogs.byModel) console.log(`  ${String(m.model ?? '(none)').padEnd(32)} $${m.costUsd.toFixed(4).padStart(9)} (${m.calls} calls)`);
  console.log('\n-- by shop --');
  for (const s of cogs.byShop) console.log(`  ${(s.shopName || s.shopId).padEnd(24)} $${s.costUsd.toFixed(4).padStart(9)} (${s.calls} calls)`);
  console.log(`\n-- trend: ${cogs.trend.length} day buckets, last: ${cogs.trend.slice(-3).map((d:any)=>`${d.day} $${d.costUsd.toFixed(4)}`).join('  ')}`);

  console.log('\n=== RECONCILIATION (scope: ' + reconciliation.scope + ') ===');
  console.log(`derived $${reconciliation.derivedTotalUsd.toFixed(4)}  counter $${reconciliation.counterTotalUsd.toFixed(4)}  drift $${reconciliation.driftUsd.toFixed(4)}`);
  for (const s of reconciliation.shops) console.log(`  ${(s.shopName || s.shopId).padEnd(24)} derived $${s.derivedUsd.toFixed(4).padStart(8)} counter $${s.counterUsd.toFixed(4).padStart(8)} drift $${s.driftUsd.toFixed(4).padStart(8)}`);

  // --- Assertions: the numbers must be internally consistent, not merely present. ---
  const fails: string[] = [];
  const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

  // 1. Every breakdown must reconcile to the headline. A leg added to the view but missed by a
  //    GROUP BY shows up here as a shortfall.
  const featSum = cogs.byFeature.reduce((n: number, f: any) => n + f.costUsd, 0);
  if (!near(featSum, cogs.totalCostUsd)) fails.push(`byFeature sums to ${featSum} != total ${cogs.totalCostUsd}`);

  const modelSum = cogs.byModel.reduce((n: number, m: any) => n + m.costUsd, 0);
  if (!near(modelSum, cogs.totalCostUsd)) fails.push(`byModel sums to ${modelSum} != total ${cogs.totalCostUsd}`);

  const trendSum = cogs.trend.reduce((n: number, d: any) => n + d.costUsd, 0);
  if (!near(trendSum, cogs.totalCostUsd, 1e-5)) fails.push(`trend sums to ${trendSum} != total ${cogs.totalCostUsd}`);

  // 2. The ads carve-out partitions the total exactly — no row is both or neither.
  if (!near(cogs.billableCostUsd + cogs.adsCostUsd, cogs.totalCostUsd)) {
    fails.push(`billable ${cogs.billableCostUsd} + ads ${cogs.adsCostUsd} != total ${cogs.totalCostUsd}`);
  }

  // 3. COVERAGE: every feature the view emits in this window must appear in the by-feature panel.
  //    Sums can coincidentally still tie if a zero-cost leg is dropped, so check membership too —
  //    a new surface silently missing from the dashboard is the bug this script exists for.
  const viewFeatures = (await pool.query(
    `SELECT DISTINCT feature FROM ai_usage_events WHERE created_at >= NOW() - INTERVAL '1 day' * $1`,
    [WINDOW_DAYS]
  )).rows.map((r: any) => r.feature).sort();
  const panelFeatures = [...new Set(cogs.byFeature.map((f: any) => f.feature))].sort();
  const missing = viewFeatures.filter((f: string) => !panelFeatures.includes(f));
  console.log(`\nfeature coverage: view has ${viewFeatures.length} (${viewFeatures.join(', ')}), panel shows ${panelFeatures.length}`);
  if (missing.length) fails.push(`features present in ai_usage_events but MISSING from byFeature: ${missing.join(', ')}`);

  // 4. Reconciliation must use the SAME definition of spend the cap enforces on (billable,
  //    non-error, current calendar month). A drift panel built on a different filter reports
  //    differences that are not drift.
  const capDefinition = (await pool.query(
    `SELECT COALESCE(SUM(cost_usd), 0)::float c
       FROM ai_usage_events
      WHERE billable_to_shop AND NOT is_error
        AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())`
  )).rows[0].c;
  if (!near(reconciliation.derivedTotalUsd, capDefinition, 1e-4)) {
    fails.push(`reconciliation derived total ${reconciliation.derivedTotalUsd} != cap's own definition ${capDefinition} — the drift panel and the spend cap disagree about what "spend" means`);
  }
  console.log(`reconciliation matches the cap's filter: $${capDefinition.toFixed(4)}`);

  // 5. The view must be a superset of any single leg. ai_agent_messages is the leg the summary once
  //    read exclusively, so it doubles as a regression guard on the original bug.
  const agentOnly = (await pool.query(
    `SELECT COALESCE(SUM(cost_usd),0)::float c FROM ai_agent_messages WHERE created_at >= NOW() - INTERVAL '1 day' * $1`,
    [WINDOW_DAYS]
  )).rows[0].c;
  const hiddenPct = cogs.totalCostUsd > 0 ? (1 - agentOnly / cogs.totalCostUsd) * 100 : 0;
  console.log(`ai_agent_messages alone: $${agentOnly.toFixed(4)} of $${cogs.totalCostUsd.toFixed(4)} (${hiddenPct.toFixed(1)}% comes from other surfaces)`);
  if (cogs.totalCostUsd < agentOnly - 1e-6) fails.push('total is LOWER than ai_agent_messages alone — the view is dropping that leg');

  // 6. The days window must actually widen/narrow.
  const wide = await run(365);
  if (wide.data.cogs.totalCostUsd < cogs.totalCostUsd - 1e-9) fails.push('365d total < 30d total — the days filter is inverted');
  console.log(`365d $${wide.data.cogs.totalCostUsd.toFixed(4)} >= ${WINDOW_DAYS}d $${cogs.totalCostUsd.toFixed(4)}  OK`);

  console.log(fails.length ? `\nFAILED:\n - ${fails.join('\n - ')}` : '\nALL CONSISTENCY CHECKS PASSED');
  await pool.end();
  process.exit(fails.length ? 1 : 0);
})().catch(e=>{console.error(e.message);process.exit(1)});
