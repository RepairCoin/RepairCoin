# Service Secondary Images Upload

## Status: Not Started

## Priority: Medium

## Type: Feature / Enhancement

## Summary

Allow shops to upload multiple images per service: one primary image (existing behavior) plus up to N secondary images. Customers see a richer visual experience on service detail pages and in the marketplace; shops can showcase angles, before/after, or related products without compressing them into one composite image.

---

## Background — current state

The codebase today supports **one image per service**:

| Layer | Schema |
|---|---|
| **DB** (`shop_services`, migration 036) | `image_url VARCHAR(500)` — single column, one image |
| **Backend API** (`backend/src/domains/ServiceDomain/`) | Returns/accepts a single `imageUrl` string on create/update |
| **Frontend types** (`frontend/src/services/api/services.ts`) | `imageUrl?: string` on `ShopService`, `CreateServiceData`, `UpdateServiceData` |
| **Frontend uploader** (`frontend/src/components/shop/ImageUploader.tsx`) | Uploads one image at a time to DigitalOcean Spaces |
| **Frontend Visuals section** (`frontend/src/components/shop/service/ServiceForm.tsx`) | Single `<ImageUploader>` for the service photo |

Note: `images?: string[]` in `services.ts` exists but is for **service reviews** (customers attaching photos to their review) — unrelated to shop service images.

---

## Goal

Add support for **primary image + up to 4 secondary images per service** (configurable cap). End-to-end:

1. DB column to persist the array
2. Backend create/update endpoints accept and return the secondary images list
3. Frontend service create/edit form supports adding/removing/reordering secondary images
4. Customer-facing service detail page displays primary + a thumbnail strip / gallery of secondary images
5. Service marketplace cards optionally show a "+N images" indicator on hover

---

## Out of scope (defer if scope creep)

- Drag-to-reorder among secondary images (use simple add/remove first)
- Per-image alt text / captions (skip for now; SEO-only concern)
- Bulk upload (multi-file dialog) — add only if user testing demands it
- Image compression / resizing on upload (existing `ImageUploader` already uploads as-is to DO Spaces; if 5MB cap matters, configure it server-side later)
- Replacing the existing primary `image_url` column with an array — keeping `image_url` as the primary preserves all existing query patterns

---

## Implementation plan

### 1. Database — migration (next available number, likely 107)

**File:** `backend/migrations/107_add_shop_services_secondary_images.sql`

```sql
-- Add secondary images array to shop_services.
-- Primary image stays in image_url (unchanged); secondary_images is everything else.
-- Cap is enforced application-side, not at DB level.

ALTER TABLE shop_services
  ADD COLUMN secondary_images TEXT[] DEFAULT '{}';

COMMENT ON COLUMN shop_services.secondary_images IS
  'Additional images beyond the primary image_url. Application caps the array length.';
```

Idempotent? Yes — `ADD COLUMN` with a default is safe to re-run via the existing migration runner.

### 2. Backend — service repository + controller

**File:** `backend/src/repositories/ShopServiceRepository.ts` (or wherever the service queries live)

Update the service queries to:
- `SELECT` includes `secondary_images`
- `INSERT` writes `secondary_images` (default `'{}'` if not provided)
- `UPDATE` writes `secondary_images` when present in payload

**File:** `backend/src/domains/ServiceDomain/controllers/ServiceController.ts`

Update `createService` and `updateService`:
- Accept optional `secondaryImages: string[]` in request body
- Validate: max length (5), each entry max 500 chars, must be HTTPS URL, must be from a trusted host (DO Spaces / our CDN domain) to prevent SSRF / arbitrary external images
- Pass through to repository

**Validation rule:**

Use a shared helper instead of a hardcoded regex so the allowlist stays in sync with the actual `ImageStorageService` upload destinations across environments (staging vs prod use different buckets / regions).

**File:** `backend/src/utils/imageUrlValidator.ts` (new helper)

```typescript
// Build the allowlist once at startup from the same env vars ImageStorageService uses
// to PRODUCE upload URLs (see backend/src/services/ImageStorageService.ts:184-187).
// This stays correct across staging/prod/dev automatically.
const ALLOWED_IMAGE_URL_PREFIXES = (() => {
  const prefixes: string[] = [];
  if (process.env.DO_SPACES_CDN_ENDPOINT) {
    // e.g. https://repaircoinstorage.sfo3.cdn.digitaloceanspaces.com
    prefixes.push(process.env.DO_SPACES_CDN_ENDPOINT);
  }
  if (process.env.DO_SPACES_REGION && process.env.DO_SPACES_BUCKET) {
    // e.g. https://sfo3.digitaloceanspaces.com/repaircoinstorage
    prefixes.push(
      `https://${process.env.DO_SPACES_REGION}.digitaloceanspaces.com/${process.env.DO_SPACES_BUCKET}`
    );
  }
  return prefixes;
})();

export const isValidUploadedImageUrl = (url: string): boolean => {
  if (typeof url !== 'string' || url.length > 500) return false;
  return ALLOWED_IMAGE_URL_PREFIXES.some(prefix => url.startsWith(`${prefix}/`));
};
```

**Use in controller:**

```typescript
import { isValidUploadedImageUrl } from '../../../utils/imageUrlValidator';

