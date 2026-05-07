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
  availabilitySlots: [],
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

describe("PromptTemplates — booking suggestions block (Phase 3 Task 10)", () => {
  const slot1 = {
    date: "2026-05-08",
    time: "14:30",
    slotIso: "2026-05-08T06:30:00.000Z",
    humanLabel: "Thursday, May 8 at 2:30 PM",
  };
  const slot2 = {
    date: "2026-05-08",
    time: "15:30",
    slotIso: "2026-05-08T07:30:00.000Z",
    humanLabel: "Thursday, May 8 at 3:30 PM",
  };

  it("omits the booking block entirely when no availability slots are present", () => {
    const ctx = baseContext({ availabilitySlots: [] });
    const prompts = [friendlyPrompt(ctx), professionalPrompt(ctx), urgentPrompt(ctx)];
    for (const p of prompts) {
      expect(p).not.toContain("BOOKING");
      expect(p).not.toContain("booking_suggestion");
      expect(p).not.toContain("slot_iso");
    }
  });

  it("emits the slot list verbatim when availability is provided", () => {
    const ctx = baseContext({ availabilitySlots: [slot1, slot2] });
    const prompt = friendlyPrompt(ctx);
    expect(prompt).toContain("Thursday, May 8 at 2:30 PM");
    expect(prompt).toContain("2026-05-08T06:30:00.000Z");
    expect(prompt).toContain("Thursday, May 8 at 3:30 PM");
    expect(prompt).toContain("2026-05-08T07:30:00.000Z");
  });

  it("instructs Claude to emit the fenced booking_suggestion JSON block + ONLY-listed slots", () => {
    const ctx = baseContext({ availabilitySlots: [slot1] });
    const prompt = professionalPrompt(ctx);
    // Fence + variable name visible
    expect(prompt).toContain("```booking_suggestion");
    // Service id substituted into the JSON template
    expect(prompt).toContain('"service_id": "srv_test"');
    // Anti-hallucination guardrail
    expect(prompt).toMatch(/never invent|verbatim|copied/i);
  });

  it("applies to all three tones consistently", () => {
    const ctx = baseContext({ availabilitySlots: [slot1] });
    for (const buildPrompt of [friendlyPrompt, professionalPrompt, urgentPrompt]) {
      const p = buildPrompt(ctx);
      expect(p).toContain("```booking_suggestion");
      expect(p).toContain(slot1.slotIso);
    }
  });

  it("instructs Claude to be PROACTIVE — propose a slot when customer asks 'what's available'", () => {
    // Regression guard for the Task 10 fix: the original prompt told the AI
    // "DO NOT include a block unless the customer expressed booking intent",
    // which made it list slots and wait for the customer to pick instead of
    // recommending one. Sharpened to push proactive recommendation.
    const ctx = baseContext({ availabilitySlots: [slot1, slot2] });
    const prompt = professionalPrompt(ctx);
    expect(prompt).toMatch(/propose ONE specific slot|the customer expects YOU to recommend/i);
    expect(prompt).toMatch(/what'?s available|when can I come in|do you have any openings|what times do you have/i);
  });

  it("includes a concrete few-shot GOOD/BAD example to override Claude's default deference", () => {
    // Pure rule-based prompts weren't enough — Claude kept saying "would
    // you like me to suggest a specific time slot to book?" instead of
    // just suggesting. Few-shot examples forbid the deferential phrasing
    // explicitly and show the right pattern.
    const ctx = baseContext({ availabilitySlots: [slot1, slot2] });
    const prompt = professionalPrompt(ctx);
    // The GOOD example must reference a real slot from the prompt's slot list
    expect(prompt).toContain(slot1.humanLabel);
    expect(prompt).toContain(slot1.slotIso);
    // The BAD anti-example must explicitly forbid the deferential phrasing
    expect(prompt).toMatch(/would you like me to suggest|would you like me to suggest a specific time slot/i);
    expect(prompt).toMatch(/never|do not|don't.*ask permission|passive/i);
  });

  it("instructs Claude to match the customer's time-of-day preference", () => {
    // Regression guard for fix-3: smoke showed the AI suggesting 9 AM and
    // 10 AM after the customer asked for "Thursday afternoon" THREE TIMES.
    // Strengthened prompt with explicit time-band definitions so morning ≠
    // afternoon. AI must pick a slot at 12 PM or later when "afternoon" is
    // requested.
    const ctx = baseContext({ availabilitySlots: [slot1, slot2] });
    const prompt = professionalPrompt(ctx);
    // Time bands explicitly defined
    expect(prompt).toMatch(/morning.*before 12/i);
    expect(prompt).toMatch(/afternoon.*12.*PM or later|afternoon.*at 12/i);
    expect(prompt).toMatch(/evening.*5/i);
    // Anti-pattern explicitly forbidden — 9/10/11 AM are NOT afternoon
    expect(prompt).toMatch(/9 AM, 10 AM.*afternoon|NEVER suggest 9 AM/i);
  });
});

describe("PromptTemplates — universal style rules (Phase 3 Task 10 fix-3)", () => {
  it("forbids restating the service summary on every reply", () => {
    // Smoke showed every AI reply opening with "Thank you for your interest,
    // Lee Ann! Here is a quick summary of the Newly Baker service: Price
    // $99.00, Duration 30 minutes, Category Food & Beverage..." — even on
    // follow-ups where the customer obviously already knows. Robotic.
    const ctx = baseContext();
    const prompt = professionalPrompt(ctx);
    expect(prompt).toMatch(/restate the service summary|don't.*restate.*price.*duration|robotic/i);
  });

  it("includes good vs bad opener examples", () => {
    const ctx = baseContext();
    const prompt = professionalPrompt(ctx);
    // The bad opener pattern that has appeared repeatedly in production
    expect(prompt).toMatch(/Thank you for your interest!.*summary|here is a summary/i);
    // At least one good conversational opener example
    expect(prompt).toMatch(/sure|short answer|conversational|Match the customer'?s energy/i);
  });

  it("applies the style rules to all three tones", () => {
    const ctx = baseContext();
    for (const buildPrompt of [friendlyPrompt, professionalPrompt, urgentPrompt]) {
      const p = buildPrompt(ctx);
      expect(p).toMatch(/restate the service summary|robotic|conversational/i);
    }
  });
});
