// backend/src/domains/AdsDomain/services/adCopyParse.ts
//
// PURE, side-effect-free parsing of the LLM's ad-copy output (Phase 2). Kept separate from
// AdCreativeService so it's unit-testable without loading the AI clients (which construct at
// import and need API keys).

/** Truncate to `max` chars WITHOUT cutting mid-word. If over the limit, back off to the last
 *  word boundary (as long as that keeps ≥60% of the budget, so we don't truncate too hard) and
 *  strip any trailing punctuation/connectors so it never ends on a dangling "f" or ", with our". */
export function truncateAtWord(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t.replace(/[\s,;:\-–—]+$/, '');
  let cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace >= Math.floor(max * 0.6)) cut = cut.slice(0, lastSpace);
  return cut.replace(/[\s,;:\-–—]+$/, ''); // drop trailing space/comma/dash left by the cut
}

/** Extract {headline, primaryText} from the model's JSON-ish output, with per-field fallbacks.
 *  Both fields are truncated at a WORD boundary to Meta's limits (headline 40, primary 125). */
export function parseAdCopy(text: string, fallback: string): { headline: string; primaryText: string } {
  const fb = { headline: truncateAtWord(fallback, 40), primaryText: truncateAtWord(fallback, 125) };
  try {
    const m = text.match(/\{[\s\S]*\}/); // tolerate prose around the JSON
    if (!m) return fb;
    const j = JSON.parse(m[0]);
    const headline = truncateAtWord(String(j.headline ?? ''), 40) || fb.headline;
    const primaryText = truncateAtWord(String(j.primaryText ?? ''), 125) || fb.primaryText;
    return { headline, primaryText };
  } catch {
    return fb;
  }
}
