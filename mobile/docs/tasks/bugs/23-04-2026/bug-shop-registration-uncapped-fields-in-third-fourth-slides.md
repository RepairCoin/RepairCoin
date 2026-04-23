# Bug: Shop registration ThirdSlide + FourthSlide fields have NO maxLength cap

**Status:** Open
**Priority:** Medium
**Est. Effort:** 10 minutes
**Created:** 2026-04-23
**Updated:** 2026-04-23

---

## Problem / Goal

The previously-closed `bug-registration-inputs-no-max-length.md` (commit `672397c8`, Khalid 2026-04-16) capped 12 registration fields across FirstSlide, SecondSlide, SocialMediaSlide, and CustomerRegisterScreen. **Five shop-registration fields were not in the original task scope and still accept unlimited characters.** Users can paste 500+ character strings into these fields today — same class of bug the previous fix addressed for other fields, just not covered.

Closing the previous doc and filing this one separately keeps tracking clean: Khalid's fix correctly applied to everything its scope required; the gap is in the scope definition, not the execution.

---

## Analysis

### Uncapped fields (shop registration only)

Verified against current code (`main` branch, 2026-04-23):

**`mobile/feature/register/components/ThirdSlide.tsx`** — Location & Wallet slide:

| Line | Field | formData key | Risk level |
|---|---|---|---|
| 82 | Street Address | `address` | Medium — pasted junk hits backend varchar on submit |
| 90 | City | `city` | Medium — same |
| 98 | Country | `country` | Medium — same |
| 140 | Connected Wallet | N/A | **NOT affected** — `editable={false}`, read-only from Thirdweb account |
| 150 | Reimbursement Address (Optional) | `reimbursementAddress` | Low — Ethereum addresses are always exactly 42 chars; validation should reject garbage, but cap would enforce earlier |

**`mobile/feature/register/components/FourthSlide.tsx`** — Review & Submit slide:

| Line | Field | formData key | Risk level |
|---|---|---|---|
| 32 | FixFlow Shop ID | `fixflowShopId` | Low-Medium — optional external reference, users typically paste short IDs |

Customer registration has no equivalent gap — `CustomerRegisterScreen.tsx` only contains 3 inputs and all 3 are already capped.

### Why these were missed in the original fix

The original task doc (`bug-registration-inputs-no-max-length.md`, 2026-04-16) enumerated fields by name:
> "Registration form fields for both shops and customers (first name, last name, email, company name, website, social media URLs, referral) accepted unlimited characters"

Khalid correctly fixed every field that was named. The scope didn't include Location/Wallet/Review-slide fields — those were discovered in later QA but weren't retroactively added to the original doc.

This is a scope-gap issue, not an execution issue. The original ticket is validly Completed because every field it enumerated was correctly capped.

---

## Implementation

### Recommended caps (align with backend varchar columns)

| Field | Recommended maxLength | Reason |
|---|---|---|
| Street Address | 255 | Typical address column; accommodates long international formats |
| City | 100 | Typical municipality name; longest real cities ~50 chars |
| Country | 100 | Handles full names like "United Kingdom of Great Britain and Northern Ireland" (54 chars) with headroom |
| Reimbursement Address | 42 | Ethereum addresses are always 42 chars (`0x` + 40 hex). Hardcoding 42 is exact, not arbitrary. |
| FixFlow Shop ID | 100 | External reference ID; reasonable cap for an optional free-form field |

**Cross-check before shipping:** confirm these values match the backend column definitions for `shops.address`, `shops.city`, `shops.country`, and `shops.reimbursement_address`. If any backend column is smaller, use the backend's size. If any is larger, the mobile cap still helps UX but flag the drift for a separate migration.

### Code change — 5 prop additions

**File:** `mobile/feature/register/components/ThirdSlide.tsx`

```diff
          <FormInput
            label="Street Address"
            icon={<Ionicons name="location-outline" size={20} color="#FFCC00" />}
            value={formData.address}
            onChangeText={(value) => updateFormData("address", value)}
            placeholder="Enter your street address"
+           maxLength={255}
          />

          <FormInput
            label="City"
            icon={<Ionicons name="business-outline" size={20} color="#FFCC00" />}
            value={formData.city}
            onChangeText={(value) => updateFormData("city", value)}
            placeholder="Enter your city"
+           maxLength={100}
          />

          <FormInput
            label="Country"
            icon={<Feather name="flag" size={20} color="#FFCC00" />}
            value={formData.country}
            onChangeText={(value) => updateFormData("country", value)}
            placeholder="Enter your country"
+           maxLength={100}
          />

          <FormInput
            label="Reimbursement Address (Optional)"
            icon={<Ionicons name="card-outline" size={20} color="#FFCC00" />}
            value={formData.reimbursementAddress}
            onChangeText={(value) => updateFormData("reimbursementAddress", value)}
            placeholder="Enter reimbursement address (0x...)"
            autoCapitalize="none"
            helperText="Where to receive payments for token redemptions"
+           maxLength={42}
          />
```

