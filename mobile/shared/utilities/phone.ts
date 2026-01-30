import { COUNTRIES, PHONE_VALIDATION, type Country } from "@/shared/constants/phone";

/**
 * Parse E.164 phone number to extract country and local number
 */
export const parseE164 = (e164: string): { country: Country; localNumber: string } => {
  const defaultCountry = COUNTRIES[0];

  if (!e164 || !e164.startsWith("+")) {
    return { country: defaultCountry, localNumber: e164 || "" };
  }

  // Find matching country by dial code (longest match first)
  const sortedCountries = [...COUNTRIES].sort(
    (a, b) => b.dialCode.length - a.dialCode.length
  );

  for (const country of sortedCountries) {
    if (e164.startsWith(country.dialCode)) {
      const localNumber = e164.slice(country.dialCode.length);
      return { country, localNumber };
    }
  }

  return { country: defaultCountry, localNumber: e164.replace(/^\+/, "") };
};

/**
 * Format to E.164
 */
export const toE164 = (dialCode: string, localNumber: string): string => {
  const digits = localNumber.replace(/\D/g, "");
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
