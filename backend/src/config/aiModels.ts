// backend/src/config/aiModels.ts
//
// Central AI model configuration — ONE place to control which Claude models the app uses.
// Previously each of ~25 files hard-coded a model ID; a bump (e.g. Sonnet 4.6 → Sonnet 5) meant editing
// them all. Now every call site reads from here, and the defaults are env-overridable, so a model change
// or a per-feature pilot is a config change (env var + redeploy), not a code sweep.
//
// Two tiers:
//   SMART — reasoning / tool-use features (unified assistant, insights, marketing, customer chat, vision).
//   CHEAP — light tasks (ads copy, FAQ, help, triage, screening) + the spend-cap soft-landing fallback.
//
// Per-feature override: modelFor('MARKETING', smartModel()) reads AI_MODEL_MARKETING first, else the tier
// default — so a new model can be piloted on ONE feature (e.g. Sonnet 5 on marketing) without touching the
// rest. Env is read at call time; module-level consts that call these capture at import (a redeploy
// re-reads), matching the previous module-const behavior.

import { ClaudeModel } from '../domains/AIAgentDomain/types';

const DEFAULT_SMART: ClaudeModel = 'claude-sonnet-4-6';
const DEFAULT_CHEAP: ClaudeModel = 'claude-haiku-4-5-20251001';

const read = (key: string): ClaudeModel | undefined => {
  const v = process.env[key];
  return v && v.trim() ? (v.trim() as ClaudeModel) : undefined;
};

/** The "smart" tier (reasoning / tool-use). Override with AI_MODEL_SMART (e.g. claude-sonnet-5). */
export const smartModel = (): ClaudeModel => read('AI_MODEL_SMART') ?? DEFAULT_SMART;

/** The "cheap" tier (light tasks + spend-cap soft-landing fallback). Override with AI_MODEL_CHEAP. */
export const cheapModel = (): ClaudeModel => read('AI_MODEL_CHEAP') ?? DEFAULT_CHEAP;

/**
 * Per-feature model with an optional env override, else the given tier default.
 * `modelFor('MARKETING', smartModel())` → reads AI_MODEL_MARKETING first. Used to pilot a model on one
 * feature (e.g. set AI_MODEL_MARKETING=claude-sonnet-5 to run Sonnet 5 on marketing only).
 */
export const modelFor = (feature: string, tierDefault: ClaudeModel): ClaudeModel =>
  read(`AI_MODEL_${feature.toUpperCase()}`) ?? tierDefault;
