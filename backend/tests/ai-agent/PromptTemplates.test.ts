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
  buildTodayLine,
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
    bookingAdvanceDays: null,
    minBookingHours: null,
    reschedulesAllowed: null,
    maxReschedulesPerBooking: null,
    rescheduleMinHours: null,
    cancellationMinHours: null,
  },
  conversationHistory: [],
  siblingServices: [],
  availabilitySlots: [],
  shopServiceMenu: [],
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

  it("instructs Claude to use the propose_booking_slot tool (NOT fenced JSON) + ONLY-listed slots", () => {
    // fix-7: switched from fenced JSON instructions to tool-use guidance.
    // The fenced ```booking_suggestion``` block was removed because it
    // conflicted with the tool added in fix-6, causing Claude to do neither
    // reliably. Now the prompt tells Claude to call the tool (validated by
    // Anthropic against the schema) and to NEVER emit fenced JSON.
    const ctx = baseContext({ availabilitySlots: [slot1] });
    const prompt = professionalPrompt(ctx);
    // Tool name must be referenced explicitly so Claude knows what to call
    expect(prompt).toContain("propose_booking_slot");
    // Real slot_iso must be present (tool's enum values are sourced from this list)
    expect(prompt).toContain(slot1.slotIso);
    // Forbid fenced JSON in plain text (the old failure mode)
    expect(prompt).toMatch(/never include booking-suggestion json|never write fenced code blocks/i);
  });

  it("applies to all three tones consistently", () => {
    const ctx = baseContext({ availabilitySlots: [slot1] });
    for (const buildPrompt of [friendlyPrompt, professionalPrompt, urgentPrompt]) {
      const p = buildPrompt(ctx);
      // Each tone must include the tool-use guidance and the real slot_iso
      expect(p).toContain("propose_booking_slot");
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

describe("PromptTemplates — AI disclosure rule (Option B follow-up)", () => {
  // Added 2026-05-08: when customers ask "are you AI?" / "is this a bot?",
  // EscalationDetector previously silently bowed out, leaving customers with
  // no acknowledgement. Now the AI answers via prompt rule #9.
  it("instructs the AI to confirm AI nature + offer human handoff option", () => {
    const ctx = baseContext();
    const prompt = professionalPrompt(ctx);
    // The rule mentions the disclosure-question scenario explicitly
    expect(prompt).toMatch(/asks whether you'?re an AI|are you AI|is this a bot/i);
    // Instructs honesty (confirm you're an AI assistant)
    expect(prompt).toMatch(/confirm honestly|AI assistant/i);
    // Instructs offering human handoff as a choice
    expect(prompt).toMatch(/flag a real human|real teammate|human if they/i);
  });

  it("applies disclosure rule to all three tones", () => {
    const ctx = baseContext();
    for (const buildPrompt of [friendlyPrompt, professionalPrompt, urgentPrompt]) {
      const p = buildPrompt(ctx);
      expect(p).toMatch(/asks whether you'?re an AI|is this a bot/i);
    }
  });
});

describe("PromptTemplates — booking policy block (dynamic window follow-up)", () => {
  // Added when the AvailabilityFetcher lookahead became dynamic (sourced
  // from shop_time_slot_config.booking_advance_days). The booking policy
  // must surface in the prompt context so Claude can answer "can I book
  // in 3 weeks?" honestly instead of saying "no slots" when the requested
  // date is outside the shop's advance-booking window.
  const ctxWithPolicy = (overrides: any = {}): any =>
    baseContext({
      shop: {
        shopId: "peanut",
        shopName: "Peanut Auto Shop",
        category: "automotive",
        hoursSummary: "Mon-Fri 9am-6pm, Sat closed",
        timezone: "America/Chicago",
        bookingAdvanceDays: 6,
        minBookingHours: 3,
        reschedulesAllowed: null,
        maxReschedulesPerBooking: null,
        rescheduleMinHours: null,
        cancellationMinHours: null,
        ...overrides,
      },
    });

  it("renders 'Booking policy' line with advance days when configured", () => {
    const prompt = professionalPrompt(ctxWithPolicy());
    expect(prompt).toMatch(/Booking policy:.*6 days in advance/i);
  });

  it("renders minimum-notice text when minBookingHours is set", () => {
    const prompt = professionalPrompt(ctxWithPolicy({ minBookingHours: 3 }));
    expect(prompt).toMatch(/3 hours? before the appointment/i);
  });

  it("uses singular 'hour' grammar for minBookingHours=1", () => {
    const prompt = professionalPrompt(ctxWithPolicy({ minBookingHours: 1 }));
    expect(prompt).toMatch(/1 hour before/i);
    expect(prompt).not.toMatch(/1 hours before/i);
  });

  it("omits the booking policy block entirely when both values are null", () => {
    const prompt = professionalPrompt(baseContext()); // shop fields default null
    expect(prompt).not.toMatch(/Booking policy:/);
  });

  it("omits a single null field without breaking the rest", () => {
    // bookingAdvanceDays set, minBookingHours null — the per-shop policy
    // block should show advance days but NOT include a "Minimum notice: N hours"
    // line. Universal rule #10 still mentions minimum-notice generically;
    // we assert specifically on the policy-block phrasing to distinguish.
    const prompt = professionalPrompt(
      ctxWithPolicy({ bookingAdvanceDays: 14, minBookingHours: null })
    );
    expect(prompt).toMatch(/14 days in advance/i);
    // The shop-specific format is "Minimum notice: N hour(s) before the appointment."
    expect(prompt).not.toMatch(/Minimum notice:\s*\d+\s*hours?\s*before/i);
  });

  it("includes a universal rule on booking-window reasoning", () => {
    const prompt = professionalPrompt(ctxWithPolicy());
    // Rule #10 explicitly mentions advance window + dates beyond it
    expect(prompt).toMatch(/booking[-\s]window reasoning|beyond the advance window|isn'?t open yet/i);
    // Rule must instruct AI NOT to claim out-of-window phrasing for available
    // dates. Refined wording: "Don't claim the date is unavailable" / "Do NOT
    // say 'the date isn't open yet'" appears in the within-window branch.
    expect(prompt).toMatch(/Don'?t claim the date is unavailable|Do NOT say.*isn'?t open yet/i);
  });

  it("applies booking policy to all three tones", () => {
    for (const buildPrompt of [friendlyPrompt, professionalPrompt, urgentPrompt]) {
      const p = buildPrompt(ctxWithPolicy());
      expect(p).toMatch(/6 days in advance/i);
    }
  });

  // Reschedule + cancellation rendering — added when those policies got
  // surfaced so the AI can answer "can I reschedule?" / "how do I cancel?"
  // without escalating every time.

  it("renders 'Reschedules: allowed (...)' line when reschedulesAllowed=true with full details", () => {
    const prompt = professionalPrompt(
      ctxWithPolicy({
        reschedulesAllowed: true,
        maxReschedulesPerBooking: 2,
        rescheduleMinHours: 24,
      })
    );
    expect(prompt).toMatch(/Reschedules: allowed/i);
    expect(prompt).toMatch(/up to 2 per booking/i);
    expect(prompt).toMatch(/24\+ hours before/i);
    expect(prompt).toMatch(/shop must approve/i);
  });

  it("renders 'Reschedules: not allowed.' when reschedulesAllowed=false", () => {
    const prompt = professionalPrompt(
      ctxWithPolicy({ reschedulesAllowed: false })
    );
    expect(prompt).toMatch(/Reschedules: not allowed/i);
    // Make sure we don't also emit the "allowed (...)" template
    expect(prompt).not.toMatch(/Reschedules: allowed/i);
  });

  it("omits reschedule line entirely when reschedulesAllowed is null (no config)", () => {
    const prompt = professionalPrompt(ctxWithPolicy({ reschedulesAllowed: null }));
    expect(prompt).not.toMatch(/Reschedules:/);
  });

  it("renders 'Cancellations: at least N hours notice required' when cancellationMinHours is set", () => {
    const prompt = professionalPrompt(
      ctxWithPolicy({ cancellationMinHours: 4 })
    );
    expect(prompt).toMatch(/Cancellations: at least 4 hours notice required/i);
  });

  it("uses singular 'hour' for cancellationMinHours=1", () => {
    const prompt = professionalPrompt(ctxWithPolicy({ cancellationMinHours: 1 }));
    expect(prompt).toMatch(/at least 1 hour notice/i);
    expect(prompt).not.toMatch(/at least 1 hours/i);
  });

  it("omits cancellation line when cancellationMinHours is null (policy disabled or absent)", () => {
    const prompt = professionalPrompt(ctxWithPolicy({ cancellationMinHours: null }));
    expect(prompt).not.toMatch(/Cancellations:/);
  });

  it("combines all four policy facts cleanly when fully configured", () => {
    const prompt = professionalPrompt(
      ctxWithPolicy({
        bookingAdvanceDays: 6,
        minBookingHours: 3,
        reschedulesAllowed: true,
        maxReschedulesPerBooking: 2,
        rescheduleMinHours: 24,
        cancellationMinHours: 4,
      })
    );
    expect(prompt).toMatch(/6 days in advance/i);
    expect(prompt).toMatch(/3 hours? before the appointment/i);
    expect(prompt).toMatch(/Reschedules: allowed.*2 per booking.*24\+ hours/i);
    expect(prompt).toMatch(/Cancellations: at least 4 hours notice/i);
  });
});

describe("PromptTemplates — Phase 1 multi-service shop menu", () => {
  // Added with Phase 1 of multi-service architecture: AI now sees ALL
  // AI-enabled services for the shop in a "menu" block, regardless of the
  // focused service's aiSuggestUpsells toggle. Lets the AI answer
  // "what else do you offer?" honestly.
  const ctxWithMenu = (overrides: any = {}): AgentContext =>
    baseContext({
      shopServiceMenu: [
        {
          serviceId: "srv_aqua",
          serviceName: "AQua Tech",
          priceUsd: 455,
          durationMinutes: 60,
          category: "Tech",
          shortBlurb: "Laptop diagnostic and repair service.",
        },
        {
          serviceId: "srv_mongo",
          serviceName: "Mongo Tea",
          priceUsd: 25,
          category: "Food",
          shortBlurb: "Premium tea consultation.",
        },
      ],
      ...overrides,
    });

  it("renders the multi-service menu block when shopServiceMenu has entries", () => {
    const prompt = professionalPrompt(ctxWithMenu());
    expect(prompt).toMatch(/This shop'?s other AI-bookable services/i);
    expect(prompt).toContain("AQua Tech ($455.00, ~60 min)");
    expect(prompt).toContain("Laptop diagnostic and repair service");
    expect(prompt).toContain("Mongo Tea ($25.00)");
    expect(prompt).toContain("Premium tea consultation");
  });

  it("warns the AI that menu services can't be booked directly here", () => {
    const prompt = professionalPrompt(ctxWithMenu());
    // Phase 2 will expand the tool to handle multi-service booking. Until then,
    // the prompt makes clear the AI can DESCRIBE but not BOOK these.
    expect(prompt).toMatch(/cannot directly book them from this chat|direct them to that service'?s page/i);
  });

  it("omits the menu block entirely when shopServiceMenu is empty", () => {
    const prompt = professionalPrompt(baseContext()); // default empty array
    expect(prompt).not.toMatch(/This shop'?s other AI-bookable services/i);
  });

  it("renders menu service without duration when durationMinutes is missing", () => {
    const ctx = baseContext({
      shopServiceMenu: [
        {
          serviceId: "srv_x",
          serviceName: "Generic Service",
          priceUsd: 50,
          category: "general",
          shortBlurb: null,
        },
      ],
    });
    const prompt = professionalPrompt(ctx);
    expect(prompt).toContain("Generic Service ($50.00)");
    expect(prompt).not.toContain("Generic Service ($50.00, ~");
  });

  it("renders menu service without blurb when shortBlurb is null", () => {
    const ctx = baseContext({
      shopServiceMenu: [
        {
          serviceId: "srv_x",
          serviceName: "Generic Service",
          priceUsd: 50,
          category: "general",
          shortBlurb: null,
        },
      ],
    });
    const prompt = professionalPrompt(ctx);
    // Format: "- Service ($50.00)" with no trailing ": blurb"
    expect(prompt).toMatch(/- Generic Service \(\$50\.00\)$/m);
  });

  it("menu block applies to all three tones", () => {
    for (const buildPrompt of [friendlyPrompt, professionalPrompt, urgentPrompt]) {
      const p = buildPrompt(ctxWithMenu());
      expect(p).toMatch(/AI-bookable services/i);
      expect(p).toContain("AQua Tech");
    }
  });
});

describe("PromptTemplates — today's date anchor (date-reasoning fix)", () => {
  // Without an explicit "today" anchor, Claude was misapplying the "out of
  // window" rule to dates that were actually within the booking window —
  // e.g. saying "May 14 isn't open yet" when today was May 11 and the shop
  // allowed 6 days advance (May 14 is 3 days out, clearly inside).
  it("buildTodayLine renders a weekday + month + day + year string", () => {
    const line = buildTodayLine("America/New_York");
    expect(line).toMatch(/^Today's date: /);
    // Weekday name
    expect(line).toMatch(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/);
    // Month name
    expect(line).toMatch(/(January|February|March|April|May|June|July|August|September|October|November|December)/);
    // Year (4-digit)
    expect(line).toMatch(/\b20\d{2}\b/);
    // Timezone parenthetical when provided
    expect(line).toContain("(America/New_York)");
  });

  it("buildTodayLine falls back gracefully when timezone is null", () => {
    const line = buildTodayLine(null);
    expect(line).toMatch(/^Today's date: /);
    // No trailing timezone parenthetical when none was provided
    expect(line).not.toMatch(/\(.*\)/);
  });

  it("buildTodayLine survives a bogus IANA timezone string", () => {
    // Intentionally invalid timezone — should not throw, should still
    // render a date (without timezone info).
    const line = buildTodayLine("Mars/Olympus_Mons");
    expect(line).toMatch(/^Today's date: /);
    expect(line).toMatch(/\b20\d{2}\b/);
  });

  it("today's date appears in the system prompt for all three tones", () => {
    const ctx = baseContext({
      shop: {
        shopId: "peanut",
        shopName: "Peanut Auto",
        category: "automotive",
        hoursSummary: null,
        timezone: "America/Chicago",
        bookingAdvanceDays: 6,
        minBookingHours: 3,
        reschedulesAllowed: null,
        maxReschedulesPerBooking: null,
        rescheduleMinHours: null,
        cancellationMinHours: null,
      },
    });
    for (const buildPrompt of [friendlyPrompt, professionalPrompt, urgentPrompt]) {
      const p = buildPrompt(ctx);
      expect(p).toMatch(/Today's date: \w+, \w+ \d{1,2}, 20\d{2}/);
    }
  });
});

describe("PromptTemplates — refined rule #10 (within-window vs beyond-window)", () => {
  // The misapplied "out of window" reply was the bug — date WITHIN the
  // window with no visible slots was getting the same message as date
  // BEYOND the window. Rule #10 now distinguishes these.
  const ctx = (overrides: any = {}): any =>
    baseContext({
      shop: {
        shopId: "peanut",
        shopName: "Peanut",
        category: "automotive",
        hoursSummary: "Mon-Fri 9am-6pm",
        timezone: "America/Chicago",
        bookingAdvanceDays: 6,
        minBookingHours: 3,
        ...overrides,
      },
    });

  it("rule #10 instructs Claude to compute days_from_today using the Today anchor", () => {
    const prompt = professionalPrompt(ctx());
    expect(prompt).toMatch(/days_from_today|Today'?s date/i);
    expect(prompt).toMatch(/do NOT guess|do not guess/i);
  });

  it("rule #10 covers the WITHIN-window-but-no-slots case explicitly", () => {
    const prompt = professionalPrompt(ctx());
    // Should explicitly mention the "all booked" / "shop closed that weekday" scenarios
    expect(prompt).toMatch(/all booked|shop is closed that weekday|no openings on that date/i);
    // Should suggest the right phrasing: flag a teammate / try a different day
    expect(prompt).toMatch(/flag a teammate.*double-check|try a different day/i);
  });

  it("rule #10 covers the BEYOND-window case with the correct phrasing", () => {
    const prompt = professionalPrompt(ctx());
    expect(prompt).toMatch(/N days in advance.*isn'?t open yet/i);
  });

  it("rule #10 explicitly warns against conflating the two cases", () => {
    const prompt = professionalPrompt(ctx());
    expect(prompt).toMatch(/conflate|common mistake|do NOT use.*beyond the window.*for dates.*WITHIN/i);
  });
});

describe("PromptTemplates — multi-service booking rule (#11)", () => {
  // Background: customer asked "book me a laptop repair and a pastry
  // tutorial" — AI silently proposed a single slot for the current
  // service without acknowledging the other one. Customer thought
  // both were booked → UX failure. Rule #11 forces explicit handling.
  const ctx = baseContext;

  it("rule #11 acknowledges the tool only books ONE service per call", () => {
    const prompt = professionalPrompt(ctx());
    expect(prompt).toMatch(/propose_booking_slot tool can only book ONE service/i);
  });

  it("rule #11 forbids silent half-fulfillment", () => {
    const prompt = professionalPrompt(ctx());
    expect(prompt).toMatch(/DO NOT silently propose|silently fulfills only half|silently propose a slot for one and ignore the other/i);
  });

  it("rule #11 instructs the AI to name which service the tap-to-book is for", () => {
    const prompt = professionalPrompt(ctx());
    // After the two-channel sharpen, the wording is "name the service it's
    // booking" inside the reply_text guidance.
    expect(prompt).toMatch(/name the service it'?s booking|explicitly name which service|name which service the tap-to-book/i);
  });

  it("rule #11 directs the AI to send customer elsewhere for additional services", () => {
    const prompt = professionalPrompt(ctx());
    // Either "book those separately from each service's page" OR "flag a teammate"
    expect(prompt).toMatch(/book those separately|each service'?s page|flag a teammate to coordinate/i);
  });

  it("rule #11 includes a concrete good example with the two-channel structure", () => {
    const prompt = professionalPrompt(ctx());
    // GOOD example demonstrates the required two-channel split
    expect(prompt).toMatch(/For the pastry tutorial.*Thursday May 14 at 9 AM/i);
    // The "what to do about the laptop repair" line in the text-block half
    expect(prompt).toMatch(/laptop repair.*book that through.*service page separately/i);
  });

  it("rule #11 includes anti-patterns to avoid (silent half-fulfillment)", () => {
    const prompt = professionalPrompt(ctx());
    // Anti-pattern section explicitly forbids silent half-fulfillment
    expect(prompt).toMatch(/NEVER do this|silent half-fulfillment/i);
    // Specifically calls out the "ambiguous slot announcement" failure mode
    expect(prompt).toMatch(/which service|silently drops the other service/i);
  });

  it("rule #11 explicitly instructs the AI to use BOTH output channels", () => {
    // Channel-guidance sharpen: previously Claude was inconsistent about
    // whether to emit a separate text block alongside the tool. Rule now
    // demands both channels be used for multi-service requests.
    const prompt = professionalPrompt(ctx());
    expect(prompt).toMatch(/TWO output channels|use both channels|MUST use both/i);
    expect(prompt).toMatch(/text block.*OTHER service|OTHER service.*text block/i);
    expect(prompt).toMatch(/tool.*reply_text.*current service|reply_text.*book(ing|able)/i);
  });

  it("rule #11 clarifies the structure of a multi-service response", () => {
    const prompt = professionalPrompt(ctx());
    // Must reference "First content block" and "Second content block" (or
    // similar structure language) so Claude understands order matters.
    expect(prompt).toMatch(/First content block|REQUIRED structure/i);
  });

  it("rule #11 carves out single-service requests from the two-channel rule", () => {
    const prompt = professionalPrompt(ctx());
    // The two-channel structure should NOT apply to single-service questions —
    // that would lead to redundant text blocks ("for the pastry tutorial..."
    // emitted alongside a single-service booking).
    expect(prompt).toMatch(/Single-service requests|ONLY applies when.*multiple services|no text block needed/i);
  });

  it("rule #11 applies to all three tones", () => {
    for (const buildPrompt of [friendlyPrompt, professionalPrompt, urgentPrompt]) {
      const p = buildPrompt(ctx());
      expect(p).toMatch(/Multi-service booking|only book ONE service per call/i);
    }
  });
});
