// backend/tests/ai-agent/PromptTemplates.test.ts
//
// Unit tests for PromptTemplates. Pure functions, no DB or SDK — straightforward.
// Verifies:
//   - All three tones produce valid, non-empty prompts
//   - Universal rules are present in every prompt regardless of tone
//   - Tone-specific cues are present in their respective prompts
//   - Customer name + service name + price + shop name make it through
//   - Sibling services included only when present
//   - Custom instructions appear when set, omitted when null
//   - buildSystemPrompt dispatcher routes correctly + falls back to professional

import {
  friendlyPrompt,
  professionalPrompt,
  urgentPrompt,
  buildSystemPrompt,
} from "../../src/domains/AIAgentDomain/services/PromptTemplates";
import { AgentContext } from "../../src/domains/AIAgentDomain/types";

const baseContext = (overrides: Partial<AgentContext> = {}): AgentContext => ({
  service: {
    serviceId: "srv_test",
    serviceName: "Oil Change - Full Synthetic",
    description: "Standard oil change with full synthetic oil and filter replacement.",
    priceUsd: 89.99,
    durationMinutes: 30,
    category: "automotive",
    customInstructions: null,
    bookingAssistance: true,
    suggestUpsells: false,
  },
  customer: {
    address: "0xabc123",
    name: "Lee Chun Nan",
    tier: "BRONZE",
    rcnBalance: 25,
    joinedAt: new Date("2026-04-01"),
  },
  shop: {
    shopId: "peanut",
    shopName: "Peanut Auto Shop",
    category: "automotive",
    hoursSummary: null,
    timezone: null,
  },
  conversationHistory: [],
  siblingServices: [],
  ...overrides,
});

describe("PromptTemplates — universal rules", () => {
  const ctx = baseContext();

  it.each([
    ["friendly", () => friendlyPrompt(ctx)],
    ["professional", () => professionalPrompt(ctx)],
    ["urgent", () => urgentPrompt(ctx)],
  ])("%s prompt includes the AI disclosure rule", (_tone, build) => {
    const prompt = build();
    expect(prompt).toMatch(/disclose you are an AI assistant/i);
  });

  it.each([
    ["friendly", () => friendlyPrompt(ctx)],
    ["professional", () => professionalPrompt(ctx)],
    ["urgent", () => urgentPrompt(ctx)],
  ])("%s prompt includes 'never invent prices/hours' rule", (_tone, build) => {
    const prompt = build();
    expect(prompt).toMatch(/NEVER invent prices, hours, policies/);
  });

  it.each([
    ["friendly", () => friendlyPrompt(ctx)],
    ["professional", () => professionalPrompt(ctx)],
    ["urgent", () => urgentPrompt(ctx)],
  ])("%s prompt includes the 'human handoff' rule", (_tone, build) => {
    const prompt = build();
    expect(prompt).toMatch(/talk to a person|real agent|human/i);
  });

  it.each([
    ["friendly", () => friendlyPrompt(ctx)],
    ["professional", () => professionalPrompt(ctx)],
    ["urgent", () => urgentPrompt(ctx)],
  ])("%s prompt includes service name + price + shop name", (_tone, build) => {
    const prompt = build();
    expect(prompt).toContain("Oil Change - Full Synthetic");
    expect(prompt).toContain("$89.99");
    expect(prompt).toContain("Peanut Auto Shop");
  });
});

describe("PromptTemplates — tone-specific signatures", () => {
  it("friendly prompt has casual cues", () => {
    const prompt = friendlyPrompt(baseContext());
    expect(prompt).toMatch(/casual|warm|friend/i);
    expect(prompt).toMatch(/Hey!|Awesome|Totally/);
  });

  it("professional prompt has formal cues", () => {
    const prompt = professionalPrompt(baseContext());
    expect(prompt).toMatch(/formal|courteous|fact-focused/i);
    expect(prompt).toContain("Our shop offers");
  });

  it("urgent prompt has urgency cues", () => {
    const prompt = urgentPrompt(baseContext());
    expect(prompt).toMatch(/urgency|time-pressure|immediacy/i);
    expect(prompt).toMatch(/🔥|⚡|⏰|🎯/);
  });

  it("urgent prompt explicitly bans fabricated scarcity", () => {
    const prompt = urgentPrompt(baseContext());
    expect(prompt).toMatch(/never fabricate scarcity/i);
  });
});

