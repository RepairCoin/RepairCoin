# Decision brief — AI Auto-Replies over SMS / WhatsApp: number model + who pays

**For:** Management · **From:** Product/Eng · **Date:** 2026-07-15
**Decision needed:** (1) how each shop gets a texting number, and (2) **who bears the SMS/WhatsApp cost**.
**Why now:** the Business plan advertises **"AI Auto-Replies (Voice + Text)."** The in-app text auto-reply is
built; extending it to **SMS/WhatsApp** (so the AI answers customers on the channels they actually use) needs
these two decisions before we build. (A detailed technical plan for the engineering team exists separately.)

---

## 1. The situation in one paragraph
Today our AI can auto-reply to a customer inside the FixFlow app chat. To do it over **SMS/WhatsApp**, each
shop needs its **own** texting number — because if all shops shared one number, an incoming *"is it ready?"*
can't be matched to the right shop once a customer has used more than one shop. So this is a **per-shop
number** feature. There are two ways to give a shop a number, and there are real per-message + compliance
**costs** that someone has to pay.

## 2. Decision A — how a shop gets its number (two options)

| | **Option A — We provision** | **Option B — Bring Your Own (BYO)** |
|---|---|---|
| What | FixFlow buys a new Twilio number for the shop | Shop connects its **existing** business number (hosted SMS) |
| Customer sees | A **new** number they don't recognize | The shop's **real** number (on receipts/website) — more trust |
| Shop effort | None | Signs a **Letter of Authorization** (permission slip; ~few days to enable) |
| Phone service | New line, calls not affected | Keeps their number + calls exactly as-is; only texting is added |
| Fees | Same either way | Same either way |

**Recommendation:** support **both**, rolled out **per shop as they opt in** (not a shared pool). BYO is the
nicer experience; provisioned is the zero-effort fallback. **WhatsApp** is per-shop by nature (each business
has its own WhatsApp sender), so it avoids the number problem — its cost is Meta's per-business verification.

## 3. The costs (these exist no matter which option)
Approximate US figures — verify current Twilio/Meta pricing before locking numbers:

| Cost item | Rough amount | Notes |
|---|---|---|
| Per SMS message | ~$0.008–$0.01+ / segment | Charged **both** ways — the customer's text AND the AI's reply |
| A2P 10DLC brand registration | one-time, small | Required for any US business texting |
| A2P 10DLC campaign registration | ~$1.50–$10 / month | Per shop/use-case; ongoing |
| Carrier pass-through | fractions of a cent / msg | On top of Twilio's rate |
| Number (rented or hosted) | modest / month per shop | Rented (A) or hosted-number fee (B) |
| WhatsApp | per-conversation pricing + Meta verification | Different model from SMS |
| AI (Anthropic) | already covered | Draws on the shop's existing monthly AI budget |

**Bottom line:** the AI part is already paid for; the **new** money is the carrier + compliance cost of the
texts themselves. It's usage-based — a chatty customer base costs more.

## 4. Decision B — WHO pays the SMS/WhatsApp cost (pick one)

| Model | How it works | Pro | Con |
|---|---|---|---|
| **Bundle into Business** | FixFlow eats the SMS cost; it's "included" | Simplest sell; no shop friction | FixFlow carries a **variable, usage-based** cost — margin risk with heavy texters |
| **Pass-through to shop** | Shop is billed the number + per-message cost (via Stripe) | Protects our margin; scales cleanly | Adds a metered line item; more billing to build |
| **Capped / freemium** | N included auto-reply texts/mo, then overage or throttle | Predictable for both sides | Needs metering + an overage flow (like the AI budget) |

**Recommendation:** **Capped / freemium** — include a monthly allowance of auto-reply texts in Business, then
either throttle or bill overage (mirrors how the AI budget already soft-lands). It protects margin without a
hard "pay per text" feel, and reuses the metering pattern we already built for AI spend.

## 5. Other blockers management should know about
- **Consent / legal (blocking for launch).** SMS/WhatsApp auto-replies to customers require **prior opt-in
  consent** (TCPA in the US; WhatsApp has its own template + 24-hour-window rules). We can suppress opt-outs
  (STOP), but we need a **consent-capture step** and **legal sign-off** before switching this on in production.
- **Our texting-provider account is still in review.** Twilio (the SMS provider) has our account in a required
  identity/compliance review (from the earlier SMS setup) — live texting is blocked until that clears,
  regardless of the build.
- **Effort.** This is a **multi-week** build (SMS first, WhatsApp second), materially bigger than the in-app
  auto-reply already shipped.

## 6. What we need from management
1. **Number model:** approve **per-shop numbers, supporting both options (we provision + Bring-Your-Own),
   rolled out as shops opt in**?
2. **Who pays:** pick a billing model — bundle into Business / pass-through to the shop /
   **capped-freemium (recommended)**.
3. **Green-light the consent/legal work** (and confirm we should proceed to clear the Twilio account review).

Once these are decided, engineering can begin the build (SMS first, WhatsApp second).
