// Email validation
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

// Phone validation (minimum 7 digits for international numbers)
export const isValidPhone = (phone: string): boolean => {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7;
};

// Ethereum address validation
export const isValidEthAddress = (address: string): boolean => {
  const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
  return ethAddressRegex.test(address);
};

// URL validation
export const isValidUrl = (url: string): boolean => {
  const urlRegex =
    /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-@]*)*\/?$/;
  return urlRegex.test(url.trim());
};

// Minimum length validation
export const hasMinLength = (value: string, minLength: number): boolean => {
  return value.trim().length >= minLength;
};

// Customer form validation
export const validateCustomerForm = (
  fullName: string,
  email: string
): string[] => {
  const errors: string[] = [];

  if (!fullName.trim()) {
    errors.push("Full name is required");
  } else if (!hasMinLength(fullName, 2)) {
    errors.push("Full name must be at least 2 characters");
  }

  if (!email.trim()) {
    errors.push("Email is required");
  } else if (!isValidEmail(email)) {
    errors.push("Please enter a valid email address");
  }

  return errors;
};

// Shop first slide validation (personal info)
export const validateShopFirstSlide = (
  firstName: string,
  lastName: string,
  email: string,
  phone: string
): string[] => {
  const errors: string[] = [];

  if (!hasMinLength(firstName, 2)) {
    errors.push("First name must be at least 2 characters");
  }

  if (!hasMinLength(lastName, 2)) {
    errors.push("Last name must be at least 2 characters");
  }

  if (!isValidEmail(email)) {
    errors.push("Please enter a valid email address");
  }

  if (!isValidPhone(phone)) {
    errors.push("Please enter a complete phone number");
  }

  return errors;
};

// Shop second slide validation (business info)
export const validateShopSecondSlide = (
  shopId: string,
  name: string,
  companySize: string,
  monthlyRevenue: string
): string[] => {
  const errors: string[] = [];

  if (!hasMinLength(shopId, 3)) {
    errors.push("Shop ID must be at least 3 characters");
  }

  if (!hasMinLength(name, 2)) {
    errors.push("Company name must be at least 2 characters");
  }

  if (!companySize) {
    errors.push("Please select company size");
  }

  if (!monthlyRevenue) {
    errors.push("Please select monthly revenue");
  }

  return errors;
};

// Shop third slide validation (location & wallet)
export const validateShopThirdSlide = (
  address: string,
  city: string,
  country: string,
  walletAddress: string,
  reimbursementAddress: string
): string[] => {
  const errors: string[] = [];

  if (!hasMinLength(address, 3)) {
    errors.push("Street address must be at least 3 characters");
  }

  if (!hasMinLength(city, 2)) {
    errors.push("City must be at least 2 characters");
  }

  if (!hasMinLength(country, 2)) {
    errors.push("Country must be at least 2 characters");
  }

  if (!walletAddress || !isValidEthAddress(walletAddress)) {
    errors.push("Please connect your wallet first");
  }

  if (reimbursementAddress.trim() && !isValidEthAddress(reimbursementAddress.trim())) {
    errors.push("If provided, reimbursement address must be valid (0x...)");
  }

  return errors;
};

// Shop social media slide validation
export const validateShopSocialMediaSlide = (
  facebook: string,
  instagram: string,
  twitter: string
): string[] => {
  const errors: string[] = [];

  if (facebook && facebook.trim() && !isValidUrl(facebook.trim())) {
    errors.push("Please enter a valid Facebook URL");
  }

  if (instagram && instagram.trim() && !isValidUrl(instagram.trim())) {
    errors.push("Please enter a valid Instagram URL");
  }

  if (twitter && twitter.trim() && !isValidUrl(twitter.trim())) {
    errors.push("Please enter a valid Twitter URL");
  }

  return errors;
};
