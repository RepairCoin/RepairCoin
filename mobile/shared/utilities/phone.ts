import { COUNTRIES, PHONE_VALIDATION, type Country } from "@/shared/constants/phone";

// Drop a national trunk prefix (leading zero[s]) — never valid in E.164.
const stripTrunkZero = (digits: string): string => digits.replace(/^0+/, "");

/**
 * Parse a phone number to extract country and the national (local) number.
 * Handles three cases:
 *  - Proper E.164 ("+639171234567")
 *  - International prefix without "+" ("00639171234567")
 *  - Legacy/non-normalized values without "+" ("639171234567", "09171234567")
 * so the local field never includes the country digits (which previously got
 * the dial code prepended again on country select → duplicated code).
 */
export const parseE164 = (e164: string): { country: Country; localNumber: string } => {
  const defaultCountry = COUNTRIES[0];

  if (!e164) {
    return { country: defaultCountry, localNumber: "" };
  }

  // Longest dial code first so e.g. "+1xxx" vs "+1-NANP" resolve deterministically
  const sortedCountries = [...COUNTRIES].sort(
    (a, b) => b.dialCode.length - a.dialCode.length
  );

  const trimmed = e164.trim();

  // Case 1: proper E.164
  if (trimmed.startsWith("+")) {
    for (const country of sortedCountries) {
      if (trimmed.startsWith(country.dialCode)) {
        return {
          country,
          localNumber: stripTrunkZero(
            trimmed.slice(country.dialCode.length).replace(/\D/g, "")
          ),
        };
      }
    }
    return { country: defaultCountry, localNumber: trimmed.replace(/\D/g, "") };
  }

  let digits = trimmed.replace(/\D/g, "");

  // Case 2: "00" international prefix → treat remainder like E.164 without "+"
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
    for (const country of sortedCountries) {
      const code = country.dialCode.replace("+", "");
      if (digits.startsWith(code)) {
        return { country, localNumber: stripTrunkZero(digits.slice(code.length)) };
      }
    }
    return { country: defaultCountry, localNumber: stripTrunkZero(digits) };
  }

  // Case 3: bare digits. Try to detect an embedded country code, but guard
  // against false positives (a national number that happens to start with a
  // dial code): skip 1-digit codes like "+1", and require the remaining digits
  // to be a plausible national-number length.
  for (const country of sortedCountries) {
    const code = country.dialCode.replace("+", "");
    if (
      code.length >= 2 &&
      digits.startsWith(code) &&
      digits.length - code.length >= PHONE_VALIDATION.MIN_DIGITS
    ) {
      return { country, localNumber: stripTrunkZero(digits.slice(code.length)) };
    }
  }

  // Otherwise it's just a national number (drop any trunk zero).
  return { country: defaultCountry, localNumber: stripTrunkZero(digits) };
};

/**
 * Format to E.164. Strips a national trunk prefix (leading zero) so e.g.
 * dialCode "+63" + "09171234567" → "+639171234567" (not "+630917...").
 */
export const toE164 = (dialCode: string, localNumber: string): string => {
  const digits = stripTrunkZero(localNumber.replace(/\D/g, ""));
  if (!digits) return "";
  return `${dialCode}${digits}`;
};

/**
 * Validate phone number length
 */
export const validatePhoneLength = (digits: string): string | null => {
  if (!digits) return null;
  if (digits.length < PHONE_VALIDATION.MIN_DIGITS) {
    return `Phone number is too short (min ${PHONE_VALIDATION.MIN_DIGITS} digits)`;
  }
  if (digits.length > PHONE_VALIDATION.MAX_DIGITS) {
    return `Phone number is too long (max ${PHONE_VALIDATION.MAX_DIGITS} digits)`;
  }
  return null;
};
