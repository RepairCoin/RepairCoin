// Homepage AI assistant — the only API service here that talks to a PUBLIC, unauthenticated endpoint.
//
// Uses plain fetch rather than the shared apiClient on purpose: apiClient attaches auth, runs the
// token-refresh interceptor, and unwraps responses in a way that assumes a logged-in caller. None of
// that applies to a marketing-page visitor, and a 401-refresh loop firing on the homepage would be a
// bug that only ever appears for logged-out users — the hardest kind to notice.
//
// `credentials: 'include'` is required: the free-answer count lives in an httpOnly session cookie set
// by the server, which is what stops the limit being editable in devtools.

// Use the SAME host resolution as everything else. The first version read NEXT_PUBLIC_API_URL
// directly, which is undefined in the browser — so every request went to staging.repaircoin.ai
// (Vercel) instead of the API host, 404'd, and surfaced as the client's catch message on every
// question. Note the helper's return value already ends in `/api`, so paths here must not repeat it.
import { getApiBaseUrl } from "@/utils/apiUrl";

export type AnsweredBy = "corpus" | "model" | "fallback" | "refused" | "gated";

export interface AskResponse {
  answeredBy: AnsweredBy;
  answer: string;
  nextStep: string;
  /** Free answers left in this session. */
  remaining: number;
  /** True once the free answers are used up — the UI shows the account card instead of an input. */
  gated: boolean;
}

export interface SessionState {
  turns: Array<{ question: string; answer: string; nextStep: string; answeredBy: AnsweredBy }>;
  remaining: number;
  gated: boolean;
}

/**
 * Rebuild the conversation after a refresh.
 *
 * The allowance lives server-side against an httpOnly cookie, so a refresh never reset it — but the
 * React state was the only record of the THREAD, so the page came back empty with the input enabled
 * while the server would still refuse to answer. This makes the UI reflect the server rather than
 * contradict it.
 *
 * Failure is silent and returns an empty thread: losing history is a small cost, and /ask re-checks
 * the allowance server-side regardless of what this said.
 */
export async function getHomepageAiSession(): Promise<SessionState> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/public/ai/session`, {
      method: "GET",
      credentials: "include",
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.success) return { turns: [], remaining: 5, gated: false };
    return body.data as SessionState;
  } catch {
    return { turns: [], remaining: 5, gated: false };
  }
}

export async function askHomepageAi(
  question: string,
  captchaToken?: string
): Promise<AskResponse> {
  const res = await fetch(`${getApiBaseUrl()}/public/ai/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ question, ...(captchaToken ? { captchaToken } : {}) }),
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    // Rate limiting is the main path here. The caller renders this as an ordinary answer card, never
    // as an error — a visitor should not be able to tell "we chose not to answer" from "it broke".
    throw new Error(body?.error ?? "Could not get an answer right now.");
  }

  return body.data as AskResponse;
}
