# Shop-vs-service AI activation UX confusion

**Status:** Patching now — filed 2026-05-27.
**Severity:** UX bug. AI doesn't fire on services that LOOK activated to the shop owner, because the shop-level master gate is admin-only and the UI doesn't communicate the dependency. Shop owners legitimately believe they've enabled AI when they haven't.

---

## Symptom

DC Shopuo shop, as observed 2026-05-27:

- Service marketplace cards (`/shop?tab=services` or similar) show green "AI enabled" badge next to 3 services
- Per-service edit page (`/shop/services/<id>?tab=ai`) shows green "Auto Sales & Booking" toggle ON
- Shop Settings → AI Assistant (`/shop?tab=settings`) shows **"AI Sales Agent: Not enabled"** badge with copy *"These are managed by RepairCoin. Contact us if you'd like them turned on or off for your shop."*

Effective AI runtime is FALSE despite both green badges. Customer chats trigger no AI replies on those services. Shop owner has no UI signal that their service-level configuration is being silently ignored.

## Root cause

Two-layer gate by design (`SettingsController.ts:10-12`):

```
effective_ai = shop.active
            AND ai_shop_settings.ai_global_enabled    ← admin-only
            AND service.active
            AND service.ai_sales_enabled               ← shop-owner
```

The architecture is intentional — admin gates the platform-level AI enablement (cost control), shop owner picks per-service (workflow control). The flaw is the UI surfaces those layers independently with no cross-reference:

- Service pages show service-level state truthfully
- Settings page shows shop-level state truthfully
- **Nothing tells the shop owner: "your service-level setting isn't taking effect because shop-level is off"**

## Fix — Option A + C (applied 2026-05-27)

Two layers, matches where the shop owner would look.

### Option A — service marketplace badge state

When `ai_global_enabled = false`, the AI badge on the service marketplace card renders gray instead of green, with tooltip text *"Shop AI not yet activated"*. Card stays functional; visual cue is honest.

### Option C — banner on per-service AI tab

When `ai_global_enabled = false`, a yellow banner appears at the top of the per-service AI Assistant tab: *"Your shop's AI is not activated. Any AI settings here won't take effect yet — contact RepairCoin support to turn it on."*

The banner is dismissable-no; it stays visible until the underlying state changes.

### Option B (NOT applied)

Disabling the service AI toggle itself was rejected — shop owners can legitimately configure their per-service preferences ahead of time even while shop-level is off. Stripping that control would be more annoying than the current confusion. Visual cue is the right intervention; data-control is not.

## Frontend implementation notes

- Need to fetch `ai_global_enabled` state from `GET /api/ai/settings` (existing endpoint per `SettingsController.ts`) and surface it to both the service marketplace component and the per-service AI tab component.
- Cache the value at a per-session scope; refetch on shop dashboard mount. Don't refetch per-card render.
- Optional: subscribe to a `shop:ai_settings_changed` event for live updates (not in this PR's scope).

## Verification (manual)

After deploy:
1. As DC Shopuo (currently `ai_global_enabled = false`): visit service marketplace → AI badges show gray + tooltip
2. Visit a service's AI Assistant tab → yellow banner at top
3. Activate `ai_global_enabled` via admin tab → badges turn green, banner disappears on next page load
4. Toggle off again → revert visual state

## Out of scope

- Live in-page updates without page refresh after admin flips the state — defer to v1.5
- A "Request AI activation" button that emails support automatically — separate UX feature
- Restructuring the whole admin-vs-shop ownership model — keep the two-layer gate; just communicate it better
