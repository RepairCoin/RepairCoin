// backend/src/domains/AIAgentDomain/services/dateContext.ts
//
// Per-turn "today's date" system block for the shop AI assistants (orchestrator,
// marketing, insights). The model has NO inherent sense of the current date, so
// without this it proposes out-of-season campaigns (e.g. a "Black Friday" promo
// in June) and can't judge whether anything is timely.
//
// MUST be injected as a NON-CACHED system block — the date changes daily, so a
// cached one would serve a stale date. It's tiny, so the cache hit on the big
// stable prefix (rules + help corpus) is unaffected.

/** A non-cached system-prompt block stating today's date + how to use it. */
export function buildDateContextBlock(now: Date = new Date()): string {
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return (
    `Today's date is ${dateStr}. Use it for any time-sensitive reasoning. ` +
    `When proposing a SEASONAL or holiday campaign (Black Friday, Christmas, ` +
    `Valentine's, back-to-school, etc.), check the timing against today — do NOT ` +
    `pitch one that is months away or already passed; suggest a timely angle ` +
    `instead, or confirm the date with the owner. Never claim or invent a date ` +
    `you can't derive from this.`
  );
}
