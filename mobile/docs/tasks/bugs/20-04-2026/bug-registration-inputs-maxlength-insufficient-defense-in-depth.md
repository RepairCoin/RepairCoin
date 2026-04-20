# Bug: Registration form `maxLength` relies only on native prop — insufficient defense against real input vectors

**Status:** Open
**Priority:** High
**Est. Effort:** 3-4 hours (3 PRs)
**Created:** 2026-04-20
**Updated:** 2026-04-20

---

## Problem

The existing fix for unlimited-length registration inputs (`completed/bug-registration-inputs-no-max-length.md`, commit `672397c8`) applied `maxLength={N}` props at JSX call sites and explicitly stated *"no extra JS truncation is needed"* on the assumption that React Native's native `maxLength` caps both typing and paste on both platforms.

That assumption is wrong. Native `maxLength` is a UX affordance, not a data-integrity control. Multiple real input paths write text directly to React state without ever passing through the native `InputFilter` that `maxLength` relies on. With the previous fix alone, the customer and shop registration forms can still end up with values past their intended limit — and the form will submit them because there is no JS-layer enforcement anywhere else.

Affects:

- Customer registration — Full Name (100), Email (255), Referral Code (50)
- Shop registration (all slides) — First/Last Name (100), Company Name (150), Email (255), Website (255), Referral (100), Facebook/Instagram/Twitter/X URLs (255 each)

This task replaces the previous fix's approach with a defense-in-depth architecture. The previous task doc is superseded.

---

## Analysis

### Input vectors that bypass native `maxLength`

The native `maxLength` prop is enforced by Android's `EditText.InputFilter` (and the iOS equivalent). Any text path that does not flow through that filter is not capped. The following vectors are confirmed to bypass it, ranked by real-world likelihood in our user base.

#### Tier 1 — high likelihood, real users will hit these

| # | Vector | Why it bypasses |
|---|---|---|
| 1 | **Android Autofill / password managers** (Google Autofill, Samsung Pass, 1Password, Bitwarden, LastPass) | Fills via `AutoFillService` / `AccessibilityNodeInfo` — writes directly to `EditText.setText()`, skipping the `InputFilter` chain. |
| 2 | **Google Sign-In email prefill** (already live in this codebase, commit `467a453f feat(mobile): pre-populate email from Google sign-in in registration forms`) | Calls `updateFormData("email", account.email)` in React. Never touches the TextInput at all. A Google account with a long email overflows the 255 cap silently. |
| 3 | **Keyboard suggestion taps / autocomplete** (Gboard, SwiftKey) | Suggestion is inserted as one text-replacement event. Android commits the whole word across the boundary on some versions before trimming. |
| 4 | **Voice / dictation input** (Google Assistant, iOS Dictation, Bixby) | Multi-word segments are committed at once via a separate pathway. Known to bypass `InputFilter` on Android < 12 and some OEM builds. |
| 5 | **Swipe / glide typing** | Whole swiped word is inserted atomically — same boundary-crossing issue as suggestions. |
| 6 | **Emoji & grapheme clusters** | `maxLength` counts UTF-16 code units, not user-perceived characters. Flag emoji (🇵🇭 = 4 UTF-16 units), skin-tone modifiers, and ZWJ sequences make the cap arbitrary. |
| 7 | **Future dev adds `FormInput` without `maxLength`** | No compile-time guarantee. Easy to miss on review. Current fix relies on 14+ correct sprinkles across the codebase forever. |

#### Tier 2 — real but less frequent

| # | Vector | Why |
|---|---|---|
| 8 | **Paste in the middle of an existing value** (cursor at position 50, paste 200 chars) | Some Android EditText builds don't compute `remaining = maxLength - currentLength` correctly on mid-string insert. |
| 9 | **IME composition** (Chinese/Japanese/Korean input) | Composed text is committed as a block post-filter; documented RN issue. |
| 10 | **Drag-and-drop text** (Samsung DeX, iPad multitasking, Android 7+) | Drop writes via `ClipData` paths that some RN versions don't route through the filter. |
| 11 | **Deep-link prefill** (hypothetical for this form, but the pattern exists elsewhere) | URL param → `setFormData` is direct-to-state. |
| 12 | **State restoration / async-storage rehydration** | If a "save draft" feature is added, restoring pushes long text into `value` without any cap. |
| 13 | **Text-replacement shortcuts** (iOS Text Replacement, Android macros) | Trigger expands to long text atomically. |

