// backend/tests/ai-agent/AnthropicClient.test.ts
//
// Unit tests for AnthropicClient. Mocks the SDK so no real API calls fire.
// Verifies:
//   - Cost calculation across models + cache breakdown
//   - Retry behavior on 429 + 5xx (with exponential backoff)
//   - Non-retryable 4xx surfaces immediately
//   - Prompt-cache control headers attached when cache=true
//
// Use `npm run test -- ai-agent/AnthropicClient` to run just this file.

// Mock the Anthropic SDK BEFORE importing the client. Jest hoists this.
const mockCreate = jest.fn();
jest.mock("@anthropic-ai/sdk", () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }));
});

import { AnthropicClient } from "../../src/domains/AIAgentDomain/services/AnthropicClient";
import {
  AnthropicCallOptions,
  ResponseUsage,
} from "../../src/domains/AIAgentDomain/types";

const ORIGINAL_ENV = process.env.ANTHROPIC_API_KEY;

beforeAll(() => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-real";
});

afterAll(() => {
  if (ORIGINAL_ENV !== undefined) {
    process.env.ANTHROPIC_API_KEY = ORIGINAL_ENV;
  } else {
    delete process.env.ANTHROPIC_API_KEY;
  }
});

beforeEach(() => {
  mockCreate.mockReset();
  jest.useRealTimers();
});

const sampleResponse = (overrides: Partial<any> = {}) => ({
  id: "msg_xxx",
  model: "claude-sonnet-4-6",
  stop_reason: "end_turn",
  content: [{ type: "text", text: "Hello there!" }],
  usage: {
    input_tokens: 100,
    output_tokens: 50,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  },
  ...overrides,
});

const sampleOptions = (
  overrides: Partial<AnthropicCallOptions> = {}
): AnthropicCallOptions => ({
  systemPrompt: [{ text: "You are a helpful assistant.", cache: true }],
  messages: [{ role: "user", content: "Hi" }],
  model: "claude-sonnet-4-6",
  ...overrides,
});

describe("AnthropicClient.calculateCost", () => {
  it("computes Sonnet cost with no cache", () => {
    const usage: ResponseUsage = {
      inputTokens: 1_000_000, // 1M input
      outputTokens: 1_000_000, // 1M output
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    };
    const cost = AnthropicClient.calculateCost(usage, "claude-sonnet-4-6");
    // 1M input * $3 + 1M output * $15 = $18
    expect(cost).toBeCloseTo(18.0, 5);
  });

  it("computes Haiku cost much lower than Sonnet", () => {
    const usage: ResponseUsage = {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    };
    const sonnetCost = AnthropicClient.calculateCost(usage, "claude-sonnet-4-6");
    const haikuCost = AnthropicClient.calculateCost(
      usage,
      "claude-haiku-4-5-20251001"
    );
    expect(haikuCost).toBeLessThan(sonnetCost);
    // Haiku: 1M * $0.80 + 1M * $4 = $4.80
    expect(haikuCost).toBeCloseTo(4.8, 5);
  });

  it("includes cache_write at higher rate than regular input", () => {
    const usage: ResponseUsage = {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationInputTokens: 1_000_000, // 1M cache-write
      cacheReadInputTokens: 0,
    };
    const cost = AnthropicClient.calculateCost(usage, "claude-sonnet-4-6");
    // 1M * $3.75 = $3.75
    expect(cost).toBeCloseTo(3.75, 5);
  });

  it("includes cache_read at much lower rate than regular input", () => {
    const usage: ResponseUsage = {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 1_000_000, // 1M cache-read
    };
    const cost = AnthropicClient.calculateCost(usage, "claude-sonnet-4-6");
    // 1M * $0.30 = $0.30
    expect(cost).toBeCloseTo(0.3, 5);
  });

  it("returns 0 (and warns) for an unknown model", () => {
    const usage: ResponseUsage = {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    };
    // Cast — calculateCost accepts any string at runtime even though TS narrows to ClaudeModel
    const cost = AnthropicClient.calculateCost(usage, "unknown-model" as any);
    expect(cost).toBe(0);
  });

  it("realistic 5K cached + 600 output Sonnet call costs ~$0.018", () => {
    // Mirrors strategy doc cost-model assumption
    const usage: ResponseUsage = {
      inputTokens: 3000, // fresh per-request context
      outputTokens: 600,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 5000, // cached system prompt + service catalog
    };
    const cost = AnthropicClient.calculateCost(usage, "claude-sonnet-4-6");
    // 3K * $3/M + 600 * $15/M + 5K * $0.30/M = $0.009 + $0.009 + $0.0015 = $0.0195
    expect(cost).toBeGreaterThan(0.015);
    expect(cost).toBeLessThan(0.025);
  });
});