const MAX_SECONDARY_IMAGES = 4; // primary + 4 = 5 total

if (secondaryImages !== undefined) {
  if (!Array.isArray(secondaryImages) || secondaryImages.length > MAX_SECONDARY_IMAGES) {
    return res.status(400).json({ error: 'Invalid secondaryImages payload' });
  }
  if (!secondaryImages.every(isValidUploadedImageUrl)) {
    return res.status(400).json({ error: 'secondaryImages must be uploaded image URLs' });
  }
}
```

**Bonus: tighten the existing primary `image_url` field with the same helper.** Today it accepts any string the frontend sends — a pre-existing SSRF/XSS risk (low severity since URL is rendered in `<img src>` and not fetched server-side, but still bad practice). 5-minute add to close the gap in the same PR:

```typescript
if (imageUrl !== undefined && imageUrl !== '' && !isValidUploadedImageUrl(imageUrl)) {
  return res.status(400).json({ error: 'imageUrl must be an uploaded image URL' });
}
```

### 3. Frontend — types

**File:** `frontend/src/services/api/services.ts`

Add to all three interfaces:

```typescript
export interface ShopService {
  // ... existing fields
  imageUrl?: string;
  secondaryImages?: string[];   // NEW
}

export interface CreateServiceData {
  // ... existing fields
  imageUrl?: string;
  secondaryImages?: string[];   // NEW
}

export interface UpdateServiceData {
  // ... existing fields
  imageUrl?: string;
  secondaryImages?: string[];   // NEW
}
```

### 4. Frontend — `SecondaryImagesUploader.tsx` (new component)

**File:** `frontend/src/components/shop/service/SecondaryImagesUploader.tsx`

Wraps the existing `ImageUploader` for each slot. Renders:
- Existing thumbnails as a horizontal grid (small images with X button to remove)
- A trailing "+ Add Secondary Image" tile (uses `ImageUploader` for upload)
- Hide the trailing tile when length === MAX (4)

Props:
```typescript
interface SecondaryImagesUploaderProps {
  images: string[];
  maxImages?: number; // default 4
  onChange: (images: string[]) => void;
}
```

Implementation notes:
- Each thumbnail is `aspect-square` ~80px, rounded, with hover overlay showing the X button
- The "+ Add" tile uses a hidden `<ImageUploader>` triggered by clicking the tile; on `onUploadSuccess(url)`, append to the array via `onChange`
- Removing a thumbnail just filters it out of the array — DO Spaces blob is left behind (cleanup is a separate ops concern, same as current ImageUploader behavior on primary image replace)
- Disabled state when `images.length >= maxImages` — don't render the add tile

### 5. Frontend — wire into `ServiceForm.tsx`

**File:** `frontend/src/components/shop/service/ServiceForm.tsx`

Add to the Visuals section (after the existing primary `<ImageUploader>`):

```tsx
{/* 3. VISUALS */}
<div className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-3 sm:p-5">
  <h3>Visuals</h3>

  {/* Primary image — existing */}
  <ImageUploader ... />

  {/* Secondary images — NEW */}
  <div className="mt-4">
    <p className="text-xs text-gray-500 mb-2">
      Recommended: 800×600px service image
    </p>
    <SecondaryImagesUploader
      images={formData.secondaryImages || []}
      onChange={(images) => handleChange('secondaryImages', images)}
    />
  </div>
</div>
```

Also extend the `formData` initial state in `ServiceForm`:

```tsx
const [formData, setFormData] = useState<CreateServiceData>({
  // ... existing
  secondaryImages: initialData?.secondaryImages || [],
});
```

### 6. Frontend — `ServiceFormPreview.tsx` polish (optional)

If the design wants the live preview to show all images, add a "+N more" indicator below the main thumbnail, or a small horizontal strip of the first 2-3 secondaries. Skip if the designer hasn't asked for it.

### 7. Customer-facing display — service detail page

**File:** `frontend/src/components/customer/ServiceDetailClient.tsx` (or wherever the customer service detail page lives)

Add an image gallery beneath the primary image: thumbnail strip that swaps the main display when clicked. Use the existing image components if there's a gallery pattern in the codebase; otherwise a simple `<div className="grid grid-cols-4 gap-2">` of clickable thumbnails works.

If the marketplace card (`ShopServiceCard.tsx` or similar) wants a "+N images" badge, add it conditionally:

```tsx
{(service.secondaryImages?.length ?? 0) > 0 && (
  <span className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
    +{service.secondaryImages!.length} photos
  </span>
)}
```

---

## File map

### NEW

```
backend/migrations/
  └── 107_add_shop_services_secondary_images.sql

frontend/src/components/shop/service/
  └── SecondaryImagesUploader.tsx
```

### EDITED

```
backend/src/repositories/ShopServiceRepository.ts
  → Include secondary_images in SELECT/INSERT/UPDATE queries

backend/src/domains/ServiceDomain/controllers/ServiceController.ts
  → Accept + validate + persist secondaryImages on create/update