#### Tier 3 — edge cases worth knowing

Third-party non-standard keyboards, accessibility services, QA ADB scripts, RTL bidirectional markers. Not production-priority.

### Shared architectural root cause

Every Tier 1 and Tier 2 vector has the same shape: **text reaches React state through a path the native `maxLength` prop does not observe.** The previous fix trusted a single enforcement point. Robust input limiting requires enforcement at multiple layers.

### Why the button stays enabled past the cap

`mobile/feature/register/hooks/ui/useCustomerRegister.ts:32`:

```ts
const isFormValid = useMemo(() => {
  return hasMinLength(formData.fullName, 2) && isValidEmail(formData.email);
}, [formData.fullName, formData.email]);
```

`mobile/feature/register/utils/validation.ts:55` — `validateCustomerForm` only checks required + `hasMinLength(fullName, 2)`. There is no `hasMaxLength` helper, and no max check in any of the shop slide validators either (`validateShopFirstSlide`, `validateShopSecondSlide`, `validateShopThirdSlide`, `validateShopSocialMediaSlide`). If a bypass vector puts 500 chars in state, the Create Account / Next button stays active and submission proceeds.

### Layers required for full defense

| Layer | Where | Catches |
|---|---|---|
| 1. Native prop (keep) | JSX call site: `maxLength={100}` | Happy-path typing and simple paste |
| 2. FormInput middleware | `mobile/shared/components/ui/FormInput.tsx` — wrap `onChangeText` | Autofill, voice, suggestions, mid-paste, swipe, emoji overflow, IME — anything that writes through React's `onChangeText` |
| 3. State-layer guard | `updateFormData` in `useCustomerRegister.ts` and `useShopRegister.ts` | Google prefill, deep links, state restoration, any direct `setFormData` call |
| 4. Form validation | `validateCustomerForm` + 4 shop slide validators + mirror in `isFormValid` | Last-chance UI block before submit; provides user-visible error if all UI caps failed |
| 5. Backend validation | Customer register + shop register endpoints | Non-mobile clients, future mobile regressions, malicious bypasses |

Layer 2 alone covers ~80% of real vectors with one 5-line change. Layer 2 + 3 + 4 closes the remaining state-level gap. Layer 5 is mandatory for any string backed by a `VARCHAR(N)` column and belongs on the backend side regardless.

---

## Implementation

### Approach

Ship in three independent PRs so each can land and be verified without waiting on the others.

### PR #1 — FormInput middleware (Layer 2)

**File:** `mobile/shared/components/ui/FormInput.tsx`

Wrap `onChangeText` so that when a `maxLength` is present, the text is truncated before being forwarded to the parent:

```tsx
const handleChange = (text: string) => {
  const capped =
    typeof rest.maxLength === "number" && text.length > rest.maxLength
      ? text.slice(0, rest.maxLength)
      : text;
  onChangeText(capped);
};
// ...
<TextInput
  // ...existing props
  onChangeText={handleChange}
  {...rest}
/>
```

Scope: every `FormInput` usage across the app inherits the protection — customer reg, all 4 shop slides + social media slide, edit-profile screens, service creation, bug reports, and any future call sites. No per-screen work required.

### PR #2 — Shared field limits + state guards + validators (Layers 3 + 4)

**New file:** `mobile/shared/constants/field-limits.ts`

```ts
export const FIELD_LIMITS = {
  FULL_NAME: 100,
  FIRST_NAME: 100,
  LAST_NAME: 100,
  COMPANY_NAME: 150,
  EMAIL: 255,
  WEBSITE: 255,
  SOCIAL_URL: 255,
  SHOP_REFERRAL: 100,
  CUSTOMER_REFERRAL_CODE: 50,
} as const;
```

