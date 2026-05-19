// frontend/src/services/api/aiFaqSuggestions.ts
//
// AI-suggested FAQ entries for a service. Backed by
// POST /api/ai/services/:serviceId/faq-suggestions.
//
// The suggestions are DRAFTS — the shop reviews and explicitly adds them
// to the FAQ editor; this call never persists anything.

import apiClient from './client';

export interface FaqSuggestion {
  question: string;
  /** May be empty — the AI leaves the answer blank when the service
   *  description doesn't support one, for the shop to fill in. */
  answer: string;
  /** A one-line "what to write here" guide — shown to the shop when the
   *  answer is blank, so a blank answer is a guided fill-in. */
  answerHint: string;
}

export interface FaqSuggestionsResult {
  suggestions: FaqSuggestion[];
  /** True when the shop's monthly AI budget is exhausted — no call was made. */
  overBudget: boolean;
}

/**
 * Ask the AI to suggest FAQ entries for a service.
 *
 * `sourceText` is optional shop-pasted material (notes, website copy) — the
 * AI drafts answers from it in addition to the service description. It is
 * not stored; it only shapes this one request.
 *
 * `description` is the LIVE description from the service edit form. The
 * suggest endpoint otherwise reads the last-saved description from the DB;
 * passing the in-progress value lets edits take effect before a save.
 */
export const getServiceFaqSuggestions = async (
  serviceId: string,
  sourceText?: string,
  description?: string
): Promise<FaqSuggestionsResult> => {
  const body: Record<string, string> = {};
  const trimmedSource = sourceText?.trim();
  if (trimmedSource) body.sourceText = trimmedSource;
  const trimmedDescription = description?.trim();
  if (trimmedDescription) body.description = trimmedDescription;

  const response = await apiClient.post(
    `/ai/services/${encodeURIComponent(serviceId)}/faq-suggestions`,
    body
  );
  const data = response.data?.data || response.data || {};
  return {
    suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
    overBudget: data.overBudget === true,
  };
};
