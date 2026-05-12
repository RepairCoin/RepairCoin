/**
 * Local AI prompt-iteration smoke test.
 *
 * Runs the AgentOrchestrator end-to-end against the real Anthropic API,
 * with hand-built fixtures replacing the DB layer. Lets you iterate on
 * prompt rules + orchestrator filters in seconds instead of waiting for
 * a deploy.
 *
 * USAGE
 *   npx ts-node scripts/test-prompt-locally.ts                            # default scenario
 *   npx ts-node scripts/test-prompt-locally.ts --scenario=focused-default-bug
 *   npx ts-node scripts/test-prompt-locally.ts --scenario=multi-service-named --message="book me both newly baker and aqua tech this week"
 *   npx ts-node scripts/test-prompt-locally.ts --message="what's your address?"
 *   npx ts-node scripts/test-prompt-locally.ts --show-prompt              # also dump the full system prompt
 *
 * SCENARIOS
 *   focused-default-bug   AQua Tech anchored, 30+ turns of Newly Baker history,
 *                         no service named in the customer message → exercises
 *                         the focused-default server filter.
 *   multi-service-named   Same shop, customer names BOTH services in one
 *                         message → exercises Phase 3 multi-tool path.
 *   describe-only-handoff Customer asks to book a service that has
 *                         ai_booking_assistance=false → exercises the safety
 *                         net + describe-only menu rendering.
 *
 * COST: ~$0.005-0.01 per run on Sonnet. No DB writes, no audit log writes.
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { AgentOrchestrator } from "../src/domains/AIAgentDomain/services/AgentOrchestrator";
import { AnthropicClient } from "../src/domains/AIAgentDomain/services/AnthropicClient";
import { buildSystemPrompt } from "../src/domains/AIAgentDomain/services/PromptTemplates";
import {
  AgentContext,
  AITone,
  HandleCustomerMessageInput,
} from "../src/domains/AIAgentDomain/types";

// ============================================================================
// Argument parsing
// ============================================================================

interface CliArgs {
  scenario: string;
  customerMessage: string;
  showPrompt: boolean;
  tone: AITone;
}

function parseArgs(argv: string[]): CliArgs {
  const flags = new Map<string, string>();
  let bareMessage: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq > 0) {
        flags.set(arg.slice(2, eq), arg.slice(eq + 1));
      } else {
        // Boolean flag, or flag with separate value
        const next = argv[i + 1];
        if (next && !next.startsWith("--")) {
          flags.set(arg.slice(2), next);
          i++;
        } else {
          flags.set(arg.slice(2), "true");
        }
      }
    } else if (bareMessage === null) {
      bareMessage = arg;
    }
  }
  return {
    scenario: flags.get("scenario") ?? "focused-default-bug",
    customerMessage:
      flags.get("message") ?? bareMessage ?? "book me thursday at 2pm",
    showPrompt: flags.get("show-prompt") === "true",
    tone: (flags.get("tone") ?? "professional") as AITone,
  };
}

// ============================================================================
// Fixtures
// ============================================================================

const PEANUT_SHOP = {
  shopId: "peanut",
  shopName: "Peanut",
  category: "Repairs & Tech",
  hoursSummary: "Sun-Thu 9am-6pm, Fri 9am-5pm, Sat closed",
  timezone: "Asia/Manila",
  bookingAdvanceDays: 6,
  minBookingHours: 3,
  reschedulesAllowed: true,
  maxReschedulesPerBooking: 2,
  rescheduleMinHours: 24,
  cancellationMinHours: 4,
  address: "Obong-Patacbo Barangay Road, Patacbo, Basista, Pangasinan, Philippines",
  phone: "09162512445",
  email: "hello@peanutshop.example",
  website: "https://peanutshop.example",
};

const SAMPLE_CUSTOMER = {
  address: "0x_local_test_customer",
  name: "Qua Ting",
  tier: "BRONZE" as const,
  rcnBalance: 25,
  joinedAt: new Date("2026-04-01"),
};

const AQUA_TECH = {
  serviceId: "srv_aqua_local",
  serviceName: "AQua Tech",
  description: "Professional laptop diagnostic and repair service.",
  priceUsd: 455,
  durationMinutes: 60,
  category: "Tech",
  bookingAssistance: true,
  suggestUpsells: false,
  faqEntries: [] as { question: string; answer: string }[],
};

const NEWLY_BAKER = {
  serviceId: "srv_newly_local",
  serviceName: "Newly Baker",
  description: "Hands-on pastry tutorial led by our chef.",
  priceUsd: 99,
  durationMinutes: 45,
  category: "Food & Beverage",
  bookingAssistance: true,
  suggestUpsells: false,
  faqEntries: [] as { question: string; answer: string }[],
};

// Mirror the 7 entries seeded into staging for the I Robot service.
// Lets the local script exercise the production FAQ rendering path
// (PromptTemplates.buildFaqBlock) without hitting the DB at runtime.
const I_ROBOT_FAQ: { question: string; answer: string }[] = [
  {
    question: "What's included in this service?",
    answer:
      "The full modular hardware kit (chassis, IR + ultrasonic sensors, brushed-motor controller, 4-mic array, 5W speaker, ESP32-based main board, 3000 mAh battery), hands-on assembly with a certified technician, firmware flashing, Wi-Fi pairing, one starter routine of your choice, and a 14-day software-tweak follow-up.",
  },
  {
    question: "What's NOT included?",
    answer:
      "Ongoing maintenance after the 14-day follow-up window (billed at $89/visit), third-party accessories outside our kit catalog, structural modifications beyond the supplied chassis, and replacement parts for damage from misuse.",
  },
  {
    question: "How long does a typical appointment take?",
    answer:
      "Sessions typically run about 90 minutes from start to finish. You leave with a working bot the same day.",
  },
  {
    question: "Is it safe around children and pets?",
    answer:
      "Yes — plastic and light metal parts only, low-voltage throughout (5V main board, 12V motor controller; no line voltage). The motor controller has overcurrent protection and the sensors include a stop-on-touch reflex. Sound output is capped at 70 dB and can be muted entirely. Indoor use only; not waterproof.",
  },
  {
    question: "What should I bring?",
    answer:
      "Just yourself. Bring a laptop only if you'd like to learn the configuration tools alongside the technician — otherwise we handle the full setup. No prior robotics experience needed.",
  },
  {
    question: "What smart-home hubs do you integrate with?",
    answer:
      "Home Assistant, Google Home, and Apple HomeKit are supported out of the box. Voice command languages: English, Filipino, and Spanish. Note: the Wi-Fi network needs to be 2.4 GHz (the ESP32 module doesn't speak 5 GHz) — most home routers serve both.",
  },
  {
    question: "What's your cancellation or warranty policy?",
    answer:
      "Cancellations before the session start are refundable minus a 10% restocking fee. Once assembled, the kit isn't returnable. Hardware warranty: 90 days on supplied components, manufacturing defects only. Software tweaks free within the first 14 days; after that, repairs are quoted before any work.",
  },
];

// I Robot fixture: short marketplace blurb (matches the shortened DB row)
// plus the 7 seeded FAQ entries. Setup that mirrors live staging.
const I_ROBOT = {
  serviceId: "srv_irobot_local",
  serviceName: "I Robot",
  description:
    "Build your own personal helper robot in a hands-on session with one of our certified technicians. We supply the hardware kit and walk you through assembly, firmware, and one starter routine of your choice — you leave with a working bot the same day.",
  priceUsd: 699.99,
  durationMinutes: 90,
  category: "tech_it_services",
  bookingAssistance: true,
  suggestUpsells: true,
  faqEntries: I_ROBOT_FAQ,
};

function makeSlots(serviceId: string, serviceName: string) {
  // Five Thursday/Friday/Saturday slots — focused service.
  return [
    {
      date: "2026-05-14",
      time: "09:00",
      slotIso: "2026-05-14T01:00:00.000Z",
      humanLabel: "Thursday, May 14 at 9:00 AM",
      serviceId,
      serviceName,
    },
    {
      date: "2026-05-14",
      time: "14:00",
      slotIso: "2026-05-14T06:00:00.000Z",
      humanLabel: "Thursday, May 14 at 2:00 PM",
      serviceId,
      serviceName,
    },
    {
      date: "2026-05-15",
      time: "10:00",
      slotIso: "2026-05-15T02:00:00.000Z",
      humanLabel: "Friday, May 15 at 10:00 AM",
      serviceId,
      serviceName,
    },
    {
      date: "2026-05-15",
      time: "15:00",
      slotIso: "2026-05-15T07:00:00.000Z",
      humanLabel: "Friday, May 15 at 3:00 PM",
      serviceId,
      serviceName,
    },
  ];
}

function heavyNewlyBakerHistory(): AgentContext["conversationHistory"] {
  // 30 turns about Newly Baker — the bias source that staging showed pulls
  // Claude away from the current AQua Tech anchor on unnamed booking requests.
  const turns: AgentContext["conversationHistory"] = [];
  const exchanges: [string, string][] = [
    ["tell me about newly baker", "Newly Baker is a hands-on pastry tutorial with our chef — recipe of the week, all ingredients included."],
    ["how long is the session?", "About 45 minutes start to finish."],
    ["what should i bring?", "Just yourself! Aprons and ingredients are on us."],
    ["is it good for beginners?", "Totally — designed for beginners and home bakers."],
    ["any nut allergies?", "Wheat, dairy, eggs, and nuts are handled on premises — flag any allergy when you book."],
    ["can i reschedule?", "Yes — up to 2 reschedules per booking, 24+ hours before, shop approval required."],
    ["how about cancelling?", "At least 4 hours notice before your appointment."],
    ["do you bake bread too?", "Mostly pastries — focused on the recipe of the week."],
    ["what's this week's recipe?", "Croissants — buttery, flaky, the works."],
    ["can i bring a friend?", "Session is one-on-one with the chef, so just you."],
    ["any thursdays open this month?", "Most Thursdays have morning slots — 9 AM is typical."],
    ["price?", "$99 flat, includes everything."],
    ["payment?", "Card or RCN balance — your call."],
    ["how do i get there?", "Check the address; happy to share if you need it."],
    ["are tools included?", "Yep — bowls, whisks, scales, the lot."],
  ];
  for (const [user, assistant] of exchanges) {
    turns.push({ role: "user", content: user, createdAt: new Date() });
    turns.push({ role: "assistant", content: assistant, createdAt: new Date() });
  }
  return turns;
}

type ScenarioBuilder = () => AgentContext;

const SCENARIOS: Record<string, ScenarioBuilder> = {
  // Focused-default bug — anchor switched to AQua Tech, but conversation
  // history is overwhelmingly Newly Baker. Customer's unnamed booking
  // request should resolve to AQua Tech (the anchor).
  "focused-default-bug": () => ({
    service: AQUA_TECH,
    customer: SAMPLE_CUSTOMER,
    shop: PEANUT_SHOP,
    conversationHistory: heavyNewlyBakerHistory(),
    siblingServices: [],
    shopServiceMenu: [
      {
        serviceId: NEWLY_BAKER.serviceId,
        serviceName: NEWLY_BAKER.serviceName,
        priceUsd: NEWLY_BAKER.priceUsd,
        durationMinutes: NEWLY_BAKER.durationMinutes,
        category: NEWLY_BAKER.category,
        shortBlurb: "Hands-on pastry tutorial.",
        bookingAssistance: NEWLY_BAKER.bookingAssistance,
      },
    ],
    availabilitySlots: [
      ...makeSlots(AQUA_TECH.serviceId, AQUA_TECH.serviceName),
      ...makeSlots(NEWLY_BAKER.serviceId, NEWLY_BAKER.serviceName),
    ],
  }),

  // Multi-service named — Phase 3 path. Customer names both services in
  // one message → expects two tool calls + two booking suggestions.
  "multi-service-named": () => ({
    service: AQUA_TECH,
    customer: SAMPLE_CUSTOMER,
    shop: PEANUT_SHOP,
    conversationHistory: [],
    siblingServices: [],
    shopServiceMenu: [
      {
        serviceId: NEWLY_BAKER.serviceId,
        serviceName: NEWLY_BAKER.serviceName,
        priceUsd: NEWLY_BAKER.priceUsd,
        durationMinutes: NEWLY_BAKER.durationMinutes,
        category: NEWLY_BAKER.category,
        shortBlurb: "Hands-on pastry tutorial.",
        bookingAssistance: NEWLY_BAKER.bookingAssistance,
      },
    ],
    availabilitySlots: [
      ...makeSlots(AQUA_TECH.serviceId, AQUA_TECH.serviceName),
      ...makeSlots(NEWLY_BAKER.serviceId, NEWLY_BAKER.serviceName),
    ],
  }),

  // Describe-only handoff — AQua Tech is anchored but its
  // ai_booking_assistance is OFF. Safety net should kick in and hand off
  // to a teammate rather than stall or invent a slot.
  "describe-only-handoff": () => ({
    service: { ...AQUA_TECH, bookingAssistance: false },
    customer: SAMPLE_CUSTOMER,
    shop: PEANUT_SHOP,
    conversationHistory: [],
    siblingServices: [],
    shopServiceMenu: [
      {
        serviceId: NEWLY_BAKER.serviceId,
        serviceName: NEWLY_BAKER.serviceName,
        priceUsd: NEWLY_BAKER.priceUsd,
        durationMinutes: NEWLY_BAKER.durationMinutes,
        category: NEWLY_BAKER.category,
        shortBlurb: "Hands-on pastry tutorial.",
        bookingAssistance: NEWLY_BAKER.bookingAssistance,
      },
    ],
    availabilitySlots: [], // No slots — describe-only mode
  }),

  // Staging-bug reproduction: I Robot anchored, BUT conversation history
  // is heavy with Newly Baker turns (where the customer earlier asked
  // "what's the price?" and got "Newly Baker is $99"). When the customer
  // now asks "what is the price?" without naming a service, Claude
  // historically pulled the Newly Baker answer instead of I Robot. Rule
  // #13's widening + the orchestrator's active-topic reminder injection
  // are designed to fix this.
  "i-robot-after-newly-baker-history": () => ({
    service: I_ROBOT,
    customer: SAMPLE_CUSTOMER,
    shop: PEANUT_SHOP,
    conversationHistory: [
      { role: "user", content: "what is your service cost?", createdAt: new Date() },
      { role: "assistant", content: "The Newly Baker session is $99.00. Want to go ahead and book a slot on Thursday, May 14?", createdAt: new Date() },
      { role: "user", content: "what's included in newly baker?", createdAt: new Date() },
      { role: "assistant", content: "Newly Baker is a hands-on pastry tutorial — all ingredients, tools, and aprons are included for a one-on-one session with our chef. Sessions run about 45 minutes.", createdAt: new Date() },
      { role: "user", content: "are pets okay nearby?", createdAt: new Date() },
      { role: "assistant", content: "Sessions are one-on-one with the chef. We don't host pets in the kitchen area for safety.", createdAt: new Date() },
      { role: "user", content: "what's this week's recipe?", createdAt: new Date() },
      { role: "assistant", content: "Croissants this week — buttery, flaky, the works!", createdAt: new Date() },
      { role: "user", content: "Hi! I'm interested in your service \"I Robot\". 📍 Service: I Robot 💰 Price: $699.99 📂 Category: Tech & IT Services. Could you provide more details?", createdAt: new Date() },
      { role: "assistant", content: "I Robot is a hands-on robot-building session — you leave with a working bot the same day. Let me know what you'd like to know!", createdAt: new Date() },
    ],
    siblingServices: [],
    shopServiceMenu: [
      {
        serviceId: AQUA_TECH.serviceId,
        serviceName: AQUA_TECH.serviceName,
        priceUsd: AQUA_TECH.priceUsd,
        durationMinutes: AQUA_TECH.durationMinutes,
        category: AQUA_TECH.category,
        shortBlurb: "Laptop diagnostic and repair.",
        bookingAssistance: AQUA_TECH.bookingAssistance,
      },
      {
        serviceId: NEWLY_BAKER.serviceId,
        serviceName: NEWLY_BAKER.serviceName,
        priceUsd: NEWLY_BAKER.priceUsd,
        durationMinutes: NEWLY_BAKER.durationMinutes,
        category: NEWLY_BAKER.category,
        shortBlurb: "Hands-on pastry tutorial.",
        bookingAssistance: NEWLY_BAKER.bookingAssistance,
      },
    ],
    availabilitySlots: makeSlots(I_ROBOT.serviceId, I_ROBOT.serviceName),
  }),

  // I Robot with the 7 seeded FAQ entries (mirrors live staging). Lets
  // the local script exercise the production FAQ rendering path
  // (PromptTemplates.buildFaqBlock) end-to-end without hitting the DB.
  // Pair with --message="what comes in the kit?" etc. to see Claude
  // quote from the FAQ.
  "i-robot-faq-live": () => ({
    service: I_ROBOT,
    customer: SAMPLE_CUSTOMER,
    shop: PEANUT_SHOP,
    conversationHistory: [],
    siblingServices: [],
    shopServiceMenu: [
      {
        serviceId: AQUA_TECH.serviceId,
        serviceName: AQUA_TECH.serviceName,
        priceUsd: AQUA_TECH.priceUsd,
        durationMinutes: AQUA_TECH.durationMinutes,
        category: AQUA_TECH.category,
        shortBlurb: "Laptop diagnostic and repair.",
        bookingAssistance: AQUA_TECH.bookingAssistance,
      },
      {
        serviceId: NEWLY_BAKER.serviceId,
        serviceName: NEWLY_BAKER.serviceName,
        priceUsd: NEWLY_BAKER.priceUsd,
        durationMinutes: NEWLY_BAKER.durationMinutes,
        category: NEWLY_BAKER.category,
        shortBlurb: "Hands-on pastry tutorial.",
        bookingAssistance: NEWLY_BAKER.bookingAssistance,
      },
    ],
    availabilitySlots: makeSlots(I_ROBOT.serviceId, I_ROBOT.serviceName),
  }),
};

// ============================================================================
// Mock repositories — replace the DB layer so we can run without persistence
// ============================================================================

interface MockRepos {
  serviceRepo: any;
  messageRepo: any;
  contextBuilder: any;
  spendCapEnforcer: any;
  escalationDetector: any;
  auditLogger: any;
  pool: any;
  /** Inspect after orch.handleCustomerMessage to see what would have been saved */
  recordedCreateMessage: { last?: any };
  recordedAuditLog: { last?: any };
}

