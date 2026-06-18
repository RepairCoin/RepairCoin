// backend/src/domains/AdsDomain/services/adCopyParse.ts
//
// PURE, side-effect-free parsing of the LLM's ad-copy output (Phase 2). Kept separate from
// AdCreativeService so it's unit-testable without loading the AI clients (which construct at
// import and need API keys).

/** Extract {headline, primaryText} from the model's JSON-ish output, with per-field fallbacks. */
export function parseAdCopy(text: string, fallback: string): { headline: string; primaryText: string } {
  const fb = { headline: fallback.slice(0, 40), primaryText: fallback.slice(0, 125) };
  try {
    const m = text.match(/\{[\s\S]*\}/); // tolerate prose around the JSON
    if (!m) return fb;
    const j = JSON.parse(m[0]);
    const headline = String(j.headline ?? '').trim().slice(0, 40) || fb.headline;
    const primaryText = String(j.primaryText ?? '').trim().slice(0, 125) || fb.primaryText;
    return { headline, primaryText };
  } catch {
    return fb;
  }
}
