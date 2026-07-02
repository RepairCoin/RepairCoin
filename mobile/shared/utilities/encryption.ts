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
  const key = password.trim();
  const prefixed = MESSAGE_PREFIX + plaintext;
  const encrypted = CryptoJS.AES.encrypt(prefixed, key);
  const ciphertext = encrypted.toString();

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
    const key = password.trim();
    const decrypted = CryptoJS.AES.decrypt(ciphertext.trim(), key);
    const result = decrypted.toString(CryptoJS.enc.Utf8);

    if (!result || !result.startsWith(MESSAGE_PREFIX)) {
      return null;
    }

    return result.slice(MESSAGE_PREFIX.length);
  } catch {
    return null;
  }
}
