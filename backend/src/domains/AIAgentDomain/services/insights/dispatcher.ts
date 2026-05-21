// backend/src/domains/AIAgentDomain/services/insights/dispatcher.ts
//
// Central dispatch helper. Takes a BusinessInsightsTool the controller
// just resolved (via getInsightsToolByName) plus the args Claude
// supplied, validates the args, times the execute() call, captures
// any throw, and returns a typed ToolDispatchResult.
//
// dispatchTool() never throws — the controller loops over Anthropic's
// tool_use blocks and collects ToolDispatchResults for (a) building
// next-turn tool_result content + (b) the audit log's tool_calls JSONB.
//
// Validation: Anthropic already validates `input` against `inputSchema`
// before surfacing the tool_use block (see AgentOrchestrator's comment
// near BOOKING_TOOL_NAME). The dispatcher revalidates for two reasons:
//   1. Tests + manual dev paths call dispatchTool directly with
//      synthesized args — they bypass Anthropic's check.
//   2. Defense in depth — cheap to do, surfaces malformed payloads
//      with a clear ToolDispatchResult.error instead of a cryptic SQL
//      failure deep inside execute().
//
// The bundled validator covers the JSON Schema subset our 5 v1 tools
// actually use (object root, required, properties.{type, enum,
// minimum, maximum}, additionalProperties:false). Swap in AJV behind
// the same dispatchTool signature if we outgrow it.

import {
  BusinessInsightsTool,
  ToolContext,
  ToolDispatchResult,
} from "./types";

export async function dispatchTool(
  tool: BusinessInsightsTool,
  args: unknown,
  ctx: ToolContext
): Promise<ToolDispatchResult> {
  const startedAt = Date.now();

  const validation = validateAgainstSchema(args, tool.inputSchema);
  // `strict: false` in tsconfig means TS doesn't narrow on
  // `!validation.ok` — use `in` narrowing which works under
  // non-strict mode.
  if ("error" in validation) {
    return {
      ok: false,
      tool: tool.name,
      args: coerceArgsForAudit(args),
      error: `args validation failed: ${validation.error}`,
      latencyMs: Date.now() - startedAt,
    };
  }

  try {
    const result = await tool.execute(args, ctx);
    return {
      ok: true,
      tool: tool.name,
      args: validation.args,
      result,
      latencyMs: Date.now() - startedAt,
    };
  } catch (err) {
    return {
      ok: false,
      tool: tool.name,
      args: validation.args,
      error: err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - startedAt,
    };
  }
}

// ---------------------------------------------------------------------
// Minimal JSON Schema validator
// ---------------------------------------------------------------------

type ValidationResult =
  | { ok: true; args: Record<string, unknown> }
  | { ok: false; error: string };

function validateAgainstSchema(
  args: unknown,
  schema: Record<string, unknown>
): ValidationResult {
  if (args === null || typeof args !== "object" || Array.isArray(args)) {
    return { ok: false, error: "args must be an object" };
  }
  const argsObj = args as Record<string, unknown>;

  const required = Array.isArray(schema.required)
    ? (schema.required as string[])
    : [];
  for (const key of required) {
    if (!(key in argsObj)) {
      return { ok: false, error: `missing required field '${key}'` };
    }
  }

  const properties =
    (schema.properties as
      | Record<string, Record<string, unknown>>
      | undefined) ?? {};
  const additionalAllowed = schema.additionalProperties !== false;

  for (const key of Object.keys(argsObj)) {
    const propSchema = properties[key];
    if (!propSchema) {
      if (!additionalAllowed) {
        return { ok: false, error: `unknown field '${key}'` };
      }
      continue;
    }
    const err = validateProperty(key, argsObj[key], propSchema);
    if (err) return { ok: false, error: err };
  }
  return { ok: true, args: argsObj };
}

function validateProperty(
  key: string,
  value: unknown,
  schema: Record<string, unknown>
): string | null {
  const type = schema.type;
  if (type === "string") {
    if (typeof value !== "string") return `'${key}' must be a string`;
  } else if (type === "integer") {
    if (typeof value !== "number" || !Number.isInteger(value)) {
      return `'${key}' must be an integer`;
    }
    if (typeof schema.minimum === "number" && value < schema.minimum) {
      return `'${key}' must be >= ${schema.minimum}`;
    }
    if (typeof schema.maximum === "number" && value > schema.maximum) {
      return `'${key}' must be <= ${schema.maximum}`;
    }
  } else if (type === "number") {
    if (typeof value !== "number") return `'${key}' must be a number`;
  } else if (type === "boolean") {
    if (typeof value !== "boolean") return `'${key}' must be a boolean`;
  }
  if (Array.isArray(schema.enum)) {
    if (!(schema.enum as unknown[]).includes(value)) {
      return `'${key}' must be one of ${JSON.stringify(schema.enum)}`;
    }
  }
  return null;
}

function coerceArgsForAudit(args: unknown): Record<string, unknown> {
  if (args && typeof args === "object" && !Array.isArray(args)) {
    return args as Record<string, unknown>;
  }
  return { _raw: args };
}
