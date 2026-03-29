import CryptoJS from "crypto-js";

const MESSAGE_PREFIX = "RC:"; // Prefix for wrong-password detection

export interface EncryptionResult {
  ciphertext: string;
  algorithm: string;
}

export interface EncryptionMetadata {
  algorithm: string;
  encryptedAttachments?: boolean;
}

/**
 * Encrypt a message with a password using AES (OpenSSL format).
 * CryptoJS handles salt/IV generation internally.
 * Output is Base64 with embedded salt — everything needed for decryption.
 */
export function encryptMessage(plaintext: string, password: string): EncryptionResult {
  const prefixed = MESSAGE_PREFIX + plaintext;
  const encrypted = CryptoJS.AES.encrypt(prefixed, password);
  const ciphertext = encrypted.toString();

  // Verify encryption works by immediately decrypting
  const verify = CryptoJS.AES.decrypt(ciphertext, password).toString(CryptoJS.enc.Utf8);
  console.log('[Encryption] plaintext:', plaintext);
  console.log('[Encryption] ciphertext length:', ciphertext.length);
  console.log('[Encryption] ciphertext preview:', ciphertext.substring(0, 30));
  console.log('[Encryption] verify decrypt:', verify === prefixed ? 'OK' : 'FAILED');

  return {
    ciphertext,
    algorithm: "aes-256-openssl-v1",
  };
}

/**
 * Decrypt a message with a password.
 * Returns null if the password is wrong.
 */
export function decryptMessage(
  ciphertext: string,
  password: string
): string | null {
  try {
    console.log('[Decryption] ciphertext length:', ciphertext.length);
    console.log('[Decryption] ciphertext preview:', ciphertext.substring(0, 30));
    console.log('[Decryption] password:', password);

    const decrypted = CryptoJS.AES.decrypt(ciphertext, password);
    console.log('[Decryption] decrypted words:', decrypted.sigBytes, 'bytes');

    const result = decrypted.toString(CryptoJS.enc.Utf8);
    console.log('[Decryption] result:', result ? result.substring(0, 20) : 'EMPTY');
    console.log('[Decryption] starts with prefix:', result?.startsWith(MESSAGE_PREFIX));

    if (!result || !result.startsWith(MESSAGE_PREFIX)) {
      return null;
    }

    return result.slice(MESSAGE_PREFIX.length);
  } catch (e) {
    console.error('[Decryption] error:', e);
    return null;
  }
}
