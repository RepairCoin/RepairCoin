// backend/src/domains/AIAgentDomain/services/marketing/templateScaffolds.ts
//
// Template scaffolds for 4 recognized campaign categories. Scope §5 Q6:
// the AI uses these as a quality floor (subject pattern, body shape,
// CTA placement) but is NOT locked to them — novel asks free-draft.
//
// Each scaffold gives Claude:
//   - A subject pattern to riff on
//   - A body skeleton (intro → middle → CTA)
//   - Tone hints
//
// These get embedded in the system prompt and are cache-friendly
// (stable across requests).

export interface CampaignScaffold {
  /** Stable id used for matching shop intent to a scaffold. */
  category: string;
  /** Phrases in the shop's message that should trigger this category. */
  triggerKeywords: string[];
  /** Sample subject line patterns. */
  subjectPatterns: string[];
  /** Body skeleton with bracket placeholders the AI fills in. */
  bodyShape: string;
  /** Tone note for the AI. */
  tone: string;
}

export const CAMPAIGN_SCAFFOLDS: CampaignScaffold[] = [
  {
    category: "black_friday",
    triggerKeywords: ["black friday", "bfcm", "cyber monday", "holiday sale"],
    subjectPatterns: [
      "🛍️ Black Friday at {shop} — {offer}",
      "{offer} this Black Friday only",
      "Our biggest sale of the year",
    ],
    bodyShape: `Hi there,

Black Friday is here, and {shop} is going big.

{offer_details — echo only what the shop stated; otherwise placeholder "(your offer here)"}

This is our biggest sale of the year, so don't wait — {deadline}.

{cta_button: "Book now" or "Claim offer"}

See you soon,
The {shop} team`,
    tone:
      "Upbeat, urgent, but not pushy. Lead with the deal, follow with the deadline. Skip platitudes.",
  },
  {
    category: "win_back",
    triggerKeywords: [
      "win back",
      "win-back",
      "winback",
      "bring back",
      "lapsed",
      "old customer",
      "haven't booked",
      "haven't visited",
      "miss",
      "come back",
    ],
    subjectPatterns: [
      "We miss you at {shop}",
      "It's been a while — come back and {offer}",
      "We'd love to see you again at {shop}",
    ],
    bodyShape: `Hi there,

It's been a while since we've seen you at {shop} — we miss you.

{warm_note — acknowledge the gap without guilt-tripping}

{offer_details — what's the welcome-back hook? If shop stated one, use it; otherwise placeholder "(your offer here)"}

{cta_button: "Book your visit"}

Hope to see you soon,
The {shop} team`,
    tone:
      "Warm, sincere, slightly nostalgic. NOT desperate. NOT guilt-trippy. The customer left — meet them where they are.",
  },
  {
    category: "new_service_announcement",
    triggerKeywords: [
      "new service",
      "launching",
      "new offering",
      "announce service",
      "introduce",
      "just launched",
      "added a new",
    ],
    subjectPatterns: [
      "Introducing {service} at {shop}",
      "Something new at {shop} — {service}",
      "Just launched: {service}",
    ],
    bodyShape: `Hi there,

We've added something new at {shop}: **{service_name}**.

{service_pitch — what it is and what it does for the customer, drawn from the shop's services table}

{optional_intro_offer — only if shop stated a launch offer; otherwise omit this paragraph entirely}

{cta_button: "Book {service_name}" or "Learn more"}

Excited to have you try it,
The {shop} team`,
    tone:
      "Enthusiastic, concrete, customer-benefit-focused. Avoid jargon. Lead with what the customer gets, not what the shop is offering.",
  },
  {
    category: "weekend_special",
    triggerKeywords: [
      "weekend special",
      "weekend sale",
      "this weekend",
      "weekend only",
      "saturday and sunday",
      "limited time",
      "flash sale",
    ],
    subjectPatterns: [
      "{offer} — this weekend only at {shop}",
      "Weekend special: {offer}",
      "{shop} weekend deal — {offer}",
    ],
    bodyShape: `Hi there,

Quick one — {shop} is running a weekend-only special.

{offer_details — echo only what the shop stated; otherwise placeholder "(your offer here)"}

Available **{date_range — e.g., "Saturday and Sunday only"}**.

{cta_button: "Book your slot"}

Thanks,
The {shop} team`,
    tone:
      "Short, punchy, urgent. Two paragraphs max. The deadline IS the hook.",
  },
];

/**
 * Render the scaffold library as a stable block of prompt text. Embedded
 * once into the system prompt (cache-friendly). The AI reads this, picks
 * a scaffold (or free-drafts) per shop request.
 */
export function renderScaffoldsForPrompt(): string {
  return CAMPAIGN_SCAFFOLDS.map((s) => {
    const triggers = s.triggerKeywords.map((k) => `"${k}"`).join(", ");
    const subjects = s.subjectPatterns.map((p) => `  - ${p}`).join("\n");
    return `### Scaffold: ${s.category}

**Triggers when the shop says:** ${triggers}.

**Subject patterns:**
${subjects}

**Body shape:**
\`\`\`
${s.bodyShape}
\`\`\`

**Tone:** ${s.tone}`;
  }).join("\n\n");
}