describe("PromptTemplates — context content", () => {
  it("includes RCN balance line when balance > 0", () => {
    const prompt = professionalPrompt(baseContext({
      customer: { ...baseContext().customer, rcnBalance: 100 },
    }));
    expect(prompt).toContain("RCN balance: 100");
  });

  it("omits RCN balance line when balance is 0", () => {
    const prompt = professionalPrompt(baseContext({
      customer: { ...baseContext().customer, rcnBalance: 0 },
    }));
    expect(prompt).not.toMatch(/RCN balance: 0/);
  });

  it("includes custom shop instructions when set", () => {
    const prompt = professionalPrompt(baseContext({
      service: {
        ...baseContext().service,
        customInstructions: "Always offer the 30-day warranty.",
      },
    }));
    expect(prompt).toContain("Always offer the 30-day warranty.");
    expect(prompt).toMatch(/HONOR THESE/);
  });

  it("omits custom instructions block when null", () => {
    const prompt = professionalPrompt(baseContext());
    expect(prompt).not.toMatch(/HONOR THESE/);
  });

  it("includes sibling services when present", () => {
    const prompt = professionalPrompt(baseContext({
      siblingServices: [
        {
          serviceId: "srv_sibling",
          serviceName: "Tire Rotation",
          priceUsd: 25.0,
          durationMinutes: 15,
          shortBlurb: "Standard tire rotation, all four wheels.",
        },
      ],
    }));
    expect(prompt).toContain("Tire Rotation");
    expect(prompt).toContain("$25.00");
    expect(prompt).toContain("15 min");
  });

  it("omits sibling services section when array is empty", () => {
    const prompt = professionalPrompt(baseContext());
    expect(prompt).not.toMatch(/Other services this shop offers/);
  });

  it("includes hours summary when present", () => {
    const prompt = professionalPrompt(baseContext({
      shop: {
        ...baseContext().shop,
        hoursSummary: "Mon-Fri 9am-6pm",
        timezone: "America/Chicago",
      },
    }));
    expect(prompt).toContain("Mon-Fri 9am-6pm");
    expect(prompt).toContain("America/Chicago");
  });

  it("uses fallback message when hours not on file", () => {
    const prompt = professionalPrompt(baseContext());
    expect(prompt).toMatch(/hours.*not on file/i);
  });

  it("falls back to 'the customer' when name is null", () => {
    const prompt = friendlyPrompt(baseContext({
      customer: { ...baseContext().customer, name: null },
    }));
    expect(prompt).toContain("the customer");
  });
});

describe("PromptTemplates — buildSystemPrompt dispatcher", () => {
  const ctx = baseContext();

  it("routes friendly", () => {
    const prompt = buildSystemPrompt("friendly", ctx);
    expect(prompt).toMatch(/warm.*casual|casual.*warm/i);
    expect(prompt).toMatch(/friend/i);
  });

  it("routes professional", () => {
    const prompt = buildSystemPrompt("professional", ctx);
    expect(prompt).toMatch(/formal.*courteous|courteous.*formal/i);
  });

  it("routes urgent", () => {
    const prompt = buildSystemPrompt("urgent", ctx);
    expect(prompt).toMatch(/urgency|immediacy|time-pressure/i);
  });

  it("falls back to professional for unknown tones", () => {
    // Cast bypasses TS narrowing; real callers couldn't pass this
    const prompt = buildSystemPrompt("invalid-tone" as any, ctx);
    expect(prompt).toMatch(/formal.*courteous|courteous.*formal/i);
  });
});

describe("PromptTemplates — output sanity", () => {
  it("produces non-empty output for each tone", () => {
    const ctx = baseContext();
    expect(friendlyPrompt(ctx).length).toBeGreaterThan(500);
    expect(professionalPrompt(ctx).length).toBeGreaterThan(500);
    expect(urgentPrompt(ctx).length).toBeGreaterThan(500);
  });

  it("does not include placeholder tokens like {SHOP_NAME} after substitution", () => {
    const ctx = baseContext();
    const prompts = [friendlyPrompt(ctx), professionalPrompt(ctx), urgentPrompt(ctx)];
    for (const p of prompts) {
      // Real substitution should leave no {} placeholders unfilled
      // (Note: example text inside the disclosure rule explicitly contains
      // {SHOP_NAME} and {SERVICE_NAME} — those are intentional documentation
      // for the AI, not unfilled placeholders. Skip those.)
      const placeholders = p.match(/\{[A-Z_]+\}/g);
      const allowed = ["{SHOP_NAME}", "{SERVICE_NAME}"];
      const unexpected = (placeholders ?? []).filter((m) => !allowed.includes(m));
      expect(unexpected).toEqual([]);
    }
  });
});
