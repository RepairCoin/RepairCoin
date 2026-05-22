// backend/tests/ai-agent/insights/tools/suggestFollowups.test.ts
//
// Meta-tool — no DB, just echoes Claude's `questions` through as a
// `follow_ups` display payload. No mock pool needed; we just verify
// the validation + cleaning logic + display shape.

import { suggestFollowups } from "../../../../src/domains/AIAgentDomain/services/insights/tools/suggestFollowups";

// Stub context — tool never touches ctx.
const ctx = { shopId: "any", pool: {} as any };

describe("suggest_followups tool", () => {
  it("returns kind=follow_ups display with the cleaned question array", async () => {
    const r = await suggestFollowups.execute(
      { questions: ["Top customers this week", "Compare to last week"] },
      ctx
    );
    expect(r.data).toEqual({
      questions: ["Top customers this week", "Compare to last week"],
    });
    expect(r.display).toEqual({
      kind: "follow_ups",
      items: ["Top customers this week", "Compare to last week"],
    });
  });

  it("trims whitespace and drops empty strings", async () => {
    const r = await suggestFollowups.execute(
      { questions: ["  Top services  ", "", "  ", "Revenue this month"] },
      ctx
    );
    const data = r.data as { questions: string[] };
    expect(data.questions).toEqual(["Top services", "Revenue this month"]);
  });

  it("drops questions over the 80-char limit", async () => {
    const tooLong = "x".repeat(81);
    const r = await suggestFollowups.execute(
      { questions: ["Short ok", tooLong, "Also ok"] },
      ctx
    );
    const data = r.data as { questions: string[] };
    expect(data.questions).toEqual(["Short ok", "Also ok"]);
  });

  it("caps at 5 questions max even if Claude supplies more", async () => {
    const r = await suggestFollowups.execute(
      {
        questions: ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7"],
      },
      ctx
    );
    const data = r.data as { questions: string[] };
    expect(data.questions).toHaveLength(5);
    expect(data.questions[0]).toBe("Q1");
    expect(data.questions[4]).toBe("Q5");
  });

  it("filters non-string array entries", async () => {
    const r = await suggestFollowups.execute(
      { questions: ["Valid", 42, null, "Also valid", undefined, true] as any },
      ctx
    );
    const data = r.data as { questions: string[] };
    expect(data.questions).toEqual(["Valid", "Also valid"]);
  });

  it("throws when no valid questions remain after cleaning", async () => {
    await expect(
      suggestFollowups.execute({ questions: ["", "   ", "x".repeat(200)] }, ctx)
    ).rejects.toThrow(/at least one non-empty question/);
  });

  it("throws when args is not an object", async () => {
    await expect(
      suggestFollowups.execute("not an object", ctx)
    ).rejects.toThrow(/args must be an object/);
  });

  it("throws when questions is not an array", async () => {
    await expect(
      suggestFollowups.execute({ questions: "not array" }, ctx)
    ).rejects.toThrow(/must be an array/);
  });

  it("never queries ctx.pool", async () => {
    const poolMock = { query: jest.fn() };
    await suggestFollowups.execute(
      { questions: ["test"] },
      { shopId: "any", pool: poolMock as any }
    );
    expect(poolMock.query).not.toHaveBeenCalled();
  });

  it("inputSchema constrains questions array to 1-5 strings ≤80 chars", () => {
    const schema = suggestFollowups.inputSchema as {
      properties: {
        questions: { type: string; items: any; minItems: number; maxItems: number };
      };
      required: string[];
    };
    expect(schema.properties.questions.type).toBe("array");
    expect(schema.properties.questions.minItems).toBe(1);
    expect(schema.properties.questions.maxItems).toBe(5);
    expect(schema.properties.questions.items.maxLength).toBe(80);
    expect(schema.required).toEqual(["questions"]);
  });
});
