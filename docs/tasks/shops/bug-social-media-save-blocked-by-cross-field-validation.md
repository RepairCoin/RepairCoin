# Bug: Social Media Settings Save Blocked by Cross-Field Validation

**Status:** open
**Priority:** medium
**Date:** 2026-04-01
**Platform:** Web (Next.js)
**Affects:** Shop role — Settings > Social Media

---

## Summary

When a shop owner enters a social media URL (e.g., Twitter) and clicks "Save Changes", the save fails if any other field (e.g., website) contains an invalid URL. The validation loops through ALL fields and blocks the entire save if ANY field is invalid, even if the user only changed one field.

---

## Root Cause: All-or-Nothing Validation Before Save

**File:** `frontend/src/components/shop/SocialMediaSettings.tsx` (lines 123-129)

```typescript
const handleSave = async () => {
  // Validate all URLs
  for (const [platform, url] of Object.entries(links)) {
    if (url && !validateUrl(url, platform)) {
      return;  // blocks entire save
    }
  }
  // ... save logic
};
```

The `handleSave` function validates ALL 8 fields (facebook, instagram, x, linkedin, youtube, website, tiktok, pinterest) before saving. If any field has a previously saved invalid URL or a partially entered value, the entire save is blocked — even for unrelated fields the user just updated.

**Scenario:**
1. Shop has `website` field with an invalid or partially entered URL (e.g., `repaircoin.app` without `https://`)
2. User enters a valid Twitter URL: `http://x.com/doc`
3. User clicks "Save Changes"
4. Validation loops through all fields, hits `website` → `new URL("repaircoin.app")` throws → toast error "Invalid URL for website"
5. Save is blocked — Twitter URL is NOT saved
6. User sees error about website even though they only changed Twitter

---

## Fix Options

### Option A: Only validate changed fields (Recommended)

Only validate fields that differ from `originalLinks`:

```typescript
const handleSave = async () => {
  for (const [platform, url] of Object.entries(links)) {
    // Only validate fields that changed
    if (url !== originalLinks[platform as keyof SocialMediaLinks]) {
      if (url && !validateUrl(url, platform)) {
        return;
      }
    }
  }
  // ... save logic
};
```

### Option B: Show per-field inline errors instead of blocking

Instead of blocking the save entirely, show inline red border + error text on the invalid field and let valid fields save.

### Option C: Auto-fix URLs missing protocol

If a URL doesn't have `http://` or `https://`, prepend `https://` automatically:

```typescript
const handleInputChange = (platform: keyof SocialMediaLinks, value: string) => {
  // Auto-prepend https:// if user types a URL without protocol
  if (value && !value.startsWith('http://') && !value.startsWith('https://') && value.includes('.')) {
    value = 'https://' + value;
  }
  setLinks((prev) => ({ ...prev, [platform]: value }));
};
```

---

## Additional Issue: Only Non-Empty Fields Are Sent

**File:** `frontend/src/components/shop/SocialMediaSettings.tsx` (lines 136-142)

```typescript
const validFields = Object.entries(links).reduce((acc, [key, value]) => {
  if (value && value.trim()) {
    const fieldName = key === 'x' ? 'twitter' : key;
    acc[fieldName] = value.trim();
  }
  return acc;
}, {} as Record<string, string>);
```

Only non-empty fields are sent to the API. This means a shop cannot **clear** a social media link once set — if they delete the URL and save, the empty field is excluded from the request and the backend keeps the old value.

---

## Files to Modify

1. `frontend/src/components/shop/SocialMediaSettings.tsx` — Fix validation logic, handle field clearing

---

## Reproduction Steps

1. Login as a shop owner
2. Navigate to Settings > Social Media
3. Ensure the "Website" field has any value (even from before)
4. Enter a valid Twitter URL (e.g., `http://x.com/doc`)
5. Click "Save Changes"
6. Observe: error toast "Invalid URL for website. Please include http:// or https://"
7. Twitter URL is NOT saved despite being valid
