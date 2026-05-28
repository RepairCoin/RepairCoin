# Admin AI-toggle contrast fix

**Status:** Not started — picked up by next session.
**Filed:** 2026-05-26.
**Symptom seen on:** `/admin?tab=ai-agent` (`AdminAISettingsTab`).
**Severity:** UX bug — toggles ARE wired up correctly and work when clicked, but they're invisible in the off state so admins can't see them to click.

---

## Symptom

On the admin AI Agent tab (`/admin?tab=ai-agent`), the per-shop table renders the "AI Sales Agent" and "Follow-up Nudges" columns as empty cells when the toggle is off. Admins see this list:

| Shop | AI Sales Agent | Follow-up Nudges | Monthly Budget | Spent |
|---|---|---|---|---|
| AutoTest Repair Shop | _(looks empty)_ | _(looks empty)_ | $20 | $0.00 |
| RepairCoin | _(looks empty)_ | _(looks empty)_ | $20 | $0.55 |
| … |

— and conclude the UI isn't shipped. It IS shipped; the controls are just invisible.

## Root cause

`frontend/src/components/ui/switch.tsx:14` styles the off-state track with `data-[state=unchecked]:bg-input` and the thumb with `bg-background`. Both are shadcn theme tokens.

On this app's dark theme:
- `--input` resolves to a dark gray
- `--background` resolves to near-black

The off-state switch on a `bg-[#101010]` row is gray-on-near-black with very low contrast — visually empty at normal zoom.

This is the **same root cause as PR #391** (cancellation modal contrast). Shadcn theme tokens don't render with sufficient contrast on this app's specific dark theme. Memory note: `feedback_shadcn_first` says to check shadcn first, but the pattern is "use shadcn primitives and override contrast when the dark theme washes them out."

## Recommended fix — Option A (scoped)

Override the off/on track colors on the two Switch instances inside `AdminAISettingsTab.tsx`:

**Edit 1 — `AdminAISettingsTab.tsx:204-209`** (AI Sales Agent switch):
```tsx
<Switch
  checked={shop.aiGlobalEnabled}
  disabled={saving}
  onCheckedChange={(v) => onUpdate(shop.shopId, { aiGlobalEnabled: v })}
  className="data-[state=unchecked]:bg-gray-600 data-[state=checked]:bg-[#FFCC00]"
/>
```

**Edit 2 — `AdminAISettingsTab.tsx:213-219`** (Follow-up nudges switch):
```tsx
<Switch
  checked={shop.aiFollowupEnabled}
  disabled={saving || !shop.aiGlobalEnabled}
  onCheckedChange={(v) =>
    onUpdate(shop.shopId, { aiFollowupEnabled: v })
  }
  className="data-[state=unchecked]:bg-gray-600 data-[state=checked]:bg-[#FFCC00]"
/>
```

`bg-gray-600` (medium gray) against `bg-[#101010]` (near-black) row gives clear contrast in off state. `bg-[#FFCC00]` (brand yellow) for on-state matches the rest of the app's primary affordance.

## Alternative — Option B (global, riskier)

Update `frontend/src/components/ui/switch.tsx` to swap `data-[state=unchecked]:bg-input` → `data-[state=unchecked]:bg-gray-600` so every shadcn `Switch` in the app picks up better contrast.

**Risk:** every other Switch consumer (other admin tabs, settings forms, shop-side toggles) would change. Some may already have visual fixes layered on top via className overrides; changing the base could break those.

**Decision:** start with Option A. If we discover the same problem in 3+ places later, promote to Option B.

## Verification steps

1. Open `/admin?tab=ai-agent` as an admin.
2. Confirm the off-state switches are now visibly gray on the dark row.
3. Click one off → on. It should turn yellow, save (toast), persist across reload.
4. Click on → off. Track returns to gray.
5. Pick one shop, flip AI Sales Agent on → confirm the Follow-up Nudges switch becomes interactive (previously disabled when AI was off).
6. Spot-check: do the other shadcn Switch usages in the app still look correct? Check at least `/shop?tab=settings` (shop AI section — read-only badges, no switches there, but verify nothing else broke).

## Estimated effort

~10 minutes (2 className additions + manual verification). No tests touched. New branch: `deo/admin-ai-toggle-contrast-fix`.

## Out of scope

- Migrating to a centralized "themed switch" component
- Audit of every Switch usage in the app for similar contrast issues
- Adding visual regression tests for shadcn theme-token combinations
