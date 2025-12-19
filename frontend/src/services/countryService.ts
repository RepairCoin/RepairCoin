// Country data service - fetches country codes from RestCountries API

export interface Country {
  name: string;
  code: string;      // ISO 2-letter code (e.g., "US")
  dialCode: string;  // e.g., "+1"
  flag: string;      // Flag emoji
}

// Cache for country data
let cachedCountries: Country[] | null = null;

// Fallback countries if API fails
const FALLBACK_COUNTRIES: Country[] = [
  { name: "United States", code: "US", dialCode: "+1", flag: "🇺🇸" },
  { name: "United Kingdom", code: "GB", dialCode: "+44", flag: "🇬🇧" },
  { name: "Canada", code: "CA", dialCode: "+1", flag: "🇨🇦" },
  { name: "Australia", code: "AU", dialCode: "+61", flag: "🇦🇺" },
  { name: "Philippines", code: "PH", dialCode: "+63", flag: "🇵🇭" },
  { name: "India", code: "IN", dialCode: "+91", flag: "🇮🇳" },
  { name: "Germany", code: "DE", dialCode: "+49", flag: "🇩🇪" },
  { name: "France", code: "FR", dialCode: "+33", flag: "🇫🇷" },
  { name: "Japan", code: "JP", dialCode: "+81", flag: "🇯🇵" },
  { name: "China", code: "CN", dialCode: "+86", flag: "🇨🇳" },
  { name: "Brazil", code: "BR", dialCode: "+55", flag: "🇧🇷" },
  { name: "Mexico", code: "MX", dialCode: "+52", flag: "🇲🇽" },
  { name: "Spain", code: "ES", dialCode: "+34", flag: "🇪🇸" },
  { name: "Italy", code: "IT", dialCode: "+39", flag: "🇮🇹" },
  { name: "South Korea", code: "KR", dialCode: "+82", flag: "🇰🇷" },
  { name: "Netherlands", code: "NL", dialCode: "+31", flag: "🇳🇱" },
  { name: "Singapore", code: "SG", dialCode: "+65", flag: "🇸🇬" },
  { name: "New Zealand", code: "NZ", dialCode: "+64", flag: "🇳🇿" },
  { name: "Ireland", code: "IE", dialCode: "+353", flag: "🇮🇪" },
  { name: "United Arab Emirates", code: "AE", dialCode: "+971", flag: "🇦🇪" },
];

/**
 * Fetch countries from RestCountries API
 */
export async function fetchCountries(): Promise<Country[]> {
  // Return cached data if available
  if (cachedCountries) {
    return cachedCountries;
  }

  try {
    const response = await fetch(
      "https://restcountries.com/v3.1/all?fields=name,cca2,idd,flag"
    );

    if (!response.ok) {
      throw new Error("Failed to fetch countries");
    }

    const data = await response.json();

    const countries: Country[] = data
      .map((country: any) => {
        // Build dial code from root + first suffix (if suffix is short)
        // RestCountries API:
        // - Some countries have complete dial code in root (US: "+1", suffixes are area codes like "201")
        // - Some countries have partial root + suffix (Philippines: "+6" + "3" = "+63")
        const root = country.idd?.root || "";
        const suffix = country.idd?.suffixes?.[0] || "";

        // If suffix is 1-2 digits, it's part of the dial code
        // If suffix is 3+ digits, it's an area code (don't append)
        const dialCode = suffix.length <= 2 ? root + suffix : root;

        // Skip countries without dial codes
        if (!dialCode) return null;

        return {
          name: country.name?.common || "",
          code: country.cca2 || "",
          dialCode,
          flag: country.flag || "",
        };
      })
      .filter((c: Country | null): c is Country => c !== null && c.name !== "")
      .sort((a: Country, b: Country) => a.name.localeCompare(b.name));

    // Cache the results
    cachedCountries = countries;
    return countries;
  } catch (error) {
    console.error("Error fetching countries, using fallback:", error);
    return FALLBACK_COUNTRIES;
  }
}

/**
 * Find country by dial code
 */
export function findCountryByDialCode(
  dialCode: string,
  countries: Country[]
): Country | undefined {
  return countries.find((c) => c.dialCode === dialCode);
}

/**
 * Find country by ISO code
 */
export function findCountryByCode(
  code: string,
  countries: Country[]
): Country | undefined {
  return countries.find((c) => c.code.toUpperCase() === code.toUpperCase());
}

/**
 * Parse a phone string to extract country code and local number
 * Formats supported: "+1-5551234567", "+1 5551234567", "+15551234567", "15551234567", "6309310158517"
 */
export function parsePhoneString(
  phone: string,
  countries: Country[]
): { dialCode: string; localNumber: string; country: Country | undefined } {
  if (!phone) {
    const defaultCountry = findCountryByCode("US", countries);
    return { dialCode: "+1", localNumber: "", country: defaultCountry };
  }

  // Clean phone: remove spaces and dashes
  const cleanPhone = phone.replace(/[\s-]/g, "");

  // Sort countries by dial code length (longest first) to match correctly
  const sortedCountries = [...countries].sort(
    (a, b) => b.dialCode.length - a.dialCode.length
  );

  // First, try matching with + prefix (e.g., "+63-09310158517" or "+6309310158517")
  for (const country of sortedCountries) {
    if (cleanPhone.startsWith(country.dialCode)) {
      const localNumber = cleanPhone.slice(country.dialCode.length);
      return { dialCode: country.dialCode, localNumber, country };
    }
  }

  // Second, try matching without + prefix (e.g., "6309310158517" -> matches "63")
  // This handles legacy data stored without the + prefix
  for (const country of sortedCountries) {
    const dialCodeWithoutPlus = country.dialCode.replace("+", "");
    if (cleanPhone.startsWith(dialCodeWithoutPlus)) {
      const localNumber = cleanPhone.slice(dialCodeWithoutPlus.length);
      return { dialCode: country.dialCode, localNumber, country };
    }
  }

  // If no country code found, assume US and treat as local number
  const defaultCountry = findCountryByCode("US", countries);
  const localNumber = cleanPhone.replace(/^\+/, "");
  return { dialCode: "+1", localNumber, country: defaultCountry };
}

/**
 * Basic phone validation
 * - Digits only (after removing dial code)
 * - Min 7, max 15 digits
 */
export function validatePhone(localNumber: string): {
  isValid: boolean;
  error: string;
} {
  // Remove any non-digit characters
  const digitsOnly = localNumber.replace(/\D/g, "");

  if (!digitsOnly) {
    return { isValid: true, error: "" }; // Empty is valid (optional field)
  }

  if (digitsOnly.length < 7) {
    return { isValid: false, error: "Phone number is too short (min 7 digits)" };
  }

  if (digitsOnly.length > 15) {
    return { isValid: false, error: "Phone number is too long (max 15 digits)" };
  }

  return { isValid: true, error: "" };
}

/**
 * Format phone for storage: +{dialCode}-{localNumber}
 */
export function formatPhoneForStorage(
  dialCode: string,
  localNumber: string
): string {
  const digitsOnly = localNumber.replace(/\D/g, "");
  if (!digitsOnly) return "";
  return `${dialCode}-${digitsOnly}`;
}