frontend/src/services/api/services.ts
  → Add secondaryImages?: string[] to ShopService / CreateServiceData / UpdateServiceData

frontend/src/components/shop/service/ServiceForm.tsx
  → Add SecondaryImagesUploader inside the Visuals section
  → Seed formData.secondaryImages from initialData

frontend/src/components/customer/ServiceDetailClient.tsx
  → Render image gallery (primary + secondary thumbnails)

frontend/src/components/customer/ShopServiceCard.tsx (or similar marketplace card)
  → Optional: "+N photos" badge
```

### UNTOUCHED

- `frontend/src/components/shop/ImageUploader.tsx` — reused as-is for each slot
- All existing service-related queries / migrations / API contracts (the new column is additive)
- `image_url` primary column — keeps its existing role and behavior

---

## Tasks

| # | Task | Effort |
|---|---|---|
| 1 | Migration 107 — add `secondary_images TEXT[]` column | ~5 min |
| 2 | Backend repository + controller — accept/persist/return secondaryImages with validation | ~30-45 min |
| 3 | Frontend types — extend `ShopService` / `CreateServiceData` / `UpdateServiceData` | ~10 min |
| 4 | New `SecondaryImagesUploader` component | ~1.5-2 hr |
| 5 | Wire into `ServiceForm` Visuals section | ~30 min |
| 6 | Customer service detail page — gallery | ~1 hr |
| 7 | Optional: marketplace card "+N photos" badge | ~15 min |
| 8 | Testing — round-trip create/edit/delete with multiple images | ~30 min |
| **Total** | | **~4-5 hours** |

---

## Testing checklist

### Backend

- [ ] Migration 107 runs cleanly on a fresh DB and on an existing DB with services
- [ ] `POST /api/services` with `secondaryImages: ['url1', 'url2']` persists both
- [ ] `POST /api/services` with `secondaryImages: []` persists empty array
- [ ] `POST /api/services` without `secondaryImages` defaults to empty array
- [ ] `PUT /api/services/:id` with new `secondaryImages` overwrites the old array
- [ ] `PUT /api/services/:id` with `secondaryImages` omitted leaves the existing array unchanged (be explicit about which behavior — overwrite or merge)
- [ ] Validation: 5+ images returns 400
- [ ] Validation: non-HTTPS URL returns 400
- [ ] Validation: URL not from DO Spaces / our CDN returns 400
- [ ] `GET /api/services/:id` returns `secondaryImages: string[]`

### Frontend

- [ ] Service create page renders Visuals section with primary uploader + empty secondary slot
- [ ] Adding a secondary image uploads to DO Spaces, appends to the thumbnail row
- [ ] Removing a secondary image disappears from the row, persists on save
- [ ] Reaching max (4 secondary) hides the "+ Add Secondary Image" tile
- [ ] Service edit page pre-fills with existing secondary images
- [ ] Service detail page (customer-facing) shows gallery
- [ ] Marketplace card shows "+N photos" badge when applicable

### Smoke tests

- [ ] Existing services without secondary images keep working (no regressions)
- [ ] Save + reload edit page — secondary images persist
- [ ] Delete a service — no orphan rows / errors

---

## Rollback plan

Each layer is independently revertable.

| Layer | Rollback |
|---|---|
| Migration 107 | `ALTER TABLE shop_services DROP COLUMN secondary_images` (data loss for whatever was uploaded — accept it during testing) |
| Backend changes | `git revert` the controller/repo commit. Frontend keeps sending `secondaryImages` but backend ignores it; no error. |
| Frontend types | `git revert` the type extension. Existing UI keeps working. |
| `SecondaryImagesUploader` component | `git revert` removes the component. Visuals section stays as primary-only. |
| ServiceForm wire-up | `git revert` removes the SecondaryImagesUploader render. Form still saves; secondary array sent as undefined → backend stores empty. |
| Customer gallery | `git revert` removes the gallery render. Customer sees primary image only (current behavior). |

The safest order to ship is: migration → backend → frontend types → component → ServiceForm wire-up → customer gallery. That way each step is forward-compatible: a half-shipped state is "old behavior + extra column" rather than "broken UI."

---

## Open questions before starting

- **Max count cap:** 4 secondary images (so 5 total) is a reasonable default, but confirm with design. Adjust the constant in one place.
- **Reorder on edit:** v1 spec is "remove + re-add at the end" — no drag-to-reorder. Verify this is OK for the design.
- **Behavior when `secondaryImages` is omitted in `PUT`:** should it leave the existing array alone (merge) or clear it (overwrite)? Convention in this codebase tends toward "explicit only — omitted means leave alone," but verify against how other update endpoints behave (e.g., does omitting `tags` clear them?).
- **Cleanup of orphan blobs in DO Spaces:** when a secondary image is removed from a service, the DO Spaces blob is left behind. Same as the existing primary-image-replace behavior. Document or leave as-is — separate ops task either way.

---

## Suggested next action

Start with **Task 1** (migration 107) — it's a 5-minute change and unblocks everything else. After it ships through `main` → `prod` and the column exists, the backend + frontend can land in any order without breaking each other.
