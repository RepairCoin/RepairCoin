# Enhancement: Secure Messaging V2 Improvements

**Status:** In Progress
**Priority:** Low
**Est. Effort:** 3-5 days (total for all items)
**Created:** 2026-03-29
**Updated:** 2026-03-29

## Problem / Goal

Improve the password-locked messaging feature (v1 shipped March 29) with better UX and additional security options based on common user pain points with password-protected content.

## Proposed Improvements

### 1. Password Hint (Est: 2-3 hrs)
Allow sender to add an optional hint displayed on the locked bubble (e.g., "Hint: our meeting date"). Helps the receiver remember which password to use without revealing it.
- Add `hint` field to encryption metadata
- Show hint text below "Locked Message" on the bubble
- Add hint input field in MessageInput when lock is active

### 2. Session-Based Unlock (Est: 2-3 hrs)
Once a message is unlocked, keep it visible for the entire chat session instead of re-locking when the component re-renders or the user scrolls away.
- Store unlocked message IDs + decrypted content in a session map (React context or useRef)
- Auto-clear on conversation exit
- No persistence — re-entering the conversation requires password again

### 3. Biometric Unlock (Est: 3-4 hrs)
After first successful password unlock, offer to save the password in secure storage with biometric protection (Face ID / fingerprint). Next time, user just uses biometrics.
- Use `expo-local-authentication` for biometric prompt
- Store password per-conversation in `expo-secure-store` (encrypted at rest)
- "Remember password" toggle after first successful unlock
- Clear stored passwords on logout

### 4. Auto-Expiring Messages (Est: 4-5 hrs)
Sender sets a timer (5 min / 1 hour / 24 hours). Message auto-deletes after the timer.
- Add `expiresAt` field to message metadata
- Backend cron job or client-side check to soft-delete expired messages
- Countdown timer displayed on the message bubble
- Visual indicator (flame icon) for expiring messages

### 5. Unlock Read Receipt (Est: 1-2 hrs)
Sender can see when the receiver actually unlocked (viewed) the message, not just when it was delivered.
- Add `unlockedAt` field to message metadata
- API call to update `unlockedAt` on successful decrypt
- Show "Unlocked at 3:42 PM" below the message for the sender

### 6. Conversation-Level Password (Est: 3-4 hrs)
Set one password for an entire conversation. All messages in that conversation are automatically encrypted/decrypted with the shared password.
- Add `conversationPassword` to conversation metadata
- Auto-encrypt all outgoing messages when set
- Auto-decrypt incoming messages with stored password
- Toggle in conversation settings to enable/disable
- Password stored locally in secure storage (not sent to server)

## Implementation Priority

| # | Feature | Impact | Effort | Status |
|---|---------|--------|--------|--------|
| 1 | Password hint | High UX | Low | **DONE** (March 29) |
| 2 | Session-based unlock | High UX | Low | **DONE** (March 29) |
| 3 | Biometric unlock | Medium UX | Medium | Pending |
| 5 | Unlock read receipt | Medium | Low | Pending |
| 6 | Conversation password | High UX | Medium | Pending |
| 4 | Auto-expiring messages | Cool factor | High | Pending |

## Verification Checklist

- [ ] Each improvement works independently
- [ ] Backward compatible with v1 locked messages
- [ ] No performance regression on chat screen
- [ ] Works on both Android and iOS

## Notes

- V1 shipped March 29, 2026 — AES-256 encryption with password, lock toggle in composer, locked bubble with unlock modal
- Improvements should be backward compatible — v1 messages without hints/expiry should still work
- Biometric unlock depends on device capability — needs graceful fallback
- Auto-expiring messages need backend support for cleanup
