# Gap note — "AI Campaigns (Advanced)" (Business) is unbuilt / undefined

**Raised:** 2026-07-20 · **Status:** needs a product decision from management · **Owner:** product/management

The pricing sheet (`pricing.jpeg`) lists three marketing-related items across tiers. Two map cleanly to
shipped features; the third (a Business-tier upsell) is **declared in the tier config but implemented
nowhere** — it currently has no distinct feature behind it. This note captures what's built per tier and
lays out candidate definitions so management can decide what "AI Campaigns (Advanced)" should actually be.

---

## What's actually built (verified in code 2026-07-20)

**1. "Campaign Builder" — GROWTH — BUILT ✅**
- The manual marketing tab at `/shop?tab=marketing` (build audience → write content → schedule/send email + SMS yourself).
- Gate: `campaignBuilder: 'growth'` in `backend/src/config/featureTiers.ts`.
- Enforced: the entire `MarketingDomain` (`backend/src/domains/MarketingDomain/routes.ts`, 20+ routes) + the
  frontend marketing tab (`ShopDashboardClient.tsx` `<TierGate feature="campaignBuilder">`, sidebar
  `marketing → campaignBuilder`).

**2. "AI Marketing Suite" — GROWTH — BUILT ✅**
- The conversational AI campaign drafter (propose-then-tap panel) + the marketing capability inside the
  unified assistant. "Ask the AI to draft a campaign; tap to send."
- Gate: `aiMarketingSuite: 'growth'`.
- Enforced: `/api/ai/marketing-chat` route (`requireTier('aiMarketingSuite')`); `UnifiedAssistantPanel`
  `can("aiMarketingSuite")`.

**3. "AI Campaigns (Advanced)" — BUSINESS — NOT BUILT ⚠️**
- Gate: `aiCampaignsAdvanced: 'business'` exists in `featureTiers.ts`, but:
  - **No `requireTier('aiCampaignsAdvanced')` anywhere** (backend).
  - **No frontend usage / TierGate.**
  - **No distinct feature** — nothing separates it from the Growth-tier AI Marketing Suite.
- It is a placeholder promising a Business upsell that the product has not yet defined or implemented.

---

## The gap

The sheet sells "AI Campaigns (Advanced)" as a reason to move from Growth ($299) to Business ($599), but
today a Business shop gets **the same marketing capabilities as a Growth shop** — Campaign Builder + AI
Marketing Suite are both Growth. There is no built "Advanced" campaign feature. This is a
sell-what-isn't-there risk and an unclaimed upsell.

**Correction to a common misread:** the AI-panel campaign drafter is the *Growth* "AI Marketing Suite,"
NOT the Business "AI Campaigns (Advanced)." So "manual builder vs. AI panel" is the Campaign-Builder vs
AI-Marketing-Suite split — both at Growth. The Business item is a third, undefined thing.

---

## Recommended split — Campaign Builder vs AI Campaigns (Advanced)

Business is cumulative (includes everything in Growth), so "AI Campaigns (Advanced)" is **additive** on top
of Campaign Builder + AI Marketing Suite. The theme that justifies the Business price: **Growth = "AI drafts
a campaign when you ask"; Business = "AI runs campaigns for you — automatically, on triggers, over time."**

| Capability | Campaign Builder (Growth) | AI Campaigns Advanced (Business) |
|---|---|---|
| Manual campaign creation (audience, content, schedule) | ✅ | ✅ (inherited) |
| AI drafts a campaign on request ("propose-then-tap")¹ | ✅ | ✅ (inherited) |
| Audience segments / basic targeting | ✅ | ✅ (inherited) |
| Email + SMS send | ✅ | ✅ (inherited) |
| Manual scheduling (send-later) | ✅ | ✅ (inherited) |
| Attach RCN campaign rewards² | ✅ | ✅ (inherited) |
| **Autonomous / triggered campaigns** (auto-fire on lapsed customers, slow days, post-service, win-back) | — | ✅ |
| **Recurring campaign automation** (set-and-forget weekly/monthly) | — | ✅ |
| **A/B testing + auto-optimization** (AI splits audience, picks winner, reports lift) | — | ✅ |
| **Multi-step drip sequences** (reminder → offer → last-chance) | — | ✅ |
| **Cross-channel orchestration** (AI picks email/SMS/WhatsApp per recipient) | — | ✅ |
| **Advanced analytics / ROI attribution** (revenue per campaign, cohort lift) | — | ✅ |

¹ Technically the Growth "AI Marketing Suite" feature — bundled here since Business inherits it.
² Growth-tier `campaignRewards`.

Several "Advanced" rows lean on capabilities already in the codebase (lapsed-audience model, insights
signals, campaign rewards, the marketing send pipeline), so it can largely be **orchestration + automation
on top of what exists**, not a from-scratch build. Pick the subset that best justifies the Business tier.

---

## Recommendation

1. **Management/product decides** what "AI Campaigns (Advanced)" means from the list above (or descope it
   from the sheet if it won't be built near-term — don't advertise an undefined upsell).
2. Once defined, it's a scoped feature: implement behind the existing `aiCampaignsAdvanced` gate
   (already Business-tier in `featureTiers.ts`) + add the `requireTier('aiCampaignsAdvanced')` enforcement.
3. Until then, the tier config entry is harmless (unused), but the **sheet overstates the Business
   marketing differentiation** — flag to whoever owns pricing copy.

**Files:** `backend/src/config/featureTiers.ts` (+ `frontend/src/config/featureTiers.ts`),
`backend/src/domains/MarketingDomain/routes.ts`, `backend/src/domains/AIAgentDomain/routes.ts` (marketing-chat).
Related: [[project-ai-marketing-campaigns-state]], [[project-lapsed-audience-data-model]], the pricing rollout.
