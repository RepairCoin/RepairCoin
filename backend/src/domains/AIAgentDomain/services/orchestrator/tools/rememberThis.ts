// backend/src/domains/AIAgentDomain/services/orchestrator/tools/rememberThis.ts
//
// Tool: remember_this
//
// Saves a STANDING preference/instruction/decision/correction the owner wants the
// assistant to honor across future conversations (AI Memory, Phase 1). It stores
// owner INTENT only — never facts the data tools can look up (revenue, stock,
// bookings); the AiMemoryService guards against obvious fact-like content.
// Gated by ENABLE_AI_MEMORY — when off, the tool isn't offered to the model and
// execute() saves nothing.

import {
  OrchestratorTool,
  OrchestratorToolContext,
  OrchestratorToolResult,
} from '../types';
import { getAiMemoryService } from '../../AiMemoryService';
import type { AiMemoryKind } from '../../../../../repositories/AiMemoryRepository';

const NAME = 'remember_this';
const KINDS: AiMemoryKind[] = ['preference', 'instruction', 'decision', 'correction'];

export const rememberThis: OrchestratorTool = {
  name: NAME,
  description:
    "Save a STANDING preference/instruction/decision/correction the owner wants " +
    "you to remember across FUTURE conversations — e.g. 'from now on…', 'always…', " +
    "'never…', 'when I say X I mean…', 'we decided…'. Use ONLY for durable owner " +
    "intent about how you should behave. Do NOT use it for facts you can look up " +
    "with a data tool (revenue, stock, bookings, balances) or for one-off requests. " +
    "After saving, briefly confirm it in your reply.",
  inputSchema: {
    type: 'object',
    properties: {
      kind: {
        type: 'string',
        enum: KINDS,
        description:
          "preference (style/tone), instruction (a standing rule for you), " +
          "decision (something the owner decided), or correction (fixing how you " +
          "interpret something).",
      },
      content: {
        type: 'string',
        description:
          "The durable intent in the owner's words, e.g. 'Never suggest discounts " +
          "in campaigns.' Keep it to one clear statement.",
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: "Optional keywords for later retrieval, e.g. ['campaigns','discounts'].",
      },
    },
    required: ['kind', 'content'],
    additionalProperties: false,
  },

  async execute(args: unknown, ctx: OrchestratorToolContext): Promise<OrchestratorToolResult> {
    const a = (args ?? {}) as { kind?: unknown; content?: unknown; tags?: unknown };
    const kind: AiMemoryKind =
      typeof a.kind === 'string' && (KINDS as string[]).includes(a.kind)
        ? (a.kind as AiMemoryKind)
        : 'preference';
    const content = typeof a.content === 'string' ? a.content.trim() : '';
    const tags = Array.isArray(a.tags)
      ? a.tags.filter((t): t is string => typeof t === 'string')
      : [];

    if (!content) return { data: { saved: false, reason: 'empty' } };

    const result = await getAiMemoryService().remember(ctx.shopId, {
      kind,
      content,
      tags,
      source: 'explicit',
    });

    return {
      data: { saved: result.saved, reason: result.reason ?? null, kind, content },
      ...(result.saved
        ? { display: { kind: 'memory_saved' as const, content, memoryKind: kind } }
        : {}),
    };
  },
};
