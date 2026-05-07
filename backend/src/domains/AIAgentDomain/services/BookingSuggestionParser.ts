// backend/src/domains/AIAgentDomain/services/BookingSuggestionParser.ts
//
// Phase 3 Task 10 — extract booking-suggestion JSON blocks from a Claude reply.
//
// The system prompt instructs Claude to end booking-relevant turns with a
// fenced JSON block:
//
//   ```booking_suggestion
//   { "service_id": "srv_...", "slot_iso": "2026-05-08T14:30:00+08:00" }
//   ```
//
// This module:
//   1. Finds every block in the reply text
//   2. Parses + validates each one (service_id matches, slot_iso is in the
//      validated set we sent the AI)
//   3. Strips the matched blocks from the customer-facing reply text
//   4. Returns valid suggestions for persistence on the message metadata
//
// Defense in depth: even if Claude hallucinates a slot or different service,
// validation drops the block silently. Worst case: reply reaches customer
// without a card. Never produces a card pointing at an unbookable slot.

import { logger } from "../../../utils/logger";
import { BookingSuggestion } from "../types";

/**
 * Match a fenced ```booking_suggestion ... ``` block. Greedy on the body but
 * non-greedy on the closing fence so multi-block replies (rare) all match.
 * `[\s\S]` instead of `.` so the body can span newlines without the `s` flag
 * (kept off for engine compatibility).
 */
const BLOCK_REGEX = /```booking_suggestion\s*([\s\S]*?)```/g;

export interface ParseInputs {
  /** The exact serviceId we sent to Claude — block must echo this verbatim */
  expectedServiceId: string;
  /** The slot_iso strings we listed in the prompt — block must echo one */
  validSlotsIso: string[];
  /** Optional human labels keyed by slot_iso, copied onto the suggestion for the frontend */
  slotLabelsByIso?: Record<string, string>;
}

export interface ParseResult {
  /** Reply text with all matched blocks (valid OR invalid) stripped */
  cleanText: string;
  /** Validated suggestions ready to persist to messages.metadata.booking_suggestions */
  suggestions: BookingSuggestion[];
  /**
   * Diagnostic counters — non-empty when the AI emitted blocks that failed
   * validation. Surfaced on `messages.metadata.booking_suggestion_dropped`
   * so we can see in the DB whether AI is emitting-but-rejected vs not
   * emitting at all (without needing log access). Phase 3 Task 10 fix.
   */
  droppedReasons: DropReason[];
}

export type DropReason =
  | "malformed_json"
  | "missing_service_id"
  | "wrong_service_id"
  | "missing_slot_iso"
  | "hallucinated_slot_iso"
  | "invalid_deposit";

/**
 * Parse a Claude reply for booking_suggestion blocks. Returns the cleaned
 * customer-facing text + the validated suggestions array (empty if none).
 *
 * Validation rules — drop block silently on any failure:
 *   - JSON.parse must succeed
 *   - service_id must equal expectedServiceId
 *   - slot_iso must be one of validSlotsIso (string equality after trim)
 *   - deposit_usd, if present, must be a non-negative finite number
 */
export function parseBookingSuggestions(
  text: string,
  inputs: ParseInputs
): ParseResult {
  const validSlotsSet = new Set(inputs.validSlotsIso);
  const suggestions: BookingSuggestion[] = [];
  const droppedReasons: DropReason[] = [];

  // First pass: find all blocks + collect valid suggestions
  const matches = Array.from(text.matchAll(BLOCK_REGEX));
  for (const match of matches) {
    const body = match[1].trim();
    const parsed = tryParseJson(body);
    if (!parsed) {
      logger.warn("BookingSuggestionParser: malformed JSON in block, dropping", {
        excerpt: body.slice(0, 80),
      });
      droppedReasons.push("malformed_json");
      continue;
    }
    const validation = validate(parsed, inputs.expectedServiceId, validSlotsSet);
    if (validation.ok === false) {
      logger.warn("BookingSuggestionParser: block failed validation, dropping", {
        parsed,
        reason: validation.reason,
      });
      droppedReasons.push(validation.reason);
      continue;
    }
    const validated = validation.suggestion;
    if (inputs.slotLabelsByIso?.[validated.slotIso]) {
      validated.humanLabel = inputs.slotLabelsByIso[validated.slotIso];
    }
    suggestions.push(validated);
  }

  // Second pass: strip ALL matched blocks (valid + invalid) so customers
  // never see the raw JSON. Replace the block + any trailing whitespace
  // surrounding it, then collapse the surrounding blank lines.
  const cleanText = text
    .replace(BLOCK_REGEX, "")
    // Collapse 3+ consecutive newlines to 2 (paragraph spacing) in case
    // stripping a block left an awkward gap.
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { cleanText, suggestions, droppedReasons };
}

function tryParseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

type ValidationResult =
  | { ok: true; suggestion: BookingSuggestion }
  | { ok: false; reason: DropReason };

function validate(
  parsed: unknown,
  expectedServiceId: string,
  validSlotsSet: Set<string>
): ValidationResult {
  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, reason: "malformed_json" };
  }
  const obj = parsed as Record<string, unknown>;

  const serviceId = obj.service_id;
  const slotIso = obj.slot_iso;
  const depositRaw = obj.deposit_usd;

  if (typeof serviceId !== "string") return { ok: false, reason: "missing_service_id" };
  if (serviceId !== expectedServiceId) return { ok: false, reason: "wrong_service_id" };

  if (typeof slotIso !== "string") return { ok: false, reason: "missing_slot_iso" };
  if (!validSlotsSet.has(slotIso.trim())) return { ok: false, reason: "hallucinated_slot_iso" };

  let depositUsd: number | undefined;
  if (depositRaw !== undefined && depositRaw !== null) {
    if (typeof depositRaw !== "number" || !Number.isFinite(depositRaw) || depositRaw < 0) {
      return { ok: false, reason: "invalid_deposit" };
    }
    depositUsd = depositRaw;
  }

  return {
    ok: true,
    suggestion: {
      serviceId,
      slotIso: slotIso.trim(),
      ...(depositUsd !== undefined ? { depositUsd } : {}),
    },
  };
}
