# Landing Page Hero Video — Picture-in-Picture Issue

## Priority: Low
## Status: Pending
## Assignee: Frontend Developer

## Problem

The landing page hero video can be popped out into a browser Picture-in-Picture (PiP) window, leaving a large black placeholder with "Playing in Video Popout" text covering half the hero section. This makes the page appear broken.

## Screenshot

See `c:\dev\s1.jpeg` — the hero section shows "Playing in Video Popout" instead of the decorative video.

## Root Cause

The hero video in `frontend/src/components/landing-v2/HeroSection.tsx` (lines 111-134) uses a native `<video>` tag without the `disablePictureInPicture` attribute:

```tsx
<video autoPlay loop muted playsInline>
  <source src="/img/landing/hero-person.webm" type="video/webm" />
</video>
```

This allows browsers (Chrome, Edge) to pop the video out via right-click or extensions. Since the video is a decorative background element (not watchable content), PiP serves no purpose and breaks the layout.

## How to Trigger

- Right-click the hero video and select "Picture in Picture"
- A browser extension may trigger PiP automatically
- Some browsers prompt PiP when navigating away from a tab with a playing video

## Fix

Add `disablePictureInPicture` to the `<video>` tag:

```tsx
<video autoPlay loop muted playsInline disablePictureInPicture>
```

## Affected Files

- `frontend/src/components/landing-v2/HeroSection.tsx` (line 115)

## Notes

- This is not a browser compatibility bug — it is standard browser PiP behavior
- The fix is a single attribute addition with no side effects
- Supported in Chrome 69+, Edge 79+, Opera 56+