Every layer (call-site `maxLength`, state truncation, JS validator, and ideally the backend) must import from this single source of truth. Drift across layers is how the previous fix became inadequate.

**File:** `mobile/feature/register/hooks/ui/useCustomerRegister.ts`

Change `updateFormData` to truncate via a per-field map:

```ts
const FIELD_MAX: Record<keyof CustomerFormData, number> = {
  fullName: FIELD_LIMITS.FULL_NAME,
  email: FIELD_LIMITS.EMAIL,
  referral: FIELD_LIMITS.CUSTOMER_REFERRAL_CODE,
};

const updateFormData = useCallback(
  (field: keyof CustomerFormData, value: string) => {
    const max = FIELD_MAX[field];
    const next = max && value.length > max ? value.slice(0, max) : value;
    setFormData((prev) => ({ ...prev, [field]: next }));
  },
  [],
);
```

**File:** `mobile/feature/register/hooks/ui/useShopRegister.ts`

Same pattern with the shop field map. Confirm the exact shape of `ShopFormData` and include every string field.

**File:** `mobile/feature/register/utils/validation.ts`

Add the helper and apply to all validators:

```ts
export const hasMaxLength = (value: string, maxLength: number): boolean =>
  value.trim().length <= maxLength;

// validateCustomerForm
if (!hasMaxLength(fullName, FIELD_LIMITS.FULL_NAME))
  errors.push(`Full name must be ${FIELD_LIMITS.FULL_NAME} characters or fewer`);
if (!hasMaxLength(email, FIELD_LIMITS.EMAIL))
  errors.push(`Email must be ${FIELD_LIMITS.EMAIL} characters or fewer`);

// validateShopFirstSlide — same pattern for firstName, lastName, email
// validateShopSecondSlide — companyName, website, referral
// validateShopThirdSlide — address, city, country (confirm limits)
// validateShopSocialMediaSlide — all 4 social URLs
```

Update `isFormValid` in both hooks to mirror the validator — either check max explicitly or just compute `validate*Form(...).length === 0`.

### PR #3 — Backend validation (Layer 5)

**Scope:** backend repository, separate PR.

- Enforce max-length on all user-controlled string fields in customer register (`POST /api/auth/check-user` + customer create) and shop register endpoints.
- Return `400` with a clear error; do not silently truncate.
- Limits must match `FIELD_LIMITS` in the mobile app and the DB `VARCHAR` column definitions. If any of these three is inconsistent, that's a separate bug to reconcile first.

---

## Files to Modify

| File | PR | Change |
|---|---|---|
| `mobile/shared/components/ui/FormInput.tsx` | #1 | Wrap `onChangeText` to truncate at `rest.maxLength` |
| `mobile/shared/constants/field-limits.ts` (new) | #2 | Single source of truth for all max-length values |
| `mobile/feature/register/hooks/ui/useCustomerRegister.ts` | #2 | Per-field max map, truncate in `updateFormData`, mirror max checks in `isFormValid` |
| `mobile/feature/register/hooks/ui/useShopRegister.ts` | #2 | Same pattern with shop field map |
| `mobile/feature/register/utils/validation.ts` | #2 | Add `hasMaxLength` helper; apply to `validateCustomerForm`, `validateShopFirstSlide`, `validateShopSecondSlide`, `validateShopThirdSlide`, `validateShopSocialMediaSlide` |
| Backend customer register handler | #3 | Server-side max-length validation with explicit 400 response |
| Backend shop register handler | #3 | Same |

---

## Verification Checklist

### PR #1 — FormInput middleware

- [ ] Customer registration: pasting 500 chars into Full Name results in exactly 100 chars in state
- [ ] Customer registration: holding a key to repeat-type past 100 chars stops at 100
- [ ] Shop registration: same for First Name / Last Name / Company Name / Website / Social URLs / Referral
- [ ] Typing within limit (e.g., 50 chars) works normally — no false truncation
- [ ] Fields without `maxLength` prop still accept unlimited input (no regression for optional/no-limit fields elsewhere in the app)

