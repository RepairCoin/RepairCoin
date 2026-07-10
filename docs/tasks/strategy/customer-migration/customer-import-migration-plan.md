# Customer + Service Import / Migration (Square & other software) — Implementation Plan

**Date:** 2026-06-25
**Branch:** `deo/ads-system` (or a dedicated `deo/customer-import` branch)
**Status:** plan — not started. Standing rule: do not commit unless told.
**Goal:** let a shop **migrate their existing customers + services from another POS (Square first)**
by uploading the export file — ideally "just give it the file" with **AI column-mapping** — instead of
requiring a hand-formatted, wallet-keyed sheet. Driven by a real request: import ~15k Square customers.

---

## Context (the request)
Management: *"download my 15k customers from Square… and the services… I think we still have bugs…
if it's simpler for AI to do it that'd be amazing for customers switching from another software."*

## Root causes of the current bugs (verified in code)
The importer (`utils/customerExcelParser.ts` + `CustomerImportExportService`) assumes every customer
already has a **RepairCoin wallet**, which an external (Square) export never has:
1. **Wallet required → rows dropped.** `mapRowToCustomer` returns `null` for any row without a
   `walletAddress` (parser ~line 216) → service throws **"File contains no valid customer data."**
2. **`'Address'` alias mis-maps a street-address column to the wallet field** (parser line 47) → it's
   prefixed with `0x`, then fails the strict `0x+40hex` check → **every row `INVALID_WALLET_ADDRESS`.**
