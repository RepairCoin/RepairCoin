# FEATURE: Emoji Picker for Messaging

**Status:** Complete
**Priority:** Low
**Type:** Feature (UX Enhancement)
**Created:** 2026-03-11

## Description

The smiley face (😊) button in the message input area of `ConversationThread.tsx` is **non-functional**. It toggles a `showEmojiPicker` state but no emoji picker UI is rendered. Clicking it does nothing visible.

## Current State

- **Button location:** `frontend/src/components/messaging/ConversationThread.tsx` (line 528-535)
- **State exists:** `showEmojiPicker` state is declared (line 64) and toggled on click (line 530)
- **No picker rendered:** There is no `{showEmojiPicker && <EmojiPicker />}` block anywhere in the component
- **Affects:** Both customer and shop chat views (same component)

## Implementation Plan

### Step 1: Install Emoji Picker Library

```bash
cd frontend && npm install emoji-picker-react
```

Lightweight, React-native emoji picker with search, categories, and skin tone support.

### Step 2: Add Emoji Picker to ConversationThread

**File:** `frontend/src/components/messaging/ConversationThread.tsx`

- Import `EmojiPicker` from `emoji-picker-react`
- Render picker above the input when `showEmojiPicker` is true
- On emoji select: append emoji to `messageInput`, close picker
- Click-outside handler to dismiss picker
- Position picker absolutely above the emoji button

```tsx
{showEmojiPicker && (
  <div className="absolute bottom-16 right-12 z-50">
    <EmojiPicker
      onEmojiClick={(emojiData) => {
        setMessageInput((prev) => prev + emojiData.emoji);
        setShowEmojiPicker(false);
      }}
      theme="dark"
      width={320}
      height={400}
    />
  </div>
)}
```

### Step 3: Click-Outside Dismissal

Add a ref and click-outside listener so the picker closes when clicking elsewhere:

```tsx
const emojiPickerRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const handleClickOutside = (e: MouseEvent) => {
    if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
      setShowEmojiPicker(false);
    }
  };
  if (showEmojiPicker) {
    document.addEventListener('mousedown', handleClickOutside);
  }
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, [showEmojiPicker]);
```

## Files to Modify

| File | Action |
| ---- | ------ |
| `frontend/src/components/messaging/ConversationThread.tsx` | Add emoji picker rendering + click-outside logic |
| `frontend/package.json` | Add `emoji-picker-react` dependency |

## Edge Cases

- **Mobile responsiveness:** Picker should not overflow on small screens — position may need adjustment
- **Dark theme:** Use `theme="dark"` prop to match app theme
- **Focus management:** After selecting emoji, keep focus on message input
- **Scroll position:** Picker should not push chat messages or cause layout shift

## Effort

~30 minutes
