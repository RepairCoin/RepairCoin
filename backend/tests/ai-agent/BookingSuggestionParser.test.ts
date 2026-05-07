// backend/tests/ai-agent/BookingSuggestionParser.test.ts
//
// Unit tests for the booking_suggestion JSON-block extractor (Phase 3 Task 10).
// Covers the happy path + every kind of malformed/spoofed block we expect to
// see (or for safety reasons, MUST not trust) in production.

import { parseBookingSuggestions } from "../../src/domains/AIAgentDomain/services/BookingSuggestionParser";

const SERVICE_ID = "srv_test_123";
const VALID_SLOTS = [
  "2026-05-08T14:30:00.000Z",
  "2026-05-08T15:30:00.000Z",
  "2026-05-09T11:00:00.000Z",
];
const SLOT_LABELS = {
  "2026-05-08T14:30:00.000Z": "Thursday, May 8 at 2:30 PM",
  "2026-05-08T15:30:00.000Z": "Thursday, May 8 at 3:30 PM",
  "2026-05-09T11:00:00.000Z": "Friday, May 9 at 11:00 AM",
};

const baseInputs = () => ({
  expectedServiceId: SERVICE_ID,
  validSlotsIso: [...VALID_SLOTS],
  slotLabelsByIso: { ...SLOT_LABELS },
});

describe("BookingSuggestionParser — happy path", () => {
  it("extracts a valid block + strips it from the visible text + attaches the human label", () => {
    const text = `How does Thursday at 2:30 PM sound?

\`\`\`booking_suggestion
{ "service_id": "srv_test_123", "slot_iso": "2026-05-08T14:30:00.000Z" }
\`\`\``;
    const { cleanText, suggestions } = parseBookingSuggestions(text, baseInputs());

    expect(cleanText).toBe("How does Thursday at 2:30 PM sound?");
    expect(suggestions).toEqual([
      {
        serviceId: "srv_test_123",
        slotIso: "2026-05-08T14:30:00.000Z",
        humanLabel: "Thursday, May 8 at 2:30 PM",
      },
    ]);
  });

  it("preserves the surrounding text when the block is in the middle", () => {
    const text = `Sure, here is your slot:
\`\`\`booking_suggestion
{ "service_id": "srv_test_123", "slot_iso": "2026-05-09T11:00:00.000Z" }
\`\`\`
Let me know if it works!`;
    const { cleanText, suggestions } = parseBookingSuggestions(text, baseInputs());

    expect(cleanText).toBe("Sure, here is your slot:\n\nLet me know if it works!");
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].slotIso).toBe("2026-05-09T11:00:00.000Z");
  });

  it("accepts an optional deposit_usd when non-negative number", () => {
    const text = `\`\`\`booking_suggestion
{ "service_id": "srv_test_123", "slot_iso": "2026-05-08T14:30:00.000Z", "deposit_usd": 25 }
\`\`\``;
    const { suggestions } = parseBookingSuggestions(text, baseInputs());
    expect(suggestions[0].depositUsd).toBe(25);
  });

  it("returns empty suggestions when no block is present", () => {
    const text = `Sure, what time works for you?`;
    const { cleanText, suggestions } = parseBookingSuggestions(text, baseInputs());
    expect(cleanText).toBe("Sure, what time works for you?");
    expect(suggestions).toEqual([]);
  });

  it("handles a reply that is just the block with no surrounding text", () => {
    const text = `\`\`\`booking_suggestion
{ "service_id": "srv_test_123", "slot_iso": "2026-05-08T14:30:00.000Z" }
\`\`\``;
    const { cleanText, suggestions } = parseBookingSuggestions(text, baseInputs());
    expect(cleanText).toBe("");
    expect(suggestions).toHaveLength(1);
  });
});

