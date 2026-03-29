# Enhancement: Password-Locked Secure Messages

**Status:** Completed
**Priority:** Low
**Est. Effort:** 3-5 days
**Created:** 2026-03-29
**Updated:** 2026-03-29
**Completed:** 2026-03-29

## Problem / Goal

Add an optional "Secure Message" mode to the in-app messaging system where senders can lock messages/images behind a password. The receiver must enter the password to view the content. This adds a layer of privacy for sensitive information shared between customers and shops.

## Analysis

**Current state:** Messaging exists between customers and shops for booking-related communication. Messages are stored in plaintext on the backend.

**Proposed approach:**
- Client-side encryption using AES-256 before sending to backend
- Backend stores only encrypted blob (zero-knowledge — server can't read it)
- Receiver decrypts client-side after entering the correct password
- Password shared out-of-band (in person, phone call, etc.)

**Key considerations:**
- Should be an **optional mode**, not default — normal conversations stay frictionless
- No password recovery possible (by design for security)
- Need clear UX messaging about password responsibility
- Image encryption: encrypt base64 data before upload, decrypt on view

## Implementation

### Backend
1. Add `is_encrypted` boolean and `encryption_metadata` JSON column to messages table
2. Store encrypted content as-is (no decryption server-side)
3. API accepts encrypted payload without modification

### Mobile Frontend
1. Add lock icon toggle in message composer to enable secure mode
2. Password input modal when sending a locked message
3. Locked message placeholder UI (blurred/hidden content with lock icon)
4. Password prompt modal when receiver taps to unlock
5. Decrypt and display content after correct password entry
6. Support for both text and image encryption

### Encryption
1. Use `expo-crypto` or `crypto-js` for AES-256 encryption
2. Derive encryption key from password using PBKDF2
3. Store salt in `encryption_metadata` for key derivation
4. Encrypt/decrypt entirely on-device

### UX Flow
**Sender:**
1. Compose message → tap lock icon → enter password → send
2. Message sent as encrypted blob

**Receiver:**
1. See locked message placeholder (lock icon + "This message is locked")
2. Tap to unlock → enter password → content revealed
3. Option to keep unlocked for session or re-lock

## Verification Checklist

- [ ] Lock icon toggle appears in message composer
- [ ] Sender can set password and send encrypted message
- [ ] Receiver sees locked placeholder for encrypted messages
- [ ] Receiver can unlock with correct password
- [ ] Wrong password shows error, does not reveal content
- [ ] Images can be sent as locked messages
- [ ] Normal (unlocked) messages work as before
- [ ] Backend stores only encrypted data
- [ ] Works on both Android and iOS

## Notes

- Client suggestion — wants secure/encrypted messaging as a differentiator
- Recommend implementing as optional "Secure Message" mode, not default
- Password cannot be recovered if forgotten (inform users clearly)
- Consider session-based unlock (stay unlocked until app closes) to reduce friction
- Dependencies: `crypto-js` or `expo-crypto` for encryption
