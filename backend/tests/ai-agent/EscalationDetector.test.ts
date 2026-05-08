// backend/tests/ai-agent/EscalationDetector.test.ts
//
// Pure function — no mocks needed. Tests cover the three signals (phrase
// match, keyword match, consecutive-AI-replies threshold) plus false-positive
// guards (matchesWord, matchesAtStart) so we don't escalate on common
// substrings.

import { EscalationDetector } from "../../src/domains/AIAgentDomain/services/EscalationDetector";
import { AgentMessageContext } from "../../src/domains/AIAgentDomain/types";

const detector = new EscalationDetector();

const msg = (role: "user" | "assistant", content: string): AgentMessageContext => ({
  role,
  content,
  createdAt: new Date(),
});

describe("EscalationDetector — phrase matches", () => {
  it.each([
    "I want a human",
    "Can I talk to a human?",
    "talk to a real person please",
    "stop the bot",
    "GET ME A HUMAN", // case insensitive
  ])("escalates on phrase: %s", (text) => {
    const result = detector.shouldEscalate(text, []);
    expect(result.shouldEscalate).toBe(true);
    expect(result.reason).toMatch(/customer_requested_human/);
  });
});

describe("EscalationDetector — AI-disclosure questions are NOT escalations", () => {
  // Per Option B (added 2026-05-08): when the customer asks whether they're
  // talking to an AI / bot / real person, the AI should ANSWER honestly via
  // the prompt's universal rule #9 instead of going silent. These were
  // previously in HUMAN_HANDOFF_PHRASES and silently escalated, leaving the
  // customer with no acknowledgement.
  it.each([
    "are you a bot?",
    "is this a bot",
    "Are you human?",
    "are you a real person?",
    "am I talking to human or AI?",
    "is this an AI?",
    "talking to a bot or a human?",
    "ai or human?",
    "Are you AI?",
  ])("does NOT escalate on disclosure question: %s", (text) => {
    const result = detector.shouldEscalate(text, []);
    expect(result.shouldEscalate).toBe(false);
  });

  it("isAIDisclosureQuestion returns true for known disclosure phrasings", () => {
    expect(detector.isAIDisclosureQuestion("are you a bot?")).toBe(true);
    expect(detector.isAIDisclosureQuestion("ARE YOU HUMAN")).toBe(true);
    expect(detector.isAIDisclosureQuestion("am I talking to a real person?")).toBe(true);
    expect(detector.isAIDisclosureQuestion("ai or human?")).toBe(true);
  });

  it("isAIDisclosureQuestion returns false for normal questions", () => {
    expect(detector.isAIDisclosureQuestion("what are your hours?")).toBe(false);
    expect(detector.isAIDisclosureQuestion("how much does this cost?")).toBe(false);
    expect(detector.isAIDisclosureQuestion("can I book an appointment?")).toBe(false);
  });

  it("disclosure check beats handoff phrase containment", () => {
    // "are you a real person" CONTAINS "real person" (a handoff phrase).
    // The disclosure check must run first so this is treated as a question
    // and answered, not silently escalated.
    expect(detector.shouldEscalate("are you a real person?", []).shouldEscalate).toBe(false);
    // But a clear handoff request that contains the same substring should
    // still escalate — disclosure phrases are anchored ("ARE YOU a real
    // person"), so "talk to a real person please" doesn't match disclosure
    // and falls through to phrase-match → escalate.
    expect(detector.shouldEscalate("talk to a real person please", []).shouldEscalate).toBe(true);
  });
});

describe("EscalationDetector — single keyword (word-boundary)", () => {
  it.each([
    "Just put me with a human", // "human" alone
    "Get me an agent",
    "I want to speak with the manager",
    "Where's the owner?",
    "Human?",
  ])("escalates on word: %s", (text) => {
    expect(detector.shouldEscalate(text, []).shouldEscalate).toBe(true);
  });

  it.each([
    "humanitarian crisis", // "human" embedded in another word
    "agency relationship", // "agent" embedded
    "managerial accounting", // "manager" embedded
    "ownership transfer", // "owner" embedded
  ])("does NOT escalate on substring: %s", (text) => {
    expect(detector.shouldEscalate(text, []).shouldEscalate).toBe(false);
  });
});

describe("EscalationDetector — stop/cancel keywords", () => {
  it("escalates when 'stop' is at start of message", () => {
    expect(detector.shouldEscalate("stop", []).shouldEscalate).toBe(true);
    expect(detector.shouldEscalate("Stop. I want a human.", []).shouldEscalate).toBe(true);
    expect(detector.shouldEscalate("stop please", []).shouldEscalate).toBe(true);
  });

  it("does NOT escalate when 'stop' is buried mid-sentence", () => {
    expect(
      detector.shouldEscalate("I want the auto-stop feature on my car", []).shouldEscalate
    ).toBe(false);
    expect(
      detector.shouldEscalate("This stops working sometimes — can you fix it?", []).shouldEscalate
    ).toBe(false);
  });

  it("escalates on 'cancel' at start", () => {
    expect(detector.shouldEscalate("cancel my booking", []).shouldEscalate).toBe(true);
  });
});

describe("EscalationDetector — reply-count threshold", () => {
  const customerMsg = msg("user", "Just curious about your hours");

  it("does NOT escalate when below threshold", () => {
    const history = [
      msg("user", "Hi"),
      msg("assistant", "Hi! How can I help?"),
      msg("user", "What's the price?"),
      msg("assistant", "$89."),
    ];
    expect(detector.shouldEscalate(customerMsg.content, history, 5).shouldEscalate).toBe(false);
  });

  it("escalates when 5 consecutive AI replies precede the customer message (default threshold)", () => {
    const history = [
      msg("user", "Initial question"),
      msg("assistant", "ai 1"),
      msg("assistant", "ai 2"),
      msg("assistant", "ai 3"),
      msg("assistant", "ai 4"),
      msg("assistant", "ai 5"),
    ];
    const result = detector.shouldEscalate(customerMsg.content, history, 5);
    expect(result.shouldEscalate).toBe(true);
    expect(result.reason).toMatch(/consecutive_ai_replies:5/);
  });

  it("respects custom threshold (3)", () => {
    const history = [
      msg("user", "Question"),
      msg("assistant", "reply 1"),
      msg("assistant", "reply 2"),
      msg("assistant", "reply 3"),
    ];
    expect(detector.shouldEscalate(customerMsg.content, history, 3).shouldEscalate).toBe(true);
  });

  it("counter resets on encountering a user message", () => {
    const history = [
      msg("assistant", "ai 1"),
      msg("assistant", "ai 2"),
      msg("user", "interjection"), // resets the count
      msg("assistant", "ai 3"), // only 1 trailing assistant
    ];
    expect(detector.shouldEscalate(customerMsg.content, history, 3).shouldEscalate).toBe(false);
  });
});

describe("EscalationDetector — happy path (no escalation)", () => {
  it.each([
    "What's your price?",
    "Can you fix my screen?",
    "Awesome, sounds good — let's book it.",
    "What time can you do it tomorrow?",
    "Do you take credit cards?",
  ])("does NOT escalate on benign customer message: %s", (text) => {
    expect(detector.shouldEscalate(text, []).shouldEscalate).toBe(false);
  });
});
