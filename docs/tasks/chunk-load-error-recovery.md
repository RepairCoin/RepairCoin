# ChunkLoadError Automatic Recovery

## Priority: High
## Status: Completed
## Assignee: Frontend Developer
## Completed Date: January 21, 2026

## Problem

Users on the live site (repaircoin.ai) frequently encounter ChunkLoadError crashes that display a generic "Oops! Something went wrong" error page. This happens when:

1. New deployment uploads chunks with different hashes
2. User's browser has cached old HTML/manifest pointing to non-existent chunks
3. CDN serves stale manifest but new chunks (or vice versa)
4. Network timeout while loading JavaScript chunks

This creates a poor user experience and makes the site appear broken.

## Error Example

```
ChunkLoadError: Loading chunk 61831 failed.
(timeout: https://www.repaircoin.ai/_next/static/chunks/bd904a5c.555985b702efecf3.js...)
```

## Solution Implemented

Enhanced `ErrorBoundary` component with automatic ChunkLoadError detection and recovery.

### Features Added

| Feature | Description |
|---------|-------------|
| Auto-detection | Detects ChunkLoadError by name and message patterns |
| Auto-retry | Automatically reloads with cache-busting (up to 2 times) |
| User-friendly UI | Shows "Update Available" instead of scary error |
| Hard refresh | Button that clears all caches and reloads |
| Home fallback | Option to navigate to home page if refresh fails |

### Files Modified

- `frontend/src/components/ErrorBoundary.tsx`

### Code Changes

#### 1. ChunkLoadError Detection

```typescript
function isChunkLoadError(error: Error): boolean {
  return (
    error.name === 'ChunkLoadError' ||
    error.message.includes('Loading chunk') ||
    error.message.includes('Loading CSS chunk') ||
    error.message.includes('Failed to fetch dynamically imported module')
  );
}
```

#### 2. Automatic Recovery Logic

```typescript
handleChunkError = () => {
  const retryCount = sessionStorage.getItem(CHUNK_ERROR_RETRY_KEY) || 0;

  if (retryCount < MAX_CHUNK_RETRIES) {
    // Increment retry count
    sessionStorage.setItem(CHUNK_ERROR_RETRY_KEY, retryCount + 1);

    // Add cache-busting parameter and reload
    const url = new URL(window.location.href);
    url.searchParams.set('_refresh', Date.now().toString());
    window.location.href = url.toString();
  } else {
    // Show user-friendly error UI
    sessionStorage.removeItem(CHUNK_ERROR_RETRY_KEY);
  }
};
```

#### 3. Hard Refresh Function

```typescript
handleHardRefresh = () => {
  sessionStorage.removeItem(CHUNK_ERROR_RETRY_KEY);

  // Clear service worker caches
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
    });
  }

  window.location.reload();
};
```

#### 4. User-Friendly UI for Chunk Errors

```tsx
// Instead of scary "Oops! Something went wrong"
<div className="text-6xl mb-4">🔄</div>
<h1>Update Available</h1>
<p>A new version of the app is available. Please refresh to get the latest updates.</p>
<p>This can happen after we deploy improvements to the site.</p>
<button onClick={this.handleHardRefresh}>Refresh Now</button>
<button onClick={() => window.location.href = '/'}>Go to Home Page</button>
```

## User Experience Flow

```
1. User navigates to page
   ↓
2. ChunkLoadError occurs (old cached manifest, new chunks)
   ↓
3. ErrorBoundary detects ChunkLoadError
   ↓
4. Auto-retry #1: Reload with ?_refresh=timestamp
   ↓
5. If still fails → Auto-retry #2
   ↓
6. If still fails → Show friendly "Update Available" UI
   ↓
7. User clicks "Refresh Now" → Clears all caches, reloads
   ↓
8. Page loads successfully with fresh chunks
```

## Testing Checklist

- [x] ChunkLoadError is detected correctly
- [x] Auto-retry reloads page with cache-busting parameter
- [x] Retry count is tracked in sessionStorage
- [x] After max retries, user-friendly UI is shown
- [x] "Refresh Now" clears caches and reloads
- [x] "Go to Home Page" navigates to root
- [x] Non-chunk errors still show standard error UI

## Before vs After

### Before
```
⚠️ Oops! Something went wrong
We're sorry for the inconvenience. Please try refreshing the page.
[Refresh Page] [Try Again]
```
- Scary error message
- No automatic recovery
- User may think site is broken

### After
```
🔄 Update Available
A new version of the app is available. Please refresh to get the latest updates.
This can happen after we deploy improvements to the site.
[Refresh Now] [Go to Home Page]
```
- Friendly, non-scary message
- Automatic recovery attempts first
- Clear explanation of why this happened
- Prominent action buttons

## Related Issues

- Users reporting "site crashed" after deployments
- ChunkLoadError in console logs on production
- Rate limiting cascade (users rapidly refreshing due to errors)

## Prevention Recommendations

To reduce ChunkLoadError frequency:

1. **Vercel/CDN Configuration**
   - Ensure proper cache headers for chunk files
   - Use immutable caching for hashed chunks

2. **Next.js Configuration**
   - Consider `output: 'standalone'` for better chunk management
   - Review `generateBuildId` for consistent builds

3. **Deployment Strategy**
   - Use blue-green deployments if possible
   - Ensure atomic deployments (all files uploaded before switching)

## References

- Next.js chunk loading: https://nextjs.org/docs/messages/failed-loading-chunk
- Similar issue discussion: https://github.com/vercel/next.js/issues/38507