describe("AnthropicClient.complete — happy path", () => {
  it("returns a normalized ClaudeResponse on a successful call", async () => {
    mockCreate.mockResolvedValueOnce(sampleResponse());

    const client = new AnthropicClient();
    const result = await client.complete(sampleOptions());

    expect(result.text).toBe("Hello there!");
    expect(result.model).toBe("claude-sonnet-4-6");
    expect(result.stopReason).toBe("end_turn");
    expect(result.usage.inputTokens).toBe(100);
    expect(result.usage.outputTokens).toBe(50);
    expect(result.costUsd).toBeGreaterThan(0);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("attaches cache_control to system blocks when cache=true", async () => {
    mockCreate.mockResolvedValueOnce(sampleResponse());

    const client = new AnthropicClient();
    await client.complete(
      sampleOptions({
        systemPrompt: [
          { text: "Cached system block", cache: true },
          { text: "Uncached system block", cache: false },
        ],
      })
    );

    const arg = mockCreate.mock.calls[0][0];
    expect(arg.system).toHaveLength(2);
    expect(arg.system[0]).toEqual({
      type: "text",
      text: "Cached system block",
      cache_control: { type: "ephemeral" },
    });
    expect(arg.system[1]).toEqual({
      type: "text",
      text: "Uncached system block",
      // No cache_control on the second block
    });
  });
});

describe("AnthropicClient.complete — retry behavior", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  it("retries on 429 with exponential backoff and eventually succeeds", async () => {
    mockCreate
      .mockRejectedValueOnce({ status: 429, message: "rate limited" })
      .mockRejectedValueOnce({ status: 429, message: "rate limited" })
      .mockResolvedValueOnce(sampleResponse());

    const client = new AnthropicClient();
    const promise = client.complete(sampleOptions());

    // Advance timers through both backoffs (1s + 2s)
    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(2000);

    const result = await promise;
    expect(result.text).toBe("Hello there!");
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it("retries on 503 (server error)", async () => {
    mockCreate
      .mockRejectedValueOnce({ status: 503, message: "service unavailable" })
      .mockResolvedValueOnce(sampleResponse());

    const client = new AnthropicClient();
    const promise = client.complete(sampleOptions());

    await jest.advanceTimersByTimeAsync(1000);

    const result = await promise;
    expect(result.text).toBe("Hello there!");
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry on 400 (validation error) — surfaces immediately", async () => {
    const error = { status: 400, message: "invalid request" };
    mockCreate.mockRejectedValueOnce(error);

    const client = new AnthropicClient();
    await expect(client.complete(sampleOptions())).rejects.toEqual(error);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry on 401 (auth) — surfaces immediately", async () => {
    const error = { status: 401, message: "invalid api key" };
    mockCreate.mockRejectedValueOnce(error);

    const client = new AnthropicClient();
    await expect(client.complete(sampleOptions())).rejects.toEqual(error);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("gives up after MAX_RETRIES on persistent 429", async () => {
    const error = { status: 429, message: "rate limited" };
    mockCreate.mockRejectedValue(error);

    const client = new AnthropicClient();

    // Attach the catch handler synchronously so the rejection is never
    // "unhandled" when fake timers advance through the backoffs
    let caught: any = null;
    const promise = client.complete(sampleOptions()).catch((e) => {
      caught = e;
    });

    // Backoffs: 1s, 2s, 4s = 7s total
    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(2000);
    await jest.advanceTimersByTimeAsync(4000);
    await promise;

    expect(caught).toEqual(error);
    // 1 initial + 3 retries = 4 calls
    expect(mockCreate).toHaveBeenCalledTimes(4);
  });
});

describe("AnthropicClient — instantiation", () => {
  it("throws if ANTHROPIC_API_KEY is not set and no key is passed", () => {
    const original = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    expect(() => new AnthropicClient()).toThrow(/ANTHROPIC_API_KEY not set/);

    process.env.ANTHROPIC_API_KEY = original;
  });

  it("accepts an explicit api key argument", () => {
    expect(() => new AnthropicClient("explicit-key")).not.toThrow();
  });
});