function makeMockRepos(ctx: AgentContext): MockRepos {
  const recordedCreateMessage: { last?: any } = {};
  const recordedAuditLog: { last?: any } = {};

  const serviceRepo = {
    getServiceById: async (id: string) => {
      // Return a service row shape the orchestrator accepts (camelCase via
      // ServiceRepository mapping).
      return {
        serviceId: id,
        shopId: ctx.shop.shopId,
        serviceName: ctx.service.serviceName,
        description: ctx.service.description,
        priceUsd: ctx.service.priceUsd,
        durationMinutes: ctx.service.durationMinutes,
        category: ctx.service.category,
        aiSalesEnabled: true,
        aiTone: "professional",
        aiSuggestUpsells: ctx.service.suggestUpsells,
        aiBookingAssistance: ctx.service.bookingAssistance,
        active: true,
      };
    },
  };

  const messageRepo = {
    createMessage: async (input: any) => {
      recordedCreateMessage.last = input;
      return {
        message: {
          messageId: input.messageId ?? "msg_local_test_ai_reply",
          ...input,
        },
      };
    },
    getConversationMessages: async () => ({
      items: ctx.conversationHistory.map((m, i) => ({
        messageId: `msg_history_${i}`,
        conversationId: "conv_local_test",
        senderType: m.role === "user" ? "customer" : "shop",
        messageText: m.content,
        createdAt: m.createdAt,
      })),
      pagination: {
        page: 1,
        limit: 20,
        totalItems: ctx.conversationHistory.length,
        totalPages: 1,
      },
    }),
  };

  const contextBuilder = {
    build: async () => ctx,
  };

  const spendCapEnforcer = {
    canSpend: async () => ({
      allowed: true,
      useCheaperModel: false,
      currentSpendUsd: 0,
      monthlyBudgetUsd: 100,
      percentUsed: 0,
    }),
    recordSpend: async () => {},
  };

  const escalationDetector = {
    shouldEscalate: () => ({ shouldEscalate: false }),
  };

  const auditLogger = {
    log: async (input: any) => {
      recordedAuditLog.last = input;
    },
  };

  // Pool only used for ai_shop_settings lookup in the orchestrator.
  const pool = {
    query: async (sql: string) => {
      if (sql.includes("ai_shop_settings")) {
        return {
          rows: [
            { ai_global_enabled: true, escalation_threshold: 5 },
          ],
        };
      }
      return { rows: [] };
    },
  };

  return {
    serviceRepo,
    messageRepo,
    contextBuilder,
    spendCapEnforcer,
    escalationDetector,
    auditLogger,
    pool,
    recordedCreateMessage,
    recordedAuditLog,
  };
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      "[error] ANTHROPIC_API_KEY not set. Add it to backend/.env and retry."
    );
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));
  const scenarioBuilder = SCENARIOS[args.scenario];
  if (!scenarioBuilder) {
    console.error(`[error] Unknown scenario: ${args.scenario}`);
    console.error(`Available scenarios: ${Object.keys(SCENARIOS).join(", ")}`);
    process.exit(1);
  }

  const ctx = scenarioBuilder();

  console.log("==================================================");
  console.log("Local prompt-iteration smoke test");
  console.log("==================================================");
  console.log("Scenario:", args.scenario);
  console.log("Customer message:", JSON.stringify(args.customerMessage));
  console.log("Tone:", args.tone);
  console.log("Anchor service:", `${ctx.service.serviceName} (${ctx.service.serviceId})`);
  console.log("Anchor booking assistance:", ctx.service.bookingAssistance);
  console.log("Menu services:", ctx.shopServiceMenu.map((m) => m.serviceName).join(", ") || "<none>");
  console.log("Slot count (pre-filter):", ctx.availabilitySlots.length);
  console.log("Conversation history depth:", ctx.conversationHistory.length, "messages");
  console.log("==================================================\n");

  if (args.showPrompt) {
    console.log("=== Rendered system prompt (pre-filter) ===\n");
    console.log(buildSystemPrompt(args.tone, ctx));
    console.log("\n=== End of system prompt ===\n");
  }

  // Build the orchestrator with mocked deps + a real Anthropic client.
  // The real handleCustomerMessage runs end-to-end: focused-default filter,
  // tool builder, multi-tool response handling, etc.
  const mocks = makeMockRepos(ctx);
  const realClient = new AnthropicClient();
  const orch = new AgentOrchestrator({
    pool: mocks.pool,
    serviceRepo: mocks.serviceRepo,
    messageRepo: mocks.messageRepo,
    anthropicClient: realClient,
    contextBuilder: mocks.contextBuilder,
    auditLogger: mocks.auditLogger,
    spendCapEnforcer: mocks.spendCapEnforcer,
    escalationDetector: mocks.escalationDetector,
  });

  const input: HandleCustomerMessageInput = {
    messageId: "msg_local_test_customer",
    conversationId: "conv_local_test",
    customerAddress: ctx.customer.address,
    shopId: ctx.shop.shopId,
    serviceId: ctx.service.serviceId,
    customerMessageText: args.customerMessage,
  };

  const start = Date.now();
  const result = await orch.handleCustomerMessage(input);
  const elapsedMs = Date.now() - start;

  console.log("\n=== Orchestrator outcome ===");
  console.log("outcome:", result.outcome);
  if (result.outcome === "ai_replied") {
    console.log("model:", result.model);
    console.log("cost:", `$${result.costUsd.toFixed(4)}`);
    console.log("latency:", `${result.latencyMs}ms`);
  } else if (result.outcome === "skipped") {
    console.log("reason:", result.reason);
  } else if (result.outcome === "escalated") {
    console.log("reason:", result.reason);
  } else if (result.outcome === "failed") {
    console.log("error:", result.error);
  }
  console.log("(local script wall time:", `${elapsedMs}ms`, ")");

  const created = mocks.recordedCreateMessage.last;
  if (created) {
    console.log("\n=== Customer-facing reply text ===");
    console.log(created.messageText);

    const suggestions = created.metadata?.booking_suggestions;
    if (Array.isArray(suggestions) && suggestions.length > 0) {
      console.log("\n=== Booking suggestions ===");
      for (const s of suggestions) {
        const svcLabel = s.serviceName ?? s.serviceId;
        const slotLabel = s.humanLabel ?? s.slotIso;
        const focusMark = s.serviceId === ctx.service.serviceId ? " ✓ (focused)" : " (non-focused)";
        console.log(`  - ${svcLabel}${focusMark}`);
        console.log(`    slot: ${slotLabel}`);
        console.log(`    serviceId: ${s.serviceId}`);
        console.log(`    slotIso: ${s.slotIso}`);
      }
    }

    const dropped = created.metadata?.booking_suggestion_dropped;
    if (Array.isArray(dropped) && dropped.length > 0) {
      console.log("\n=== Dropped tool calls (orchestrator validation) ===");
      for (const r of dropped) console.log(`  - ${r}`);
    }

    console.log("\n=== Metadata flags ===");
    console.log("generated_by:", created.metadata?.generated_by);
    console.log("model:", created.metadata?.model);
    console.log("cost_usd:", created.metadata?.cost_usd);
  }
}

main()
  .then(() => {
    // Force-exit: the shared DB pool from getSharedPool() and the Anthropic
    // SDK's keep-alive agent both keep the event loop alive after main()
    // returns. Without an explicit exit, the script hangs indefinitely.
    process.exit(0);
  })
  .catch((e) => {
    console.error("\n[fatal]", e);
    process.exit(1);
  });
