// backend/tests/ai-agent/insights/InsightsPromptBuilder.test.ts
//
// Structural checks on the system prompt — guardrails, decline copy,
// defaults rule, conversion >100% caveat, below-threshold guidance.
// Companion smoke script: backend/scripts/smoke-insights-prompt-builder.ts.

import {
  buildInsightsSystemPrompt,
  INSIGHTS_DECLINE_COPY,
} from "../../../src/domains/AIAgentDomain/services/InsightsPromptBuilder";

describe("buildInsightsSystemPrompt", () => {
  it("is pure — two calls produce identical output", () => {
    expect(buildInsightsSystemPrompt()).toBe(buildInsightsSystemPrompt());
  });

  it("returns a non-trivial string", () => {
    expect(buildInsightsSystemPrompt().length).toBeGreaterThan(1000);
  });

  it("embeds the exact INSIGHTS_DECLINE_COPY for unmatched questions", () => {
    expect(typeof INSIGHTS_DECLINE_COPY).toBe("string");
    expect(INSIGHTS_DECLINE_COPY.length).toBeGreaterThan(0);
    expect(buildInsightsSystemPrompt()).toContain(INSIGHTS_DECLINE_COPY);
  });

  it("decline copy points the user at the Help assistant", () => {
    expect(INSIGHTS_DECLINE_COPY).toMatch(/Help/);
  });

  it("starts with the role declaration", () => {
    expect(buildInsightsSystemPrompt()).toMatch(
      /^You are RepairCoin's Business-Data Insights/
    );
  });

  it("has 'What you can answer' + 'Hard rules' top-level sections", () => {
    const prompt = buildInsightsSystemPrompt();
    expect(prompt).toMatch(/^# What you can answer$/m);
    expect(prompt).toMatch(/^# Hard rules$/m);
    // Rules section comes after the scope-statement.
    expect(prompt.indexOf("# What you can answer")).toBeLessThan(
      prompt.indexOf("# Hard rules")
    );
  });

  it("lists all 5 v1 tool areas by name in 'What you can answer'", () => {
    const prompt = buildInsightsSystemPrompt();
    expect(prompt).toContain("Revenue");
    expect(prompt).toContain("Top customers");
    expect(prompt).toContain("Top services");
    expect(prompt).toContain("Bookings breakdown");
    expect(prompt).toContain("AI assistant impact");
  });

  describe("hard rules", () => {
    const prompt = buildInsightsSystemPrompt();

    it("rule: always call a tool for numerical answers", () => {
      expect(prompt).toMatch(/Always call a tool/);
    });

    it("rule: never make up a number", () => {
      expect(prompt).toMatch(/Never make up a number/);
    });

    it("rule: short replies (2-3 sentences target)", () => {
      expect(prompt).toMatch(/Keep replies very short/);
    });

    it("rule: defaults instead of clarifying (post-hot-fix)", () => {
      // Post-2026-05-21 hot-fix replaced the bare "reuse range" rule
      // with a bundled defaults rule. Both substrings must be present.
      expect(prompt).toMatch(/Default to sensible parameters/i);
      expect(prompt).toMatch(/reuse the previous time range/);
      // Specific default values surfaced for Claude.
      expect(prompt).toMatch(/range: "30d"/);
      expect(prompt).toMatch(/by: "spend"/);
      expect(prompt).toMatch(/by: "revenue"/);
    });

    it("rule: conversion >100% honest phrasing (Phase 2.3 caveat)", () => {
      expect(prompt).toMatch(/exceed 100%/);
    });

    it("rule: below-threshold / sampleN < 5 flag (Phase 2.5 caveat)", () => {
      expect(prompt).toMatch(/belowThreshold/);
      expect(prompt).toMatch(/sampleN/);
    });

    it("rule: shop-scoping is hardcoded — don't claim cross-shop comparisons", () => {
      expect(prompt).toMatch(/pre-scoped/);
    });

    it("rule: route how-to questions to the Help assistant", () => {
      expect(prompt).toMatch(/how-to assistant/i);
    });

    it("rule: don't ask the user to re-authenticate", () => {
      expect(prompt).toMatch(/already authenticated/);
    });

    it("rule: call suggest_followups after answering (Phase 6.3)", () => {
      // Tool name explicitly mentioned so Claude knows what to call.
      expect(prompt).toMatch(/suggest_followups/);
      // Constraints on the chips — must be answerable + naturally phrased.
      expect(prompt).toMatch(/answerable by one of your other tools/i);
      expect(prompt).toMatch(/phrase them naturally/i);
      // Skip-on-done escape hatch so we don't suggest chips after "thanks".
      expect(prompt.toLowerCase()).toContain("thanks");
    });
  });

  describe("style guidance", () => {
    const prompt = buildInsightsSystemPrompt();

    it("shows USD formatting example", () => {
      expect(prompt).toContain("$1,234.56");
    });

    it("shows percentage formatting example", () => {
      expect(prompt).toContain("38.7%");
    });

    it("spells out time windows in the style example", () => {
      expect(prompt).toContain("last 7 days");
    });
  });
});
