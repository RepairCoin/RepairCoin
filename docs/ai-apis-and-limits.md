# AI APIs & Limits

A reference of the external APIs/models the AI features use, and the caps,
budgets, and rate limits that govern them. Reflects the current code.

---

## External APIs & models

### Anthropic — Claude (reasoning + vision)
- **`claude-sonnet-4-6`** — the default model for the orchestrator (unified
  assistant), Business Insights, Marketing, and the customer-facing Sales
  Agent. Also powers **vision** over attached photos (brand/image analysis).
- **`claude-haiku-4-5-20251001`** — cheaper/faster model. Used as the automatic
  fallback when a shop is ≥70% through its monthly budget, and as the primary
  model for FAQ suggestions, the help assistant, previews, and follow-up
  generation.

### OpenAI
- **`gpt-image-1`** — image **generation** (`/images/generations`) **and
  editing** (`/images/edits`). *(Stability / SD3.5 was retired — it ignored
  edit instructions.)*
- **`whisper-1`** — speech-to-text (`/audio/transcriptions`) for voice input.
- **`tts-1`** (with `tts-1-hd` also available) — text-to-speech
  (`/audio/speech`), default voice **"alloy"**.
- **`omni-moderation-latest`** — screens every image prompt before generation.

### Storage / platform
- **DigitalOcean Spaces** — stores generated and uploaded images.
- Wider platform (non-AI): **Thirdweb** (blockchain), **Stripe** (payments).

---

## Caps & limits

### AI spend (per shop)
- Monthly budget: **default $20/mo**, admin-settable **$0–$1,000**
  (`monthly_budget_usd`).
- **≥70% of budget used → auto-downshifts to the cheaper model** (Haiku).
- **≥100% used → blocks** further AI calls until the next month.
- Running spend tracked per shop (`current_month_spend_usd`); every call's cost
  is recorded.

### Image generation
- **Kill switch** per shop: `ai_images_enabled`, default **OFF** (admin toggle).
- **Daily cap: 50 images / shop / day** → returns `429` when exceeded.
- **Prompt cap: 1,000 characters.**
- **Moderation** on every prompt before generating.
- Gate order: **kill-switch → spend cap → daily rate limit → moderation →
  generate.** Every generation is audited.

### Customer-facing AI Sales Agent
- Admin gates: `ai_global_enabled`, `ai_followup_enabled`.
- Shop-tunable bounds: escalation threshold **1–20**, follow-up delay
  **15–30 min**, human-reply baseline **15–1,440 min**.

### Platform-level
- Admin-configurable API rate limiting (toggle, window, max requests,
  bypass IPs).
- **30-second** request timeout on all requests.
- Every AI turn is audited to per-feature message tables (orchestrate /
  insights / marketing).
