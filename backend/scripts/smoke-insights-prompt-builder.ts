// Smoke test for Phase 3.1 — InsightsPromptBuilder.
//
// Verifies:
//   - INSIGHTS_DECLINE_COPY is a non-empty string and is embedded in the prompt
//   - buildInsightsSystemPrompt() is pure (two calls produce identical output)
//   - All 5 v1 tool areas are mentioned in the prompt
//   - Each hard-rule contract from impl-doc Phase 3.1 + Phase 2 carryovers
//     ("always call a tool", "never make up a number", conversion >100%
//     caveat, belowThreshold/sampleN flag, shop-scoping, not a how-to
//     assistant, authenticated guard) is present
//
// Run: npx ts-node scripts/smoke-insights-prompt-builder.ts

import {
  buildInsightsSystemPrompt,
  INSIGHTS_DECLINE_COPY,
} from "../src/domains/AIAgentDomain/services/InsightsPromptBuilder";

let pass = 0, fail = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${label.padEnd(72)} ${detail}`);
  ok ? pass++ : fail++;
};

function containsAll(prompt: string, snippets: string[]): { missing: string[] } {
  const missing = snippets.filter((s) => !prompt.includes(s));
  return { missing };
}

function main() {
  console.log("=== Decline copy ===");
  check(
    "INSIGHTS_DECLINE_COPY is a non-empty string",
    typeof INSIGHTS_DECLINE_COPY === "string" && INSIGHTS_DECLINE_COPY.length > 0,
    `len=${INSIGHTS_DECLINE_COPY?.length ?? 0}`
  );
  check(
    "decline copy mentions Help assistant",
    /Help/i.test(INSIGHTS_DECLINE_COPY)
  );

  console.log("\n=== Purity ===");
  const a = buildInsightsSystemPrompt();
  const b = buildInsightsSystemPrompt();
  check("two calls produce identical output", a === b);
  check("output is non-empty", a.length > 200, `len=${a.length}`);

  console.log("\n=== Decline copy embedded in prompt ===");
  check(
    "prompt embeds the exact decline copy",
    a.includes(INSIGHTS_DECLINE_COPY)
  );

  console.log("\n=== Tool areas referenced ===");
  const toolAreas = [
    "Revenue",
    "Top customers",
    "Top services",
    "Bookings breakdown",
    "AI assistant impact",
  ];
  for (const area of toolAreas) {
    check(`mentions '${area}'`, a.includes(area));
  }

  console.log("\n=== Hard rules present ===");
  const requiredSnippets: Array<[string, string]> = [
    ["call a tool", "Always call a tool"],
    ["never invent numbers", "Never make up a number"],
    ["short replies", "Keep replies very short"],
    ["follow-up time-range carryover", "reuse the previous time range"],
    ["conversion >100% caveat", "exceed 100%"],
    ["belowThreshold flag handling", "belowThreshold"],
    ["sampleN flag handling", "sampleN"],
    ["shop-scoping reinforcement", "pre-scoped"],
    ["routes how-to → Help", "how-to assistant"],
    ["already authenticated guard", "already authenticated"],
  ];
  for (const [label, snippet] of requiredSnippets) {
    check(`prompt contains: ${label}`, a.includes(snippet), `snippet='${snippet}'`);
  }

  console.log("\n=== Style guidance present ===");
  for (const s of ["$1,234.56", "38.7%", "last 7 days"]) {
    check(`prompt mentions format example '${s}'`, a.includes(s));
  }

  console.log("\n=== Reads as one system prompt block ===");
  check("starts with role declaration", a.startsWith("You are RepairCoin's Business-Data Insights"));
  check("includes 'Hard rules' header", /^# Hard rules$/m.test(a));
  check("includes 'What you can answer' header", /^# What you can answer$/m.test(a));

  console.log(`\n=== Verdict ===\n  ${pass} passed, ${fail} failed${fail ? " ✗" : " ✓"}`);
  if (fail) process.exit(1);
}

main();