describe("BookingSuggestionParser — invalid blocks dropped", () => {
  it("drops a block with malformed JSON but still strips it from the text", () => {
    const text = `Here is a slot:
\`\`\`booking_suggestion
{ service_id: srv_test_123, slot_iso: missing-quotes }
\`\`\`
Tap below.`;
    const { cleanText, suggestions } = parseBookingSuggestions(text, baseInputs());

    expect(suggestions).toEqual([]);
    expect(cleanText).not.toContain("booking_suggestion");
    expect(cleanText).not.toContain("missing-quotes");
    expect(cleanText).toContain("Tap below");
  });

  it("drops a block whose service_id does not match expected", () => {
    const text = `\`\`\`booking_suggestion
{ "service_id": "srv_OTHER_shop", "slot_iso": "2026-05-08T14:30:00.000Z" }
\`\`\``;
    const { suggestions } = parseBookingSuggestions(text, baseInputs());
    expect(suggestions).toEqual([]);
  });

  it("drops a block whose slot_iso is not in the validated set (hallucinated slot)", () => {
    const text = `\`\`\`booking_suggestion
{ "service_id": "srv_test_123", "slot_iso": "2026-05-12T20:00:00.000Z" }
\`\`\``;
    const { suggestions } = parseBookingSuggestions(text, baseInputs());
    expect(suggestions).toEqual([]);
  });

  it("drops a block whose deposit_usd is negative", () => {
    const text = `\`\`\`booking_suggestion
{ "service_id": "srv_test_123", "slot_iso": "2026-05-08T14:30:00.000Z", "deposit_usd": -50 }
\`\`\``;
    const { suggestions } = parseBookingSuggestions(text, baseInputs());
    expect(suggestions).toEqual([]);
  });

  it("drops a block whose deposit_usd is a non-number", () => {
    const text = `\`\`\`booking_suggestion
{ "service_id": "srv_test_123", "slot_iso": "2026-05-08T14:30:00.000Z", "deposit_usd": "free" }
\`\`\``;
    const { suggestions } = parseBookingSuggestions(text, baseInputs());
    expect(suggestions).toEqual([]);
  });

  it("drops a block missing required fields", () => {
    const text = `\`\`\`booking_suggestion
{ "slot_iso": "2026-05-08T14:30:00.000Z" }
\`\`\``;
    const { suggestions } = parseBookingSuggestions(text, baseInputs());
    expect(suggestions).toEqual([]);
  });
});

describe("BookingSuggestionParser — multiple blocks", () => {
  it("extracts all valid blocks; drops invalid ones; strips both", () => {
    const text = `Two ideas:
\`\`\`booking_suggestion
{ "service_id": "srv_test_123", "slot_iso": "2026-05-08T14:30:00.000Z" }
\`\`\`
or
\`\`\`booking_suggestion
{ "service_id": "srv_OTHER", "slot_iso": "2026-05-09T11:00:00.000Z" }
\`\`\`
Pick one.`;
    const { cleanText, suggestions } = parseBookingSuggestions(text, baseInputs());

    // Only the first (valid) one survives
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].slotIso).toBe("2026-05-08T14:30:00.000Z");

    // Both blocks gone from the visible text
    expect(cleanText).not.toContain("booking_suggestion");
    expect(cleanText).toContain("Two ideas:");
    expect(cleanText).toContain("Pick one");
  });
});

describe("BookingSuggestionParser — slot label fallback", () => {
  it("omits humanLabel when slotLabelsByIso doesn't include the slot", () => {
    const text = `\`\`\`booking_suggestion
{ "service_id": "srv_test_123", "slot_iso": "2026-05-08T14:30:00.000Z" }
\`\`\``;
    const { suggestions } = parseBookingSuggestions(text, {
      expectedServiceId: SERVICE_ID,
      validSlotsIso: VALID_SLOTS,
      // No slotLabelsByIso
    });
    expect(suggestions[0].serviceId).toBe("srv_test_123");
    expect(suggestions[0].humanLabel).toBeUndefined();
  });
});