3. **10,000-row cap** (`CustomerImportExportService` ~line 179) → a **15k** file is rejected outright.
4. **Header mismatches** — Square headers ("Email Address", "Phone Number", "First Name", "Reference
   ID", "Company"…) only partially match the aliases → silent field loss.
5. **Services import** (`ServiceDomain/ImportExportController`) is a separate path with its own schema —
   Square's catalog/items export won't line up either.

---

## Real Square export analyzed (`export-20260624-133140.csv`, 2026-06-25)
- **15,538 records**, 23 columns. Header: `Reference ID, First Name, Last Name, Email Address,
  Phone Number, Nickname, Company Name, Street Address 1/2, City, State, Postal Code, Birthday, Memo,
  Square Customer ID, Creation Source, First/Last Visit, Transaction Count, Lifetime Spend,
  Email Subscription Status, Instant Profile, Blocked from online booking`.
- **0 rows have a wallet** → current import fails 100% ("File contains no valid customer data").
  (The `'Address'` alias is NOT the cause here — the column is "Street Address 1"; still drop the alias
  as a latent hazard.)
- **Contact coverage:** phone **12,569**, email **3,836**, **email-or-phone 12,908 (83%)**,
  **neither 2,630 (17%)**.
- **15,538 > 10k cap** → batching is required for this file.
- **Confirmed Square → our-field map** (mostly already matches; tune in Phase 4 preset):
  `First Name→firstName`, `Last Name→lastName`, `Email Address→email`, `Phone Number→phone`.
  `Company Name`/`Nickname` → optional name fallback. `Reference ID`/`Square Customer ID` → store as
  external ref/source. **`Lifetime Spend` → `lifetime_spend_usd`** (NOT `lifetimeEarnings`/RCN).
  **`Email Subscription Status` → `marketing_email_consent`**. **`First/Last Visit` → `first/last_visit_at`**.
  Address/city/state/zip/birthday/memo → not on `customers` today → ignore for v1.

---

## Decisions to lock
- **D1 — Wallet-less import.** `walletAddress` becomes **optional**; when absent, auto-generate a
  `0xMANUAL…` placeholder (same pattern as manual booking) and **dedup phone-first, then email**
  (the Square file is phone-dominant: 12.5k phone vs 3.8k email). Imported customers later claim a
  real wallet via email/phone (the claim flow we just repaired).
- **D6 — Rows with neither email nor phone (2,630 / 17% here): SKIP + report (LOCKED 2026-06-25).**
  Import the 12,908 with email/phone; skip the 2,630 contactless rows and list them in the import
  report (no dedup/claim risk, clean re-imports). Shop adds them manually later. (An "import anyway"
  toggle can be a later opt-in, not v1.)
- **D7 — Source tagging (LOCKED 2026-06-25).** Add `customers.import_source TEXT` (e.g. 'square') +
  `customers.external_ref TEXT` (source system's id, e.g. Square Customer ID). One migration. Gives
  origin visibility/segmentation AND a reliable re-import dedup key (covers contactless rows too).
- **D8 — AI mapping is human-confirmed (Phase 2).** AI reasons over headers + sample rows to map ANY
  tabular export (Square/Vagaro/Mindbody/spreadsheet) → our fields, robust to naming/order/combined
  fields; a review-and-adjust step precedes import. AI maps, the deterministic pipeline ingests. It
  can't invent missing contact data (D6 still applies); tabular files only (no PDF/OCR in v1).
- **D9 — Import marketing consent + history (LOCKED 2026-06-25), for compliant, segmentable marketing.**
  Capture three more Square columns we'd otherwise drop:
  - **`Email Subscription Status` → `marketing_email_consent`** (boolean): campaigns MUST suppress
    non-subscribers. Legally important (CAN-SPAM/CASL/GDPR) and a deliverability win.
  - **`Lifetime Spend` → `lifetime_spend_usd`** (numeric): VIP/high-value segmentation. Stored
    separately — **NOT** `lifetimeEarnings` (that's RCN, not USD spent).
  - **`First Visit` / `Last Visit` → `first_visit_at` / `last_visit_at`** (timestamps): win-back /
    lapsed segmentation. (Optionally `Transaction Count → visit_count`.)
  These are descriptive/marketing fields, never used for RCN balances. Phone is still transactional/
  claim-only; **marketing SMS needs explicit consent (TCPA)** and is out of scope for auto-sends.
- **D2 — Remove the dangerous `'Address'` alias** for wallet; require explicit wallet headers only
  (`Wallet Address` / `wallet_address` / `WalletAddress` / `Wallet`). Add a street-`address` field
  separately if we want to store it.
- **D3 — Support 15k+** by **raising/auto-batching** the cap (chunked inserts), not a hard 10k reject.
- **D4 — AI mapping is a layer ON TOP of the deterministic importer**, not a replacement. AI proposes a
  column mapping; the proven parse/validate/insert pipeline still does the work (auditable, safe).
- **D5 — Services get the same treatment** (deterministic import + AI mapping) so a shop migrates
  customers AND catalog in one flow.

---

## Phase 1 — Wallet-less customer import (the immediate unblocker) (~1.5–2d)
- **Parser (`customerExcelParser.ts`):**
  - Make `walletAddress` optional; if missing/blank, generate `0xMANUAL…` placeholder (shared helper).
  - **Drop `'Address'` from the wallet aliases.** Expand other aliases (phone: "Mobile Number",
    "Contact Number", "Cell"; email: "E-mail Address"; name: "Customer").
  - Require **email OR phone** when there's no real wallet (so the row is claimable + dedupable);
    otherwise skip with a clear reason (not a silent drop).
  - Allow an **explicit column mapping override** (param) so the AI layer (Phase 2) can pass a mapping
    instead of relying on alias auto-detect.
- **Service (`CustomerImportExportService`):**
  - Dedup/merge on **email or phone** when wallet is a placeholder (today it dedups on wallet only).
  - Replace the hard **10k reject** with **batched processing** (e.g. 1–2k/chunk) up to a higher ceiling.
  - On "0 valid rows", return a **specific reason** ("no wallet/email/phone columns detected") not a
    generic failure; surface per-row errors (already produced) to the UI.
  - Persist source + history + consent (D7/D9). **Migration (verify next-free number at build):**
    `customers.import_source TEXT`, `external_ref TEXT`, `marketing_email_consent BOOLEAN`,
    `lifetime_spend_usd NUMERIC(12,2)`, `first_visit_at TIMESTAMPTZ`, `last_visit_at TIMESTAMPTZ`
    (+ optional `visit_count INT`). Campaigns read `marketing_email_consent` to suppress
    non-subscribers; spend/visit power VIP + win-back segments.
- **Tests:** parse a wallet-less sheet → placeholders generated, dedup on email/phone, Address column
  NOT treated as wallet, >10k batched, consent/spend/visit parsed. Plus a small Square-shaped fixture.

## Phase 2 — AI column-mapping for customers ("just give the file") (~2–3d)
- **Endpoint:** `POST /api/customers/import/suggest-mapping` — accepts the uploaded file's **headers +
  a few sample rows**, calls the LLM (existing AI infra) to return `{ ourField: theirHeader }` +
  confidence + notes. Spend-capped + cached.
- **UI flow:** upload → AI proposes a mapping → user **reviews/adjusts** in a simple mapping grid →
  confirm → runs the Phase-1 importer with the explicit mapping (D4). Falls back to alias auto-detect.
- Handles arbitrary source software (Square, Vagaro, Mindbody, plain spreadsheets) without hard-coding.

## Phase 3 — Services import parity + AI mapping (~1.5–2d)
- Audit `ServiceDomain/ImportExportService` for the same friction; make its parser accept an explicit
  mapping; expand aliases for Square catalog columns (Item Name, Price, Category, Description, SKU).
- Reuse the Phase-2 AI mapping endpoint (generalize it to a target schema: `customers` | `services`).
- Map Square catalog → `shop_services` (service_name, price_usd, category, description, image).

## Phase 4 — Square preset + real-file QA (~0.5–1d)
- A built-in **Square preset** (known header → field map) so Square files map instantly even without AI.
- QA against a **real Square export** (get the actual headers + a sample from management); tune aliases.
- Verify 15k import end-to-end (batching, timing, dedup, dry-run report).

---

## Data model / safety
- Reuses existing schema: `customers` (placeholder satisfies NOT NULL `wallet_address`; email unique),
  `shop_services`, and the existing import-job record (`saveImportJob`). Optional `import_source` column.
- **Dedup correctness** is the main risk: with no wallet, two rows sharing an email collide (unique
  index) — the importer must merge/skip per `onDuplicate` (extend it to email/phone), not error the run.
- Placeholder customers are claimable later via email/phone (claim flow already fixed + tested).

## Effort
- **Phase 1 ~1.5–2d** — unblocks the 15k Square import (the urgent bit), backend-only.
- Phase 2 ~2–3d (AI mapping + UI). Phase 3 ~1.5–2d (services). Phase 4 ~0.5–1d.
- **Total ~5.5–8d**; Phase 1 alone delivers the immediate value.

## Verification
- Backend tsc 0; FE tsc 290 baseline.
- Live (staging): import a wallet-less Square-shaped fixture → placeholders + dedup + per-row report;
  >10k batched; AI mapping returns a sane map; services import maps catalog → shop_services.
- No PII/security regressions (file-signature validation + rate limiting already exist — keep them).

## Out of scope
- Two-way sync back to Square. Photo/asset migration from Square. Real-time API integration with Square
  (this is file-based migration). Bulk wallet provisioning on-chain (placeholders are DB-only).