**File:** `mobile/feature/register/components/FourthSlide.tsx`

```diff
        <FormInput
          label="FixFlow Shop ID"
          icon={<Feather name="link" size={20} color="#FFCC00" />}
          value={formData.fixflowShopId}
          onChangeText={(value) => updateFormData("fixflowShopId", value)}
          placeholder="Enter FixFlow Shop ID"
          helperText="If you use FixFlow for your repair business"
+         maxLength={100}
        />
```

Do NOT touch the "Connected Wallet" FormInput in ThirdSlide:151 — it's `editable={false}` and its value comes from Thirdweb, not user input.

### Approach

Same pattern as Khalid's original fix (commit `672397c8`):
- Minimal prop additions at call sites
- No changes to `FormInput`, `TextInput`, or shared components
- Relies on React Native's native `maxLength` for typing + paste

If shipping this alongside or after `bug-registration-inputs-maxlength-insufficient-defense-in-depth.md` (2026-04-20, Open), coordinate: that doc proposes a `FIELD_LIMITS` constants file. These 5 new caps should be added there too rather than hardcoded inline, once the constants file exists. But for THIS bug in isolation, inline props are fine and match the existing pattern.

---

## Files to Modify

| File | Change |
|---|---|
| `mobile/feature/register/components/ThirdSlide.tsx` | Add `maxLength` to 4 FormInput components (street, city, country, reimbursement). Skip the read-only Connected Wallet field. |
| `mobile/feature/register/components/FourthSlide.tsx` | Add `maxLength={100}` to the FixFlow Shop ID FormInput. |

No backend changes, no shared-component changes, no test file updates.

---

## Verification Checklist

- [ ] Street Address: cannot type or paste more than 255 characters
- [ ] City: cannot type or paste more than 100 characters
- [ ] Country: cannot type or paste more than 100 characters
- [ ] Reimbursement Address: cannot paste more than 42 characters. A valid Ethereum address fits exactly (42 chars `0x...`). Pasting a 500-char garbage string is capped to 42.
- [ ] FixFlow Shop ID: cannot type or paste more than 100 characters
- [ ] Connected Wallet field (read-only) unchanged — still displays the Thirdweb wallet address
- [ ] Shop registration end-to-end flow still completes successfully for a normal user (regression check)
- [ ] Backend accepts submission with all fields at maximum allowed length (confirms backend columns support the same sizes)
- [ ] Backend column sizes confirmed to be ≥ the mobile caps (no surprise truncation on submit)

---

## Notes

- **Related closed task:** `mobile/docs/tasks/completed/bug-registration-inputs-no-max-length.md` (commit `672397c8`, 2026-04-16) — the parent task. This doc fills the scope gap noted during 2026-04-23 QA.
- **Related open task:** `mobile/docs/tasks/bugs/20-04-2026/bug-registration-inputs-maxlength-insufficient-defense-in-depth.md` — broader defense-in-depth concerns (autofill / voice / prefill bypass the native prop) for the ALREADY-capped fields. This new doc does not duplicate that work; it's orthogonal. If both land, the defense-in-depth work's `FIELD_LIMITS` constants file should absorb the 5 caps added by this doc.
- **Priority rationale:** Medium, not High. Four of the five fields (street/city/country/shop-id) store free-form text with moderate paste-abuse risk but no immediate data-integrity failure (backend varchar truncates silently OR rejects with 400). The reimbursement address cap at 42 is mostly UX polish since Ethereum validation rejects garbage values anyway. Ship with the next registration-area maintenance pass; no user-facing urgency.
- **Low-effort win:** the 5 additions are a 5-line mechanical change. If someone opens any of these files for an unrelated task, they can bundle this fix without friction.
- **Known scope boundary:** This doc is about registration ONLY. Profile-edit screens, shop settings, and any other post-registration UIs where the same fields might appear are NOT in scope — they should be audited separately (see the 2026-04-16 doc's "Follow-up not in scope" note).
