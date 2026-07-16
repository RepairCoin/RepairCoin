// Country data service.
//
// The dial-code list is now BUNDLED LOCALLY instead of fetched from the external
// restcountries.com API. That API was intermittently failing ("TypeError: Failed
// to fetch"), which broke a signup-critical field and threw a console/dev-overlay
// error. A phone-number selector should never depend on a third-party API at
// runtime, so we ship the data with the app: instant, offline-safe, no errors.

export interface Country {
  name: string;
  code: string; // ISO 2-letter code (e.g., "US")
  dialCode: string; // e.g., "+1"
  flag: string; // Flag emoji
}

// Derive the flag emoji from the ISO 3166-1 alpha-2 code using Unicode regional
// indicator symbols — keeps the dataset compact and the flags always correct.
function flagFromCode(code: string): string {
  if (!code || code.length !== 2) return "🏳️";
  const BASE = 0x1f1e6; // regional indicator "A"
  const upper = code.toUpperCase();
  return String.fromCodePoint(
    BASE + (upper.charCodeAt(0) - 65),
    BASE + (upper.charCodeAt(1) - 65)
  );
}

// name + ISO code + ITU dial code. Flags are derived from the code above.
const COUNTRY_DATA: { name: string; code: string; dialCode: string }[] = [
  { name: "Afghanistan", code: "AF", dialCode: "+93" },
  { name: "Albania", code: "AL", dialCode: "+355" },
  { name: "Algeria", code: "DZ", dialCode: "+213" },
  { name: "Andorra", code: "AD", dialCode: "+376" },
  { name: "Angola", code: "AO", dialCode: "+244" },
  { name: "Argentina", code: "AR", dialCode: "+54" },
  { name: "Armenia", code: "AM", dialCode: "+374" },
  { name: "Australia", code: "AU", dialCode: "+61" },
  { name: "Austria", code: "AT", dialCode: "+43" },
  { name: "Azerbaijan", code: "AZ", dialCode: "+994" },
  { name: "Bahamas", code: "BS", dialCode: "+1242" },
  { name: "Bahrain", code: "BH", dialCode: "+973" },
  { name: "Bangladesh", code: "BD", dialCode: "+880" },
  { name: "Barbados", code: "BB", dialCode: "+1246" },
  { name: "Belarus", code: "BY", dialCode: "+375" },
  { name: "Belgium", code: "BE", dialCode: "+32" },
  { name: "Belize", code: "BZ", dialCode: "+501" },
  { name: "Benin", code: "BJ", dialCode: "+229" },
  { name: "Bhutan", code: "BT", dialCode: "+975" },
  { name: "Bolivia", code: "BO", dialCode: "+591" },
  { name: "Bosnia and Herzegovina", code: "BA", dialCode: "+387" },
  { name: "Botswana", code: "BW", dialCode: "+267" },
  { name: "Brazil", code: "BR", dialCode: "+55" },
  { name: "Brunei", code: "BN", dialCode: "+673" },
  { name: "Bulgaria", code: "BG", dialCode: "+359" },
  { name: "Burkina Faso", code: "BF", dialCode: "+226" },
  { name: "Burundi", code: "BI", dialCode: "+257" },
  { name: "Cambodia", code: "KH", dialCode: "+855" },
  { name: "Cameroon", code: "CM", dialCode: "+237" },
  { name: "Canada", code: "CA", dialCode: "+1" },
  { name: "Cape Verde", code: "CV", dialCode: "+238" },
  { name: "Chad", code: "TD", dialCode: "+235" },
  { name: "Chile", code: "CL", dialCode: "+56" },
  { name: "China", code: "CN", dialCode: "+86" },
  { name: "Colombia", code: "CO", dialCode: "+57" },
  { name: "Comoros", code: "KM", dialCode: "+269" },
  { name: "Congo (DRC)", code: "CD", dialCode: "+243" },
  { name: "Congo (Republic)", code: "CG", dialCode: "+242" },
  { name: "Costa Rica", code: "CR", dialCode: "+506" },
  { name: "Côte d'Ivoire", code: "CI", dialCode: "+225" },
  { name: "Croatia", code: "HR", dialCode: "+385" },
  { name: "Cuba", code: "CU", dialCode: "+53" },
  { name: "Cyprus", code: "CY", dialCode: "+357" },
  { name: "Czechia", code: "CZ", dialCode: "+420" },
  { name: "Denmark", code: "DK", dialCode: "+45" },
  { name: "Djibouti", code: "DJ", dialCode: "+253" },
  { name: "Dominican Republic", code: "DO", dialCode: "+1809" },
  { name: "Ecuador", code: "EC", dialCode: "+593" },
  { name: "Egypt", code: "EG", dialCode: "+20" },
  { name: "El Salvador", code: "SV", dialCode: "+503" },
  { name: "Estonia", code: "EE", dialCode: "+372" },
  { name: "Eswatini", code: "SZ", dialCode: "+268" },
  { name: "Ethiopia", code: "ET", dialCode: "+251" },
  { name: "Fiji", code: "FJ", dialCode: "+679" },
  { name: "Finland", code: "FI", dialCode: "+358" },
  { name: "France", code: "FR", dialCode: "+33" },
  { name: "Gabon", code: "GA", dialCode: "+241" },
  { name: "Gambia", code: "GM", dialCode: "+220" },
  { name: "Georgia", code: "GE", dialCode: "+995" },
  { name: "Germany", code: "DE", dialCode: "+49" },
  { name: "Ghana", code: "GH", dialCode: "+233" },
  { name: "Greece", code: "GR", dialCode: "+30" },
  { name: "Guatemala", code: "GT", dialCode: "+502" },
  { name: "Guinea", code: "GN", dialCode: "+224" },
  { name: "Guyana", code: "GY", dialCode: "+592" },
  { name: "Haiti", code: "HT", dialCode: "+509" },
  { name: "Honduras", code: "HN", dialCode: "+504" },
  { name: "Hong Kong", code: "HK", dialCode: "+852" },
  { name: "Hungary", code: "HU", dialCode: "+36" },
  { name: "Iceland", code: "IS", dialCode: "+354" },
  { name: "India", code: "IN", dialCode: "+91" },
  { name: "Indonesia", code: "ID", dialCode: "+62" },
  { name: "Iran", code: "IR", dialCode: "+98" },
  { name: "Iraq", code: "IQ", dialCode: "+964" },
  { name: "Ireland", code: "IE", dialCode: "+353" },
  { name: "Israel", code: "IL", dialCode: "+972" },
  { name: "Italy", code: "IT", dialCode: "+39" },
  { name: "Jamaica", code: "JM", dialCode: "+1876" },
  { name: "Japan", code: "JP", dialCode: "+81" },
  { name: "Jordan", code: "JO", dialCode: "+962" },
  { name: "Kazakhstan", code: "KZ", dialCode: "+7" },
  { name: "Kenya", code: "KE", dialCode: "+254" },
  { name: "Kuwait", code: "KW", dialCode: "+965" },
  { name: "Kyrgyzstan", code: "KG", dialCode: "+996" },
  { name: "Laos", code: "LA", dialCode: "+856" },
  { name: "Latvia", code: "LV", dialCode: "+371" },
  { name: "Lebanon", code: "LB", dialCode: "+961" },
  { name: "Lesotho", code: "LS", dialCode: "+266" },
  { name: "Liberia", code: "LR", dialCode: "+231" },
  { name: "Libya", code: "LY", dialCode: "+218" },
  { name: "Liechtenstein", code: "LI", dialCode: "+423" },
  { name: "Lithuania", code: "LT", dialCode: "+370" },
  { name: "Luxembourg", code: "LU", dialCode: "+352" },
  { name: "Macau", code: "MO", dialCode: "+853" },
  { name: "Madagascar", code: "MG", dialCode: "+261" },
  { name: "Malawi", code: "MW", dialCode: "+265" },
  { name: "Malaysia", code: "MY", dialCode: "+60" },
  { name: "Maldives", code: "MV", dialCode: "+960" },
  { name: "Mali", code: "ML", dialCode: "+223" },
  { name: "Malta", code: "MT", dialCode: "+356" },
  { name: "Mauritania", code: "MR", dialCode: "+222" },
  { name: "Mauritius", code: "MU", dialCode: "+230" },
  { name: "Mexico", code: "MX", dialCode: "+52" },
  { name: "Moldova", code: "MD", dialCode: "+373" },
  { name: "Monaco", code: "MC", dialCode: "+377" },
  { name: "Mongolia", code: "MN", dialCode: "+976" },
  { name: "Montenegro", code: "ME", dialCode: "+382" },
  { name: "Morocco", code: "MA", dialCode: "+212" },
  { name: "Mozambique", code: "MZ", dialCode: "+258" },
  { name: "Myanmar", code: "MM", dialCode: "+95" },
  { name: "Namibia", code: "NA", dialCode: "+264" },
  { name: "Nepal", code: "NP", dialCode: "+977" },
  { name: "Netherlands", code: "NL", dialCode: "+31" },
  { name: "New Zealand", code: "NZ", dialCode: "+64" },
  { name: "Nicaragua", code: "NI", dialCode: "+505" },
  { name: "Niger", code: "NE", dialCode: "+227" },
  { name: "Nigeria", code: "NG", dialCode: "+234" },
  { name: "North Macedonia", code: "MK", dialCode: "+389" },
  { name: "Norway", code: "NO", dialCode: "+47" },
  { name: "Oman", code: "OM", dialCode: "+968" },
  { name: "Pakistan", code: "PK", dialCode: "+92" },
  { name: "Panama", code: "PA", dialCode: "+507" },
  { name: "Papua New Guinea", code: "PG", dialCode: "+675" },
  { name: "Paraguay", code: "PY", dialCode: "+595" },
  { name: "Peru", code: "PE", dialCode: "+51" },
  { name: "Philippines", code: "PH", dialCode: "+63" },
  { name: "Poland", code: "PL", dialCode: "+48" },
  { name: "Portugal", code: "PT", dialCode: "+351" },
  { name: "Qatar", code: "QA", dialCode: "+974" },
  { name: "Romania", code: "RO", dialCode: "+40" },
  { name: "Russia", code: "RU", dialCode: "+7" },
  { name: "Rwanda", code: "RW", dialCode: "+250" },
  { name: "Saudi Arabia", code: "SA", dialCode: "+966" },
  { name: "Senegal", code: "SN", dialCode: "+221" },
  { name: "Serbia", code: "RS", dialCode: "+381" },
  { name: "Sierra Leone", code: "SL", dialCode: "+232" },
  { name: "Singapore", code: "SG", dialCode: "+65" },
  { name: "Slovakia", code: "SK", dialCode: "+421" },
  { name: "Slovenia", code: "SI", dialCode: "+386" },
  { name: "Somalia", code: "SO", dialCode: "+252" },
  { name: "South Africa", code: "ZA", dialCode: "+27" },
  { name: "South Korea", code: "KR", dialCode: "+82" },
  { name: "South Sudan", code: "SS", dialCode: "+211" },
  { name: "Spain", code: "ES", dialCode: "+34" },
  { name: "Sri Lanka", code: "LK", dialCode: "+94" },
  { name: "Sudan", code: "SD", dialCode: "+249" },
  { name: "Sweden", code: "SE", dialCode: "+46" },
  { name: "Switzerland", code: "CH", dialCode: "+41" },
  { name: "Syria", code: "SY", dialCode: "+963" },
  { name: "Taiwan", code: "TW", dialCode: "+886" },
  { name: "Tajikistan", code: "TJ", dialCode: "+992" },
  { name: "Tanzania", code: "TZ", dialCode: "+255" },
  { name: "Thailand", code: "TH", dialCode: "+66" },
  { name: "Togo", code: "TG", dialCode: "+228" },
  { name: "Trinidad and Tobago", code: "TT", dialCode: "+1868" },
  { name: "Tunisia", code: "TN", dialCode: "+216" },
  { name: "Turkey", code: "TR", dialCode: "+90" },
  { name: "Turkmenistan", code: "TM", dialCode: "+993" },
  { name: "Uganda", code: "UG", dialCode: "+256" },
  { name: "Ukraine", code: "UA", dialCode: "+380" },
  { name: "United Arab Emirates", code: "AE", dialCode: "+971" },
  { name: "United Kingdom", code: "GB", dialCode: "+44" },
  { name: "United States", code: "US", dialCode: "+1" },
  { name: "Uruguay", code: "UY", dialCode: "+598" },
  { name: "Uzbekistan", code: "UZ", dialCode: "+998" },
  { name: "Venezuela", code: "VE", dialCode: "+58" },
  { name: "Vietnam", code: "VN", dialCode: "+84" },
  { name: "Yemen", code: "YE", dialCode: "+967" },
  { name: "Zambia", code: "ZM", dialCode: "+260" },
  { name: "Zimbabwe", code: "ZW", dialCode: "+263" },
];

const COUNTRIES: Country[] = COUNTRY_DATA.map((c) => ({
  ...c,
  flag: flagFromCode(c.code),
})).sort((a, b) => a.name.localeCompare(b.name));

/**
 * Return the bundled country list. Async signature is kept for backward
 * compatibility with existing callers; it never hits the network and never
 * throws, so the phone selector always has data.
 */
export async function fetchCountries(): Promise<Country[]> {
  return COUNTRIES;
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
