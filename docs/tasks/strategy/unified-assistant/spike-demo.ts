// docs/tasks/strategy/unified-assistant/spike-demo.ts
//
// Drives the flagship unified-assistant spike (POST /api/ai/orchestrate)
// through the exec's headline 2-turn conversation, end to end against a
// running backend, and prints the transcript + which tools each turn used.
//
// It proves the thesis: ONE conversation that answers a business question
// (insights tools) and then takes a marketing action (drafts a win-back),
// without the owner ever picking a panel.
//
//   cd backend
//   VOICE_QA_SHOP_ID=peanut npm run ai:spike-demo
//   # or: npx ts-node ../docs/tasks/strategy/unified-assistant/spike-demo.ts
//
// Needs: backend running (local :3002), Anthropic credits, JWT_SECRET in
// backend/.env. CWD must be backend/ so node_modules + .env resolve.
// Mints a short-lived shop JWT (address is cosmetic; auth validates by shopId,
// so the shop must exist — peanut does). Override target with VOICE_QA_API_BASE.

import * as path from "path";
import { randomUUID } from "crypto";
import { createRequire } from "module";
import * as dotenv from "dotenv";

dotenv.config();
const backendRequire = createRequire(
  path.resolve(__dirname, "../../../../backend/package.json")
);
const jwt = backendRequire("jsonwebtoken");

const API_BASE =
  process.env.VOICE_QA_API_BASE ?? `http://localhost:${process.env.PORT || 4000}`;
const SHOP_ID = process.env.VOICE_QA_SHOP_ID ?? "peanut";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

function mintToken(): string {
  if (process.env.VOICE_QA_JWT) return process.env.VOICE_QA_JWT;
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not set (run from backend/ so .env loads)");
  return jwt.sign(
    {
      address: "0x0000000000000000000000000000000000000000",
      role: "shop",
      shopId: SHOP_ID,
      type: "access",
    },
    secret,
    { expiresIn: "1h", issuer: "repaircoin-api", audience: "repaircoin-users" }
  );
}

async function turn(
  token: string,
  sessionId: string,
  messages: Msg[]
): Promise<{ reply: string; toolCalls: any[]; latencyMs: number; model: string }> {
  const res = await fetch(`${API_BASE}/api/ai/orchestrate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sessionId, messages }),
  });
  const body = await res.json();
  if (!res.ok || !body?.success) {
    throw new Error(`orchestrate ${res.status}: ${body?.error ?? "unknown error"}`);
  }
  return body.data;
}

function printTurn(userText: string, data: { reply: string; toolCalls: any[]; latencyMs: number }) {
  console.log(`\n👤  ${userText}`);
  const tools = data.toolCalls.map((t) => t.tool);
  if (tools.length) console.log(`    🔧 tools: ${tools.join(" → ")}`);
  console.log(`🤖  ${data.reply}`);
  console.log(`    (${Math.round(data.latencyMs)}ms)`);
}

async function main(): Promise<void> {
  const token = mintToken();
  const sessionId = randomUUID();

  console.log("\n=== Unified Assistant — flagship spike demo ===");
  console.log(`API: ${API_BASE}  ·  shop: ${SHOP_ID}`);

  const conv: Msg[] = [];

  // Turn 1 — Information (insights tools)
  const q1 = "How did we do this month?";
  conv.push({ role: "user", content: q1 });
  const t1 = await turn(token, sessionId, conv);
  printTurn(q1, t1);
  conv.push({ role: "assistant", content: t1.reply });

  // Turn 2 — Recommendation → Action (marketing), same thread
  const q2 = "Not loving that. Win back the customers who've gone quiet.";
  conv.push({ role: "user", content: q2 });
  const t2 = await turn(token, sessionId, conv);
  printTurn(q2, t2);
  conv.push({ role: "assistant", content: t2.reply });

  // Turn 3 — commit to the action (the AI typically offers to target all
  // customers when the lapsed window is empty; we accept, which forces the
  // draft). Keeps the demo honest on thin test data while still landing the
  // full Information → Recommendation → Action arc.
  const q3 = "Good point — go ahead and draft a 'we miss you' offer for all my customers.";
  conv.push({ role: "user", content: q3 });
  const t3 = await turn(token, sessionId, conv);
  printTurn(q3, t3);

  const allTools = [...t1.toolCalls, ...t2.toolCalls, ...t3.toolCalls].map((t) => t.tool);
  const usedInsights = allTools.some((t) =>
    ["revenue_summary", "top_customers", "repeat_customer_analysis"].includes(t)
  );
  const usedMarketing = allTools.some((t) =>
    ["lookup_audience_count", "propose_campaign_draft"].includes(t)
  );
  const drafted = allTools.includes("propose_campaign_draft");

  console.log("\n=== Result ===");
  console.log(`Turn 1 tools: ${t1.toolCalls.map((t) => t.tool).join(", ") || "(none)"}`);
  console.log(`Turn 2 tools: ${t2.toolCalls.map((t) => t.tool).join(", ") || "(none)"}`);
  console.log(`Turn 3 tools: ${t3.toolCalls.map((t) => t.tool).join(", ") || "(none)"}`);
  console.log(
    `Cross-domain in one conversation: insights=${usedInsights ? "yes" : "no"}, marketing=${usedMarketing ? "yes" : "no"}, drafted=${drafted ? "yes" : "no"}`
  );
  // Thesis = one conversation reached BOTH domains. Drafting depends on data
  // (an empty audience correctly yields no draft), so it's reported but the
  // cross-domain reach is the real pass condition.
  const thesisProven = usedInsights && usedMarketing;
  console.log(
    thesisProven
      ? "✅ ONE conversation spanned insights + marketing with no panel switch. Unified thesis proven."
      : "⚠ Did not reach both domains — inspect tools above."
  );
  console.log("");
  process.exit(thesisProven ? 0 : 1);
}

main().catch((err) => {
  console.error("spike-demo fatal:", err);
  process.exit(1);
});
