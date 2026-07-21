// backend/src/domains/AIAgentDomain/services/voice/VoiceRouter.ts
//
// Cross-domain router for the Voice AI Dispatcher (Phase 3). Calls Haiku
// 4.5 with a cache-friendly system prompt and parses the response into
// one of the four domain labels.
//
// Design notes:
//   - Model is hardcoded to Haiku 4.5 — routing is a 4-way classification,
//     Sonnet is overkill (~10x more expensive, no accuracy gain on this
//     task per the scope-doc decision).
//   - Cache control: the system prompt is the same for every shop, every
//     call, every day. Marking it ephemeral hits Anthropic's prompt cache
//     for ~91% input-token savings after the first request in a 5-min
//     window.
//   - Max output tokens: 16. The expected output is a single label
//     (≤12 chars), so 16 leaves headroom for safety without inviting
//     verbose answers.

import { AnthropicClient } from "../AnthropicClient";
import { ClaudeModel } from "../../types";
import { cheapModel } from "../../../../config/aiModels";
import {
  parseRouterLabel,
  labelToDomain,
  VOICE_ROUTER_SYSTEM_PROMPT,
} from "./voiceRouterPrompt";

const ROUTER_MODEL: ClaudeModel = cheapModel();
const ROUTER_MAX_TOKENS = 16;
// Low temperature — we want deterministic classification, not creative
// reframing of the user's question.
const ROUTER_TEMPERATURE = 0;

export type RouterDomain = "insights" | "marketing" | "help" | "out_of_scope";

export interface RouterClassification {
  domain: RouterDomain;
  /** Raw text Haiku returned — useful for audit + tuning. */
  rawText: string;
  /** True when the raw text didn't parse to a known label (fell back to out_of_scope). */
  parseFailed: boolean;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
}

export interface VoiceRouterDeps {
  anthropic?: AnthropicClient;
}

export class VoiceRouter {
  private anthropic: AnthropicClient | null;

  constructor(deps: VoiceRouterDeps = {}) {
    // Defer construction so import-time errors (missing
    // ANTHROPIC_API_KEY) don't blow up unrelated tests / migrations.
    this.anthropic = deps.anthropic ?? null;
  }

  async classifyDomain(transcript: string): Promise<RouterClassification> {
    if (!this.anthropic) this.anthropic = new AnthropicClient();

    const response = await this.anthropic.complete({
      systemPrompt: [{ text: VOICE_ROUTER_SYSTEM_PROMPT, cache: true }],
      messages: [{ role: "user", content: transcript }],
      model: ROUTER_MODEL,
      maxTokens: ROUTER_MAX_TOKENS,
      temperature: ROUTER_TEMPERATURE,
    });

    const label = parseRouterLabel(response.text);
    const parseFailed = label === null;
    const domain: RouterDomain = label ? labelToDomain(label) : "out_of_scope";

    return {
      domain,
      rawText: response.text,
      parseFailed,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      costUsd: response.costUsd,
      latencyMs: response.latencyMs,
    };
  }
}

export const voiceRouter = new VoiceRouter();
