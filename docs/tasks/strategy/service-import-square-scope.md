# Service Import — Square (and other third-party) catalog import (scope)

Import a shop's **services/catalog** from a CSV — starting with a **Square** catalog export — into `shop_services`,
reusing the existing import infrastructure.

## Key finding: the import itself is ALREADY BUILT (reuses the customer-import infra)
The service-import pipeline mirrors customers and is **fully wired**:
- **Backend:** `POST /api/services/import` (+ `/suggest-mapping`, `/import/:jobId`, `/export`, `/template`) —
  `requireRole(['shop','admin'])`, shop-scoped by `req.user.shopId`, modes add/merge/replace, dry-run, qualification gate
  (subscription or 10K+ RCG). `ServiceDomain/services/ImportExportService.ts` + `controllers/ImportExportController.ts`.
- **AI column-mapping is SHARED** — the service import instantiates the **same** `ImportMappingService`
  (`serviceImportMappingService`) the customers feature uses; it maps arbitrary CSV headers → canonical fields via Claude
  Haiku, spend-capped per shop. So "reuse from customer import" = already done at the core.
- **Frontend:** `frontend/src/components/shop/modals/ServiceImportModal.tsx` (drag-drop, mode, dry-run, AI mapping review,
  results) and the shop **Services** tab (`ServicesTab.tsx`) **already has an Import button** + the modal mounted.
- **Dedup:** today by service **name** (case-insensitive), within-file + against existing.

So there is **nothing to build for a generic CSV** — a shop can already import services. The work is **Square-specific
handling**, because a Square export is wide, has vendor quirks, and needs a stable re-import identity.

## The Square export (sample: 567 rows)
Columns of interest: `Token` (Square item id), `Item Name`, `Customer-facing Name`, `Variation Name`, `Description`,
`Categories`, `Reporting Category`, `Price` (numeric **or the literal `variable`**), `SKU`, `Archived` (Y/N),
`Sellable` (Y/N), `Square Online Item Visibility` (visible/unavailable/hidden), plus ~30 Square-only columns (SEO,
shipping, modifiers, inventory, vendor) we ignore.

## The real gaps (Square + "others")
1. **Stable re-import identity — `import_source` + `external_ref`.** `shop_services` has **no** import fields (customers
   got them in migration 183; services didn't). Add them + map Square `Token` → `external_ref`, `import_source='square'`.
   Then re-importing the same Square catalog **updates** items instead of duplicating (name-only dedup breaks when a shop
   renames an item). **Migration + dedup-by-external_ref = the main new code.**
2. **Square field-mapping hints.** Extend the mapping service's service-field guide so Square headers map well out of the
   box: `Item Name → serviceName`, `Description → description`, `Categories`/`Reporting Category → category`,
   `Price → priceUsd`, `Token → externalRef`, `Archived`/`Sellable`/`Square Online Item Visibility → active`.
3. **Square data quirks (parser/validation):**
   - **`Price = "variable"`** — non-numeric, and `shop_services.price_usd` is NOT NULL. Options: import at **0** flagged
     "quote/variable" (recommended — the shop sets it later) vs. skip the row. Don't hard-fail the import.
   - **Archived / visibility → `active`** — `Archived=Y` or `Square Online Item Visibility=hidden/unavailable` → import as
     `active=false` (recommended) rather than dropping, so history is preserved.
   - **Item vs. variation rows** — most repair items are single-variation (`Variation Name=Regular`); v1 treats one row =
     one service. Multi-variation items (rare here) would import as separate services — acceptable for v1, note it.
   - **Category normalization** — Square categories ("Game Console Repairs", "Accessories") are free text; the mapping
     service normalizes unknowns to `other_local_services`. Preserve the raw Square category as the service `category`
     text where possible so the shop's own taxonomy survives.
4. **One-click Square preset (nice-to-have).** The pair `Token` + `Square Online Item Visibility` is a reliable Square
   fingerprint — detect it and **pre-fill the column mapping** so the shop doesn't hand-map ~40 columns. (The AI mapping
   already handles arbitrary vendors, so a preset is a UX shortcut, not required. "Others" fall back to AI mapping.)

## Reuse summary
Reused as-is: file parser, dry-run, modes, results modal, AI mapping (shared service), routes, export, template, the
Services-tab Import button. **New code = migration (import_source/external_ref on shop_services) + external_ref dedup +
Square mapping hints + variable-price/archived handling + optional Square-detect preset.**

## Effort
~0.5–1 dev-day. No new endpoints or UI surfaces — it's a migration + service-layer handling + mapping hints.

## Decisions
1. **Variable price** → import at 0 flagged (recommended) vs. skip.
2. **Archived/hidden** → import inactive (recommended) vs. skip.
3. **Square preset auto-detect** now vs. rely on AI mapping first (recommended: ship the migration + hints first; add the
   one-click preset if hand-mapping proves annoying).
4. **Where surfaced — CONFIRMED:** the existing **Import** button on the shop **Services** tab (`/shop?tab=services`,
   `ServicesTab.tsx`, next to Export/+). No new UI surface — the Square handling goes behind that button + its
   `ServiceImportModal`. (v1 = customers on the Customers tab, services on the Services tab; a unified import hub was
   considered and declined.)