### PR #2 — State guards + validators + constants

- [ ] Google Sign-In prefill: signing in with a Google account whose email is > 255 chars results in a 255-char email in `formData`, not the full string
- [ ] Calling `updateFormData("fullName", longString)` directly (verified by a dev-tool/inline test) stores only the first 100 chars
- [ ] If a 500-char value somehow enters state (simulate by bypassing the state guard in a test), `validateCustomerForm` returns a user-visible error and `isFormValid` is `false` — Create Account button is disabled
- [ ] Same three checks applied to each shop slide (`validateShopFirstSlide`, `validateShopSecondSlide`, `validateShopThirdSlide`, `validateShopSocialMediaSlide`) and `isFormValid` on shop register
- [ ] `FIELD_LIMITS` constants match the DB column definitions (cross-check with backend migrations / schema)

### PR #3 — Backend validation

- [ ] POSTing a customer register payload with 500-char name returns `400` with an explicit max-length error, not a truncated success
- [ ] Same for shop register payloads across all fields
- [ ] Backend limits match `FIELD_LIMITS` and DB column definitions (three-way consistency check)

### Cross-cutting QA (tester profile APK, real device)

- [ ] **Autofill test:** register with 1Password / Google Autofill filling a long value — final saved value is capped
- [ ] **Voice input test:** dictate a long sentence into Full Name — capped
- [ ] **Keyboard suggestion test:** tap suggestions at the boundary — total never exceeds cap
- [ ] **Swipe typing test:** swipe long words past the boundary — capped
- [ ] **Mid-string paste test:** position cursor at 50 chars, paste 200 chars — total is exactly 100
- [ ] **Emoji test:** paste 50 flag emojis — behaves consistently (either blocks earlier by code-unit count, or truncates mid-emoji — document whichever is chosen)
- [ ] **Submit test:** in every case, tapping Create Account / Next succeeds only with values within limits; over-limit values surface a validation error

---

## Notes

- **Supersedes:**
  - `mobile/docs/tasks/bugs/15-04-2026/bug-no-max-length-on-registration-inputs.md` — the original QA report. That doc recommended both (A) native `maxLength` props AND (B) `hasMaxLength` checks in `validation.ts` ("use both"). Commit `672397c8` implemented only Option A, leaving Option B and the broader input-vector coverage unaddressed. All remaining work from that doc is captured here.
  - `mobile/docs/tasks/completed/bug-registration-inputs-no-max-length.md` (commit `672397c8`, 2026-04-16) — the mirror doc created alongside the partial fix. Its guiding claim — *"React Native's TextInput maxLength caps both typing and paste operations natively, so no extra JS truncation is needed"* — is incorrect for any input path that bypasses the native `InputFilter`. The previous doc's Tier 1 verification (typing and paste from clipboard) does not exercise autofill, voice, prefill, or suggestions, which is why it passed QA despite the fix being incomplete.

- **Architectural principle (include in code comments and future docs):** Native `maxLength` is a UX affordance, not a data-integrity control. Any field with a backing database `VARCHAR(N)` constraint needs enforcement at the state layer AND the validation layer AND the backend, not just the TextInput prop.

- **Out of scope for this task (file follow-ups):**
  - Audit every other `FormInput` / raw `TextInput` usage in the app (edit-profile screens, service creation, booking notes, messaging, bug reports) for the same issue. Filed as a separate `enhancements/` task once PR #1 lands so we can batch the audit against the hardened component.
  - Component/integration test harness that pastes 500 chars into each form field in CI. Belongs in a test-infrastructure task.
  - Reconcile `FIELD_LIMITS` with existing backend validators if they drift. Do this as part of PR #3.

- **Rollout order:** PR #1 first — lowest risk, highest immediate value, unblocks QA for Tier 1 vectors. PR #2 second — requires coordinated testing on both customer and shop flows. PR #3 third — can proceed in parallel with PR #2 since it's a different codebase.

- **No new mobile APK is needed until PR #1 lands on `main`.** Staging rebuild after PR #1 merge; production rebuild after PR #1 reaches `origin/prod`.
