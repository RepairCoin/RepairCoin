# AI Memory — QA Guide (Phases 1 & 2)

**Date:** 2026-06-23
**Scope:** Verify the unified assistant's AI Memory end-to-end — the owner's STANDING
instructions (preferences/decisions/corrections) saved across conversations. NOT chat history,
NOT DB facts. Scope/plan: `ai-memory-scope.md`, `ai-memory-implementation-plan.md`.
**Status when written:** Phases 1 (recall + remember_this tool) and 2 (settings UI + CRUD) built;
backend tsc 0, FE tsc 290 (0 net new), unit + DB + live e2e all green. Uncommitted.

---

## 0. Prerequisites

- **Flag ON:** `ENABLE_AI_MEMORY=true` in `backend/.env`. The running backend must have it loaded —
  if the panel shows the grey "not enabled" note, **restart the backend** so it re-reads `.env`.
  (No frontend env flag — the panel learns `enabled` from `GET /api/ai/memories`.)
- **Servers:** backend on `:3002`, frontend on `:3001`. Quick check:
  - `curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/api/ai/memories` → **401** = route loaded (good); 404 = backend not updated.
- **Login:** a shop owner account (test shop = `peanut`, which starts at 0 memories).
- Optional env knobs: `AI_MEMORY_TOP_K` (default 6), `AI_MEMORY_STALE_DAYS` (default 180).

---

## 1. Settings panel — where

Log in as a shop → **Settings → AI Assistant** tab → scroll past "AI Sales Agent" to the
**"Assistant Memory"** card.

## 2. Functional checklist

- [ ] **Renders** — "Assistant Memory" header (brain icon) + description, an Add form (Type dropdown +
      "What should it remember?" textarea + Tags), and a "Nothing saved yet…" empty state.
- [ ] **Add valid** — Type=`Instruction`, content `Never suggest discounts in campaigns`, tags
      `campaigns, discounts` → **Add** → success toast; row appears with an **Instruction** badge +
      `#campaigns #discounts`.
- [ ] **Guard: fact-like rejected** — content `What was my revenue last week?` → **Add** → red toast
      ("looks like a question/fact"); nothing added. *(D0 — memory is intent, not DB facts.)*
- [ ] **Guard: duplicate rejected** — re-add `never suggest discounts in campaigns` (different case) →
      red toast "already saved".
- [ ] **Edit** — pencil → inline textarea → change text → check (✓) → toast "Updated"; row shows new text.
- [ ] **Delete** — trash → row disappears immediately (optimistic) → toast "Forgotten".
- [ ] **Other kinds** — add a `Preference` (e.g. `Address me as Boss`) → badge reads **Preference**.
- [ ] **Empty state** — delete all → "Nothing saved yet…" returns.

## 3. Cross-feature — chat round-trip (ties Phase 1 ↔ Phase 2)

- [ ] **Chat write surfaces in UI** — open the unified assistant, say *"From now on always mention free
      diagnostics."* → the assistant confirms (it called `remember_this`) → return to the Memory panel,
      reload → the instruction appears in the list.
- [ ] **Recall honored** — in a FRESH chat (no history) ask for a promo idea → the assistant honors the
      saved standing instructions (e.g. avoids discounts, mentions free diagnostics). It will NOT cite
      them as data/metrics.

## 4. Disabled state (optional)

- [ ] Set `ENABLE_AI_MEMORY=false`, restart backend, reload Settings → AI Assistant → the card shows the
      grey "isn't enabled for your account yet / contact support" note, **no form**.
- [ ] With the flag off, the unified assistant does NOT offer `remember_this` (chat "remember this" saves nothing).

## 5. Look & accessibility

- [ ] Matches the dark dashboard theme (shadcn Card/Select/Textarea/Input/Badge/Button).
- [ ] Text legible per the readability floor (body 14px+, no sub-12px); usable at mobile width.

---

## Backend behavior reference (for triage)

- `GET /api/ai/memories` → `{ enabled, memories[] }` (shop-scoped via JWT).
- `POST /api/ai/memories` `{ kind, content, tags? }` → `201` saved | `400 {error: looks_like_fact|duplicate|empty}` | `409` when flag off.
- `PATCH /api/ai/memories/:id` `{ content?, tags?, pinned? }` → `200` | `404` not found.
- `DELETE /api/ai/memories/:id` → `200 {deleted:true}` | `404`.
- Recall is injected into the orchestrator system prompt as a non-cached "OWNER PREFERENCES & STANDING
  INSTRUCTIONS" block, bounded to top-K (`AI_MEMORY_TOP_K`).
- Owner-added (explicit) memories are `pinned` → exempt from auto-aging; `last_referenced_at` bumps on recall.

## Cleanup after QA

- Delete test memories via the panel (trash each) OR:
  `DELETE FROM ai_memories WHERE shop_id = '<shop>';` (staging).

## Known scope (not bugs)

- No auto-extraction yet (Phase 3, deprioritized) — only explicit/owner-typed + chat `remember_this`.
- Shop-level only (no per-customer memory — Phase 4).
- `remember_this` is offered to the model only when the flag is on (zero token cost when off).
