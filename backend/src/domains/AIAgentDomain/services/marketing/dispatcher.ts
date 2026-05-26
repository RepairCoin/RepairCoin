// backend/src/domains/AIAgentDomain/services/marketing/dispatcher.ts
//
// Dispatcher for marketing tools. Parallel to services/insights/dispatcher.ts
// — same shape, same never-throw contract. Kept separate so the marketing
// surface can iterate on its tool shape without affecting Insights audit
// queries.
//
// dispatchMarketingTool() validates args against the tool's inputSchema,
// times execute(), captures any throw, and returns a typed result. The
// controller loops over Anthropic's tool_use blocks and collects results
// for (a) building next-turn tool_result content and (b) the audit log's
// tool_calls JSONB column.
//
// Validation: Anthropic already validates `input` against `inputSchema`
// before surfacing tool_use blocks, but we revalidate here for tests +
// manual dev paths that bypass the SDK, and as a defense-in-depth so
// malformed payloads surface as ToolDispatchResult.error instead of a
// cryptic SQL or runtime failure inside execute().

import {
  MarketingTool,
  MarketingToolContext,
  MarketingToolDispatchResult,
} from "./types";

export async function dispatchMarketingTool(
  tool: MarketingTool,
  args: unknown,
  ctx: MarketingToolContext
): Promise<MarketingToolDispatchResult> {
  const startedAt = Date.now();

  const validation = validateAgainstSchema(args, tool.inputSchema);
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
// Minimal JSON Schema validator (same subset as insights/dispatcher.ts)
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
    if (typeof schema.minLength === "number" && value.length < schema.minLength) {
      return `'${key}' must be at least ${schema.minLength} chars`;
    }
    if (typeof schema.maxLength === "number" && value.length > schema.maxLength) {
      return `'${key}' must be at most ${schema.maxLength} chars`;
    }
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
  } else if (type === "object") {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return `'${key}' must be an object`;
    }
  } else if (type === "array") {
    if (!Array.isArray(value)) return `'${key}' must be an array`;
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
