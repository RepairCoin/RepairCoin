// Homepage AI assistant — the only API service here that talks to a PUBLIC, unauthenticated endpoint.
//
// Uses plain fetch rather than the shared apiClient on purpose: apiClient attaches auth, runs the
// token-refresh interceptor, and unwraps responses in a way that assumes a logged-in caller. None of
// that applies to a marketing-page visitor, and a 401-refresh loop firing on the homepage would be a
// bug that only ever appears for logged-out users — the hardest kind to notice.
//
// `credentials: 'include'` is required: the free-answer count lives in an httpOnly session cookie set
// by the server, which is what stops the limit being editable in devtools.

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

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

export async function askHomepageAi(
  question: string,
  captchaToken?: string
): Promise<AskResponse> {
  const res = await fetch(`${API_BASE}/api/public/ai/ask`, {
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
