// backend/src/utils/tokenCrypto.ts
//
// Symmetric encryption for OAuth tokens stored at rest (Meta connect flow + reusable).
// Mirrors the proven crypto-js AES pattern in GoogleCalendarService.encryptToken — kept as
// a tiny shared util so callers don't re-implement it. Keyed off META_TOKEN_ENCRYPTION_KEY.
//
// NOTE: crypto-js AES uses a passphrase-derived key (OpenSSL-compatible) — fine for token
// confidentiality at rest. The key MUST be a strong random secret in env; never log plaintext.

import CryptoJS from 'crypto-js';

// Read at call-time (not module load) so env loaded after import — and tests — see the key.
function key(): string {
  return process.env.META_TOKEN_ENCRYPTION_KEY || '';
}

/** Encrypt a token for storage. Throws if the key isn't configured (fail closed). */
export function encryptToken(plain: string): string {
  const k = key();
  if (!k) throw new Error('META_TOKEN_ENCRYPTION_KEY not configured');
  return CryptoJS.AES.encrypt(plain, k).toString();
}

/** Decrypt a stored token. Throws if the key isn't configured or the ciphertext is invalid. */
export function decryptToken(cipher: string): string {
  const k = key();
  if (!k) throw new Error('META_TOKEN_ENCRYPTION_KEY not configured');
  const out = CryptoJS.AES.decrypt(cipher, k).toString(CryptoJS.enc.Utf8);
  if (!out) throw new Error('Failed to decrypt token (bad key or ciphertext)');
  return out;
}

/** True when the encryption key is present (so callers can gate gracefully). */
export function tokenCryptoConfigured(): boolean {
  return !!key();
}
