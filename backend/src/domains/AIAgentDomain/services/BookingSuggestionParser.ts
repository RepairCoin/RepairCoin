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
}

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

  // First pass: find all blocks + collect valid suggestions
  const matches = Array.from(text.matchAll(BLOCK_REGEX));
  for (const match of matches) {
    const body = match[1].trim();
    const parsed = tryParseJson(body);
    if (!parsed) {
      logger.warn("BookingSuggestionParser: malformed JSON in block, dropping", {
        excerpt: body.slice(0, 80),
      });
      continue;
    }
    const validated = validate(parsed, inputs.expectedServiceId, validSlotsSet);
    if (!validated) {
      logger.warn("BookingSuggestionParser: block failed validation, dropping", {
        parsed,
      });
      continue;
    }
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

  return { cleanText, suggestions };
}

function tryParseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function validate(
  parsed: unknown,
  expectedServiceId: string,
  validSlotsSet: Set<string>
): BookingSuggestion | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;

  const serviceId = obj.service_id;
  const slotIso = obj.slot_iso;
  const depositRaw = obj.deposit_usd;

  if (typeof serviceId !== "string" || serviceId !== expectedServiceId) return null;
  if (typeof slotIso !== "string" || !validSlotsSet.has(slotIso.trim())) return null;

  let depositUsd: number | undefined;
  if (depositRaw !== undefined && depositRaw !== null) {
    if (typeof depositRaw !== "number" || !Number.isFinite(depositRaw) || depositRaw < 0) {
      return null;
    }
    depositUsd = depositRaw;
  }

  return {
    serviceId,
    slotIso: slotIso.trim(),
    ...(depositUsd !== undefined ? { depositUsd } : {}),
  };
}
