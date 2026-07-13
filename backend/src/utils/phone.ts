// Shared phone-number helpers. E.164 is what Twilio (and every SMS carrier) expects. This was
// originally inlined in LeadAttributionService; promoted here so ads, notifications, and marketing
// all normalize identically before an SMS send.

/** Crude E.164 normalization (pure). Strips formatting; assumes US (+1) for a bare 10-digit number.
 *  Good enough for send + dedupe; full libphonenumber is overkill. Returns null when unusable. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d+]/g, '');
  const digits = cleaned.replace(/\D/g, '');
  if (!digits) return null;
  if (cleaned.startsWith('+')) return '+' + digits;
  if (digits.length === 10) return '+1' + digits;
  return '+' + digits;
}

/** True when a string is already a plausible E.164 number (+ and 8–15 digits). */
export function isE164(phone: string | null | undefined): boolean {
  return !!phone && /^\+\d{8,15}$/.test(phone);
}
